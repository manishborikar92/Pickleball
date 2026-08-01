# 02 — Current Architecture Assessment

> **Historical plan record.** This assessment describes the pre-implementation baseline and is retained for traceability. See `docs/ai/01-IMPLEMENTATION-OVERVIEW.md` and `docs/ai/02-CODEBASE-MAP.md` for the implemented state.

An objective, layer-by-layer description of how `web/` is built today, with an honest verdict on each layer. The goal is to separate what is already modern and correct (and must be preserved) from what is not.

Stack (verified against installed `node_modules`):

| Package | Version | Notes |
|---|---|---|
| next | 16.2.6 | App Router, `cacheComponents: true`, `proxy.js` (renamed middleware) |
| react / react-dom | 19.2.4 | Server Components, Server Actions, `cache()` |
| tailwindcss | 4.3.0 | CSS-first `@theme` config |
| tailwind-merge | 3.6.0 | via `cn()` |
| clsx | 2.1.1 | via `cn()` |
| lucide-react | 1.14.0 | icons |
| maplibre-gl | 5.24.0 | WebGL map engine (heavy) |
| react-map-gl | 8.1.1 | React wrapper for maplibre |
| react-intersection-observer | 10.0.3 | in-view gating for the map |
| eslint | 9.39.4 | flat config + `eslint-config-next` |
| typescript | 6.0.3 | **devDependency only**; project uses `jsconfig.json`, not `tsconfig.json` |

148 source files, ~10k LOC. 37 files carry `"use client"` (~26% of components).

---

## 1. Routing & layouts — **Good, keep**

Route groups cleanly separate concerns and rendering posture:

- `(marketing)/` — landing, about, privacy, terms, support. Mostly static.
- `(booking)/` — `venues/[slug]/book`, `booking/[bookingId]`, `booking/error`, `review/[bookingId]`. Dynamic.
- `(auth)/` — `login`, `onboarding`, `admin/login`. Static shell + client form.
- `(dashboard)/` — `overview`, `bookings`, `wallet`. Auth-gated, dynamic.
- `(admin)/` — `overview`, `bookings`, `schedule`, `pricing`, `courts`, `users`, `settings`. Auth-gated.

Error boundaries are present per group (`(marketing)/error.js`, `(booking)/error.js`, `(dashboard)/error.js`, `(admin)/error.js`, root `error.js`) and are well-tailored. `loading.js` exists for root, `(dashboard)`, and `(admin)` with decent skeletons.

**Gaps (not structure problems):** `(booking)` previously had no route-specific `loading.js` despite being the most latency-sensitive route (resolved by adding `venues/[slug]/book/loading.js`); there is **no `app/global-error.js`** to catch root-layout/font errors; `not-found.js` exists only at root.

**Verdict:** The structure is modern and correct. Do not reorganize. Fill the `venues/[slug]/book/loading.js`/`global-error.js` gaps.

---

## 2. Rendering & caching — **Internally contradictory, fix**

`cacheComponents: true` is enabled, which turns on Partial Prerendering and the `"use cache"` directive and imposes its constraint (every uncached dynamic access must be inside a cache scope or a Suspense boundary). The codebase then:

- Hard-codes `cache: "no-store"` on every backend request (`lib/apiClient.js:47`).
- Uses `"use cache"` in exactly two places (`(marketing)/page.js:126`, `sitemap.js:4`) — both on content that fetches no data.
- Uses `await connection()` as a blunt "make this whole route dynamic" opt-out (`book/page.js:25`, both protected layouts, `api/og/route.js:6`) instead of wrapping dynamic holes in Suspense.
- Has **zero** `cacheTag`, `cacheLife`, `revalidateTag`, or `revalidatePath` calls.

Consequences: nothing is cached, so PPR delivers no benefit while still imposing its constraints; `getVenue(slug)` (essentially static venue config) is fetched twice per booking page load — once in `generateMetadata`, once in the body — with no `react.cache()` dedupe; the booking page blocks on sequential `venue → availability` fetches with **no Suspense streaming**; and there is no invalidation path to ever cache anything safely.

**Verdict:** This is the highest-leverage performance fix. The cache must become *opt-in per call* (static reads cached + tagged, user-scoped/mutating reads `no-store`), paired with `revalidateTag` in mutations.

---

## 3. Auth / session / RBAC — **Sound design, broken enforcement, fix**

The intended model (documented in `web/README.md`) is a good one:

1. **`proxy.js`** (Next.js 16's renamed middleware) does proactive token refresh and coarse cookie-presence route guards at the edge.
2. **Server layouts** call `getSession()` (memoized with React `cache()`), which reads cookies and hits `/api/v1/users/me`.
3. **`requireRouteAccess()`** asserts authn + RBAC and redirects.
4. **`apiClient.js`** is stateless; tokens are passed explicitly.

The pure split is excellent: `lib/auth.js` is framework-free (safe in proxy, RSC, actions, tests); `auth.config.js` is pure constants; `apiClient.js` never touches cookies.

**But the enforcement is broken in three ways:**

- `requireRouteAccess` is called with a **static path** (`"/admin"`, `"/dashboard"`) from the layouts, so `canAccessRoute` looks up a non-existent table key and **fail-opens** (`lib/rbac.js:68` returns `true` for unknown paths). Fine-grained permissions are never enforced (`lib/session.js:56`, `(admin)/layout.js:14`, `(dashboard)/layout.js:14`).
- Layouts do not re-render on client-side sibling navigation, so even a *correct* layout check would not re-run between `/admin/overview` and `/admin/settings`. Pages themselves carry **no** auth check.
- `(booking)` routes have **no layout** running `requireRouteAccess`, and the proxy matcher (`/login`, `/onboarding`, `/dashboard/:path*`, `/admin/:path*`, `/booking/:path*`) does **not** match `/venues/*` or `/review/*`.

Additionally, `role`/`permissions` in `getSession` are taken from the `pb_auth_role` cookie (`lib/session.js:34,42`) rather than the authoritative `/users/me` response, and the admin gate at the edge trusts the `pb_admin_role` cookie which is never reconciled on demotion.

**Verdict:** Keep the pure-module split and the proxy-refresh model. Replace layout-as-authz-boundary with a **Data Access Layer** that verifies session + authorization at the point of data access (the Next.js 16 recommendation), and derive role from the API response.

---

## 4. Data / API / service layer — **Inverted, fix** (see [04](./04-api-server-action-service-review.md))

Today's data flow for a read is:

```
page.js  →  lib/api.js (getVenue, re-throws)  →  Server Action (getVenueBySlugAction)  →  apiClient.apiRequest  →  backend
```

`lib/api.js` imports Server Actions from `app/(booking)/venues/[slug]/book/actions.js` and wraps them, inverting the dependency direction (a library depending on a route segment's actions). This is not isolated to `api.js`: **10 files** across `components/` and `lib/` import Server Actions from `@/app/...` route segments (see ME-19). `app/` is the outermost routing layer and reusable inner layers should never import from it; the fix is to relocate Server Actions to a route-independent `lib/actions/*` (ADR-W009). Every read is a Server Action (POST-only, uncacheable). Three error contracts coexist. The booking resolver must `await import("./api.js")` dynamically to stay testable. Normalization lives inside the actions, but the mutation actions (`createBookingHoldAction`, `initiateBookingPaymentAction`, …) return **raw snake_case** `payload.data`, so the client consumes `hold.booking_id` / `payment.redirect_url` inconsistently with the rest of the camelCase app. The multi-step checkout transaction (hold → waiver → initiate-payment + payment-mode branching) lives in the **client component** (`BookingClient.js:272-343`), not on the server.

**Verdict:** This is the second-highest-leverage fix. Introduce a DAL for reads, keep Server Actions for mutations only, move checkout orchestration into one server action, normalize mutation responses, and propagate `error.status` instead of string-matching messages.

The domain libraries themselves are good: `bookingEngine.js`, `bookingResolver.js` (a clean state machine), `normalizers.js` (the snake→camel boundary). Keep them; the resolver should call the DAL directly instead of `import("./api.js")`.

---

## 5. Components & UI — **Mostly good, one god component, forms outdated**

- **Shared primitives are solid:** `Button` (variant map, `href`/external/`Link` handling, focus-visible ring), `Form` (`FormField`/`Input`/`Select`/`Textarea`/`FormAlert` with `useId` and `role="alert"`), `EmptyState`, the `Table/*` system, the `Map/*` system. The `cn()` helper and Tailwind `@theme` tokens give consistent styling.
- **`BookingClient.js` is a 410-line god component** holding ~12 `useState`s, two data-fetching `useEffect`s (availability + price preview), the checkout orchestration, the auth-step machine, and the payment-gateway integration. It is the least maintainable file in the app and the biggest testability blocker.
- **React 19 form primitives are entirely unused** (`useActionState`/`useFormStatus`/`useOptimistic` = 0 occurrences). Every form is hand-rolled `useState` + manual `isSubmitting`/`error` + `onSubmit` calling an action and interpreting `{success}`. This is more code, more bugs, and worse progressive enhancement than the React 19 native pattern.
- **Form accessibility is partial.** `FormField` generates an `id` via `useId` but does not auto-wire `htmlFor`/`aria-describedby`/`aria-invalid`; inputs like `PhoneForm`'s rely on placeholder + a visually separate `FormAlert` not programmatically linked to the field.
- **`ReviewForm` has two real bugs:** it calls the broken `submitReview` action, and it uses `<Button asChild variant="outline">` — an API the `Button` component does not implement (only `primary/secondary/ghost/danger`, no `asChild`). The photo upload captures only a filename and never uploads anything (dead feature).
- **Hooks are reasonable:** `useOverlay` implements a real focus trap + scroll lock + Escape + focus restore; `useBookingStatusPoll` polls with a `setInterval`, tracks `onComplete` via ref (correct), but swallows all errors so a hard 401 spins until timeout; `useTable` is a competent client-side table engine (search/sort/filter/paginate/select) though it nests a `setState` inside another updater and depends on a `columns` array likely re-created each render.

**Verdict:** Keep the shared primitives and the design system. Decompose `BookingClient`. Adopt React 19 form actions and finish form a11y wiring. Fix the `ReviewForm`/`Button` API mismatch.

---

## 6. Styling — **Good, keep**

Tailwind 4 CSS-first config in `globals.css`: semantic CSS variables (`--background`, `--accent`, `--surface-*`, `--danger`) mapped into the theme via `@theme inline`, a dark "sports" aesthetic, custom keyframe animations, scrollbar utilities, safe-area padding. The `cn()` helper resolves class conflicts. This is modern and maintainable.

**Minor:** the `.court-hero` LCP background-image bypasses `next/image`; `Montserrat` is loaded inside `Header.js` (a component) rather than a layout, adding a second font payload off the central font setup. No `class-variance-authority` is used, but the `Button` variant map covers current needs.

---

## 7. Forms & validation — **Hand-rolled, client-only, fix**

`lib/validation.js` provides `validateName/Phone/Otp/Review/Coupon`, each returning `{ ok, value | message }`. They are called **only in client components**. **No Server Action re-validates anything.** There is no schema, no shared client/server validation, and no typed error shape. Because Server Actions are public POST endpoints, every validator is bypassable by a direct call.

**Verdict:** Replace the `{ok,value}` convention with a single schema per input (Zod), parsed authoritatively in the action and reused in the client via React 19 `useActionState`.

---

## 8. SEO & metadata — **Strong, minor fixes**

`metadataBase`, title templates, robots/googleBot directives, OpenGraph + Twitter, `appleWebApp`, the `getPageMetadata` helper, per-route `generateMetadata`, JSON-LD (`Organization`, `SportsActivityLocation`, `FAQPage`), `sitemap.js` (cached), `robots.js`, and a dynamic OG image route. This is well above average.

**Fixes:** an "indoor" vs "outdoor" keyword conflict across metadata files; the OG route embeds an SVG logo (Satori SVG support is unreliable — use PNG); the hand-written root-layout OG URL is not query-encoded (the helper encodes correctly); two `SportsActivityLocation` JSON-LD nodes with differing `priceRange`/`@id` for one venue; no explicit `viewport`/`themeColor` export; the review `<title>` leaks the booking UUID.

---

## 9. Performance — **One systemic + a few point issues**

- Systemic: the cache contradiction (§2) means everything is dynamic.
- LCP: the landing hero is a CSS `background-image` (`globals.css:60`) — unoptimized, no `priority`, no responsive `srcset`.
- The map is handled **well** (`dynamic(... { ssr:false })` gated by `useInView`), keeping ~200KB+ of WebGL off the initial paint.
- PhonePe checkout uses `<Script strategy="lazyOnload">` — correct.
- `next/image` and `next/font` (Geist) are used correctly elsewhere; the second font (`Montserrat` in `Header.js`) should move to a layout.

---

## 10. Testing — **Good baseline, narrow coverage**

`tests/core.test.js` uses the native `node:test` runner (16 cases) covering RBAC, validation, `bookingEngine`, `normalizers`, and `bookingResolver` (with dependency injection for the data fetch). This is a genuinely good pure-logic suite aligned with the team's no-Jest philosophy.

**Gaps:** no component tests, no Server Action tests, no integration/e2e. One test (`canAccessRoute("/admin/pricing", "manager")`) passes by calling the function with the *real* path — giving false confidence that RBAC is enforced, when the application calls it with a static `"/admin"`.

---

## 11. Configuration, tooling, DX — **Lean, a few gaps**

- ESLint 9 flat config extending `eslint-config-next/core-web-vitals` — good and current.
- **No Prettier**, no pre-commit hooks, no `lint-staged`, no CI config in-repo.
- TypeScript is installed but unused (the project is JS with `jsconfig.json` path aliases). There is no JSDoc-based type-checking (`checkJs`).
- `next.config.mjs` has good security headers but no CSP/HSTS (see [03](./03-issues-register.md)).
- `web/README.md` is **stale/incorrect** on two architecturally important points: it claims the proxy does "no token refresh" and that refresh happens "in `apiClient.js` on 401" — both are false (refresh is proactive in `proxy.js`; `apiClient` never refreshes).

---

## 12. Summary verdict

| Layer | Verdict | Action |
|---|---|---|
| Folder structure / route groups | Modern, correct | **Keep** |
| Pure `lib` split (`auth`, `apiClient`, config) | Excellent | **Keep**, extend with DAL |
| Domain libs (`bookingEngine`, `bookingResolver`, `normalizers`) | Good | **Keep**, repoint resolver to DAL |
| Styling / design tokens | Modern | **Keep** |
| SEO / metadata | Strong | Keep, minor fixes |
| Map / lazy loading | Correct | **Keep** |
| Test runner choice (`node:test`) | Good fit | **Keep**, broaden coverage |
| Authorization enforcement | Broken | **Rebuild** via DAL |
| Data layer direction (api.js → actions, reads as actions) | Inverted | **Rebuild** |
| Caching (`cacheComponents` vs `no-store`) | Contradictory | **Rebuild** policy |
| Forms / validation | Outdated + client-only | **Modernize** (React 19 + schemas) |
| CSP / HSTS / server validation | Missing | **Add** |
| `BookingClient` god component | Unmaintainable | **Decompose** |

The through-line: **the organization is right; the data, auth, and cache *mechanics* are wrong.** Fixing the mechanics — not the structure — is the work.
