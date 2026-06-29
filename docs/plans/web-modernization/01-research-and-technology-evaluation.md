# 01 — Research Findings & Technology Evaluation

This document summarizes the current (June 2026) official guidance and evaluates each candidate technology **against this project specifically**. Two project constraints shape every recommendation:

1. **JavaScript is a hard standard** (per the brief). TypeScript migration is therefore **out of scope**, even where the broader ecosystem leans TS-first. We achieve type-safety with JSDoc + `checkJs` instead.
2. **The team has a deliberate minimal-dependency philosophy** (e.g. `docs/ai/04-ISSUES-AND-DEBT.md` notes the test suite is "free of third-party package dependencies like Jest"). Every new dependency must clear a high bar.

Where the general ecosystem default and this project's constraints diverge, this document recommends what fits **this** project — which sometimes means rejecting a popular library the wider industry would reach for.

---

## A. Next.js 16 & React 19 — confirmed official guidance

The app runs Next.js **16.2.6** / React **19.2.4** (latest at time of writing is 16.2.9 / 19.2.7 — a routine patch bump). The findings below come from the official Next.js 16 docs.

### A.1 Cache Components (`cacheComponents: true`)
- This flag is the production rename of `experimental.dynamicIO` and **absorbs** the old `experimental.ppr` and `experimental.useCache` (all removed).
- With it on, **everything is dynamic by default**; you opt specific scopes *into* caching with the `"use cache"` directive.
- A `"use cache"` scope **cannot read `cookies()`/`headers()`/`searchParams`** — read them outside and pass as arguments (they become part of the cache key).
- `cacheLife(profile)` sets lifetime (built-in `seconds`/`minutes`/`hours`/`days`/`weeks`/`max`); `cacheTag(...)` tags entries for invalidation.
- **New in 16:** `revalidateTag(tag, profile)` now takes a `cacheLife` profile as a second arg (use `'max'`); Server-Action-only `updateTag(tag)` gives read-your-own-writes (the user sees their mutation immediately); `refresh()` re-pulls uncached data.
- **Implication for this app:** `cacheComponents` is already on but defeated by a blanket `cache: "no-store"` and zero tags. The fix is to make caching *opt-in per read*: cache public, slow-changing data (venue/court config) with `cacheTag('venue:'+slug)` and a `days`/`hours` profile, leave availability and per-user reads uncached behind `<Suspense>`, and call `revalidateTag`/`updateTag` from the relevant mutations.

> Sources: [next-16 blog](https://nextjs.org/blog/next-16) · [use-cache](https://nextjs.org/docs/app/api-reference/directives/use-cache) · [cacheComponents](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) · [cacheLife](https://nextjs.org/docs/app/api-reference/functions/cacheLife)

### A.2 `proxy.js` (renamed middleware) — what it must NOT do
- Next.js 16 renames `middleware.js` → `proxy.js`; it now runs on the **Node.js runtime** by default.
- Official prohibition (verbatim): *"it should not be used as a full session management or authorization solution."* Read the session **optimistically from the cookie only**; avoid DB/API checks (the proxy runs on every prefetched route).
- **Implication:** the current `proxy.js` does the right *kind* of work (optimistic cookie checks + token refresh) — but the app then leans on it as a real authz gate while the layout-level backstop is broken. Per the docs, the authoritative check must live in the **Data Access Layer**, not the proxy.

> Source: [proxy](https://nextjs.org/docs/app/getting-started/proxy)

### A.3 Server Actions vs Route Handlers vs direct reads
- **Server Actions** = mutations triggered from your own UI. They are auto-generated encrypted POST endpoints with a built-in Origin/CSRF check. They are **explicitly not for data fetching** (serialized, no parallelism, uncacheable).
- **Route Handlers** = real addressable HTTP endpoints — payment webhooks, OAuth callbacks, third-party/mobile clients, anything needing custom caching/streaming.
- **Own-app reads** = neither; fetch directly in Server Components (or a DAL the components call), cached via `"use cache"`.
- *"Treat Server Actions with the same security considerations as public-facing API endpoints"* — re-verify authn/authz inside every action.
- **Implication:** the app currently models **all reads as Server Actions** — the exact anti-pattern the docs warn against. See [04](./04-api-server-action-service-review.md).

### A.4 The Data Access Layer (DAL) is the security boundary
- Verbatim: *"The majority of security checks should be performed as close as possible to your data source."*
- Pattern: a `cache()`-wrapped `verifySession()` that reads the cookie, verifies the session, returns a **minimal DTO**; called from Server Components, Server Actions, and Route Handlers; performs resource-level ownership checks to prevent IDOR.
- Layouts are cautioned against as the authz boundary because they don't re-render on client navigation — exactly the bug this app has.

> Source: [authentication guide](https://nextjs.org/docs/app/guides/authentication)

### A.5 Cookie-setting constraint (important for token refresh)
- You **cannot `.set()` cookies during Server Component render** — only inside a Server Action or Route Handler (or middleware/`proxy.js` response).
- **Implication:** the current design (refresh in `proxy.js`, which *can* set cookies on its response) is valid. The problem is purely the **matcher coverage gap** (`/venues/*` is not matched) plus the lack of a refresh-on-401 fallback for client-invoked actions. Fix by (a) extending coverage and/or (b) adding a refresh-on-401 path inside the DAL/actions (which can set cookies).

### A.6 `connection()` and `after()`
- `connection()` (already used here) opts a render into dynamic when it needs per-request values — correct usage in the protected layouts and OG route.
- `after()` (`next/after`) schedules post-response work (analytics, post-booking notifications) without forcing a route dynamic — a good fit for future telemetry without perf cost.

---

## B. Technology evaluation (tailored to this project)

Each row: the recommendation, the priority, and whether it adds a dependency. "Adopt" = recommended for this project; "Optional" = beneficial but not required now; "Reject" = evaluated and not recommended here (with reason).

| Area | Recommendation | New dep? | Verdict | Priority |
|---|---|---|---|---|
| Schema validation | **Zod 4** | +1 runtime | **Adopt** | High |
| Forms | **React 19 native** (`useActionState`/`useFormStatus`) | 0 | **Adopt** | High |
| Forms (complex) | react-hook-form | +1 | **Optional** (only if a form outgrows native) | Low |
| Server state (live) | TanStack Query | +1 | **Optional** (only for availability polling) | Low |
| URL state | nuqs | +1 | **Optional** (admin tables, booking date) | Medium |
| Global client state | Zustand | +1 | **Reject for now** (`useReducer` covers the wizard) | — |
| Data layer | **Roll-your-own DAL** | 0 | **Adopt** | Critical |
| Auth library | Auth.js / better-auth | +1 | **Reject** (backend already owns tokens) | — |
| JWT decode | **jose** (for `exp`, optional) | +1 | **Optional** (current hand-decode is fine for `exp`) | Low |
| Styling | **Keep** Tailwind 4 + `cn()` | 0 | **Keep** | — |
| Component variants | class-variance-authority | +1 | **Optional** (only if `Button`/inputs gain 2+ axes) | Low |
| Component library | shadcn/ui | (copies code) | **Reject** (existing primitives are good) | — |
| Unit (pure logic) | **Keep `node:test`** | 0 | **Keep** | — |
| Component tests | **Vitest 4 + RTL 16** | +dev | **Adopt** | Medium |
| E2E | **Playwright 1.61** | +dev | **Adopt** | High |
| Formatting | **Prettier 3.9 + prettier-plugin-tailwindcss** | +dev | **Adopt** | Medium |
| Git hooks | **Husky 9 + lint-staged** | +dev | **Adopt** | Medium |
| Commit lint | commitlint | +dev | **Optional** | Low |
| Types | **JSDoc + `checkJs` + CI `tsc --noEmit`** | +dev (tsc present) | **Adopt** | Medium |
| CSP | **SRI CSP (public) + nonce CSP (dynamic)** | 0 | **Adopt** | High |
| Error monitoring | Sentry | +1 | **Optional** | Medium |
| Web Vitals | `useReportWebVitals` | 0 | **Adopt** | Low |
| Bundle analysis | `@next/bundle-analyzer` | +dev | **Adopt** | Low |

### B.1 Schema validation — **Adopt Zod 4** (the one new runtime dependency this plan endorses)
The single most valuable addition. The app currently validates **only on the client** with hand-rolled `{ok,value}` validators; Server Actions forward raw input to the backend, so any direct action call bypasses validation. Schema validation pays off **even in plain JS** — the value is *runtime* validation of untrusted `FormData` and untyped backend JSON, plus one source of truth for client UX + server enforcement + error messages. The official Next.js auth guide uses Zod in its plain-`.js` samples.
- **Why Zod over Valibot/ArkType:** best ergonomics and ecosystem; `error.flatten().fieldErrors` maps cleanly to `useActionState`. Valibot (~1.4 kB) is the fallback only if client bundle becomes a hard constraint (swappable via Standard Schema). ArkType is too heavy for a JS project.
- **Pattern:** one schema per input (e.g. `phoneSchema`, `reviewSchema`, `bookingSelectionSchema`) in `lib/schemas/`. The Server Action runs `schema.safeParse()` authoritatively; the client reuses the same schema for instant feedback. This replaces `lib/validation.js` entirely.

### B.2 Forms — **Adopt React 19 native; reject react-hook-form for now**
`useActionState`/`useFormStatus`/`useOptimistic` are **completely unused** today (0 occurrences) — every form is hand-rolled `useState` + manual `isSubmitting`/`error`. React 19 native forms are zero-dependency, progressively enhanced, and remove that boilerplate. Given the forms here are small (phone, OTP, name, review, coupon), **native + Zod is sufficient** and aligns with the minimal-dependency ethos. react-hook-form is a well-justified *option* only if a future form grows many fields with cross-field validation — its TS-generics weakness is moot in JS, so it remains a clean fallback, but adopting it now would be premature.

### B.3 Data layer & Auth — **Adopt roll-your-own DAL; reject auth libraries**
The backend already issues JWT access+refresh tokens in httpOnly cookies. Auth.js v5 (still **beta-only on npm** — `npm i next-auth` installs v4) and better-auth both want to *own* identity/sessions, duplicating the existing authority. The official, lowest-dependency pattern is exactly what this app should build: a `cache()`-wrapped `verifySession()` in a DAL, called from RSC/Actions/Route Handlers, with resource-level ownership checks. This is detailed in [04](./04-api-server-action-service-review.md) and [05](./05-proposed-architecture-and-adrs.md). `jose` is an optional nicety for JWT `exp` reads, but the current hand-decode in `lib/auth.js` is adequate (it only reads `exp`; the backend verifies signatures).

### B.4 Server/URL/global state — **mostly native; nuqs optional; reject Zustand for now**
- **Server state:** RSC + Server Actions + `useActionState` covers venue browsing, dashboards, and admin tables. No client data library needed app-wide.
- **Live availability:** the one surface with genuine client-owned server state is slot-availability polling (`useBookingStatusPoll` + the booking page's client re-fetch). TanStack Query v5 would give cleaner polling/optimistic primitives, but it is **optional** — the existing custom hook works and the minimal-dep ethos argues against adding it until the live surface grows. If adopted, scope it to availability only (prefetch-on-server → `HydrationBoundary` → `useQuery`).
- **URL state:** `nuqs` is a good **Medium-priority optional** for admin-table filters/sort/pagination and the booking date — these belong in the URL (shareable, SSR-able) rather than `useState`. `useTable` currently holds all of this in client state.
- **Global store:** not justified. The booking wizard's cross-step state can be a `useReducer` inside a decomposed `BookingClient`. Add Zustand later only if that proves insufficient.

### B.5 Styling — **keep what exists; reject shadcn/CVA churn**
Tailwind 4 CSS-first `@theme` tokens + `cn()` are already the recommended modern setup. The existing `Button`/`Form` primitives are clean and cover current needs. Wholesale shadcn/ui adoption or a CVA refactor would be churn against a working design system with no measurable benefit — **reject for now**. CVA becomes worth it only if a primitive grows 2+ independent style axes (e.g. `Button` gaining `size` × `variant` × `state`). The one concrete styling fix is unrelated to libraries: move the hero LCP image off CSS `background-image` onto `next/image`, and consolidate the second font into a layout.

### B.6 Testing — **keep `node:test` for logic, add Playwright + Vitest for the gaps**
The native `node:test` suite is a good fit for pure logic (RBAC, validation, normalizers, resolver) and aligns with the team's no-Jest stance — **keep it**. The real gaps are (1) **no E2E** for the critical flows (login/OTP, booking → payment, admin auth) and (2) **no component tests**.
- **Playwright 1.61 (High):** the right tool for E2E, and — per official Next.js guidance — the recommended way to test **async Server Components** and full Server Action flows (Vitest does not support async Server Components). Run against `next build && next start`.
- **Vitest 4 + RTL 16 (Medium):** for client components and sync logic that needs a DOM. Vitest (Vite-native, zero Babel/ts-jest config) is preferred over Jest and keeps the dependency surface smaller. Server Action *logic* should be extracted into plain functions and unit-tested by mocking the DAL.

### B.7 Types — **JSDoc + `checkJs`, not TypeScript** (honoring the JS standard)
The brief mandates JavaScript, so a TypeScript migration is out of scope. The pragmatic substitute: enable `checkJs: true` in `jsconfig.json` (TypeScript is already an installed devDependency), annotate the DAL, schemas, and domain libs with JSDoc `@param`/`@typedef`, and wire `tsc --noEmit --allowJs --checkJs` into pre-commit/CI so type errors actually block. This delivers most of TypeScript's safety on the highest-risk modules (auth, data layer, payments) **without a build-step change or violating the JS standard**. The honest caveat: JSDoc is more verbose and its enforcement is opt-in — which is exactly why the CI `tsc` gate is non-negotiable if we go this route.

### B.8 Security — **Adopt CSP + HSTS + full headers**
Currently there is **no CSP** on the app (only a minimal `frame-ancestors` on three auth pages) and **no HSTS**. Recommended split, because nonce-based CSP forces dynamic rendering (incompatible with the PPR we want on public pages):
- **Public, cacheable pages (landing, marketing, venue):** hash-based **SRI CSP** via `experimental.sri: { algorithm: 'sha256' }` — keeps static generation/CDN while enforcing a strict policy.
- **Already-dynamic authenticated surfaces (dashboard, admin, checkout):** **nonce-based CSP** generated per request in `proxy.js` (the dynamic-render cost is already paid there).
- Add the full header set in `next.config` `headers()`: HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (allow `geolocation=(self)` since the venue map may need it), and rely on CSP `frame-ancestors 'none'` for clickjacking (drop the deprecated `X-XSS-Protection`).
- Keep default same-origin Server Action CSRF; set `serverActions.allowedOrigins` if deployed behind a proxy domain. Never place secrets in `NEXT_PUBLIC_` (they are inlined into the client bundle at build).

> Source: [content-security-policy guide](https://nextjs.org/docs/app/guides/content-security-policy)

### B.9 Tooling & observability — **Prettier/Husky now; Sentry optional**
- **Prettier 3.9 + prettier-plugin-tailwindcss** (auto-sorts classes), **Husky 9 + lint-staged** (lint/format/`tsc` on staged files), optional **commitlint** — high DX value, low cost. Note `next lint` was removed in Next 16; the project already runs ESLint directly (`"lint": "eslint"`), which is correct. ESLint can stay on 9 or bump to 10 (flat config is unchanged).
- **`useReportWebVitals`** in a tiny client component in the root layout (zero deps) — cheap RUM. **`@next/bundle-analyzer`** for CI bundle tracking. **Sentry** is a reasonable Medium-priority option for a payments app (source-mapped errors), but it adds a dependency and setup — defer unless error visibility is a current pain.

### B.10 Maps — **keep the current approach; note the v8 entry point**
The lazy, `ssr:false`, in-view-gated map is already the correct pattern. One forward-looking note from research: `react-map-gl` v8 splits per-library entry points (`react-map-gl/maplibre`) and **obsoletes the old `mapbox-gl` webpack alias** — confirm `MapCore` imports from `react-map-gl/maplibre` and `maplibre-gl/dist/maplibre-gl.css`, and that no `mapbox-gl` alias remains in config. No action beyond verification.

---

## C. What this means for the plan

- **One new runtime dependency** is endorsed: **Zod**. Everything else is either native (React 19 forms, DAL, CSP), dev-only (Playwright, Vitest, Prettier, Husky), or explicitly optional/deferred (TanStack Query, nuqs, Zustand, Sentry, react-hook-form, CVA, shadcn).
- This restraint is deliberate and matches the team's philosophy. The architecture problems here are **structural, not tooling** — they are solved primarily by *removing* the inverted `api.js → actions` indirection and *adding* a DAL, not by adding frameworks.
- The full target architecture and the decision records are in [05-proposed-architecture-and-adrs.md](./05-proposed-architecture-and-adrs.md); the sequencing is in [06-implementation-plan.md](./06-implementation-plan.md).
