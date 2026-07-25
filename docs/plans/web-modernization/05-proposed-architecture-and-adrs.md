# 05 — Proposed Architecture & Decision Records

The target architecture, dimension by dimension, followed by Architecture Decision Records (ADRs) in the repo's existing ADR style (`docs/adrs/`). Each major recommendation states the current implementation, alignment with best practice, alternatives, justification, trade-offs, and a priority.

> **Historical plan record.** The proposed target below was written before implementation and is retained for traceability. The accepted and implemented decisions are recorded in `docs/adrs/` and the AI context documents.

The guiding principle: **keep the folder structure and the good parts; fix the data, auth, and cache mechanics.**

---

## 1. Target architecture by dimension

### 1.1 Application & folder structure — *unchanged*
The route groups and `components/{features,layout,shared,seo}` + `lib` + `hooks` + `config` layout stay. The only additions are **new subfolders inside `lib`**: `lib/dal/`, `lib/services/`, `lib/schemas/`. No route reorganization.

### 1.2 Data layer — *DAL for reads, services for orchestration*
As specified in [04 §5](./04-api-server-action-service-review.md): `lib/dal/*` cacheable reads + the auth boundary; `lib/services/*` for multi-step domain logic; `lib/dal/httpClient.js` as the transport (the current `apiClient.js`) with refresh-on-401; delete `lib/api.js`. Server Actions move to a **route-independent** `lib/actions/*` (ADR-W009); **nothing in `components/`, `lib/`, or `hooks/` imports from `@/app/`** — the dependency direction is one-way (`app/` → inner layers).

### 1.3 Server/Client boundaries — *push client boundaries to leaves*
Keep Server Components as the default. Decompose `BookingClient` so that only the genuinely interactive parts (slot grid, coupon input, checkout button, auth modal) are client; the venue hero/header become server. Target: fewer, smaller client islands, less hydration. (37 client files today is acceptable; the goal is *smaller* islands, not necessarily fewer files.)

### 1.4 Rendering & caching — *real PPR*
- `cacheComponents: true` stays **on**.
- Public, slow-changing reads (venue/court config, marketing) → `"use cache"` + `cacheTag('venue:'+slug)` + a `cacheLife('hours'|'days')` profile.
- Per-user and time-sensitive reads (availability, bookings, wallet, session) → **uncached**, wrapped in `<Suspense>` so the cached shell streams first.
- Mutations call `revalidateTag(tag, 'max')` for shared data and `updateTag(tag)` for read-your-own-writes.
- `apiClient` drops the blanket `no-store`; cache policy is decided per DAL function.

### 1.5 Authentication & authorization — *DAL is the boundary*
- `lib/dal/session.js`: `verifySession()` (`cache()`-wrapped) reads the cookie, calls `/users/me`, returns a minimal DTO with **role/permissions derived from the API response** (not the cookie). `requireUser()` / `requirePermission(permission)` / `requireOwnership(resource)` helpers.
- Every **page** that needs protection calls the appropriate DAL guard with the **real path/permission** (fixes CR-1); every **owned-resource read** does an ownership check (fixes CR-2); every **mutation action** calls `verifySession()` first (fixes HI-14).
- `proxy.js` keeps **optimistic** cookie redirects + token refresh, but is no longer the authoritative gate. `canAccessRoute` becomes **fail-closed** for protected prefixes.
- Token refresh: keep proxy refresh; add refresh-on-401 in `httpClient` for client-invoked actions (closes HI-9). Derive admin status from `/users/me`; clear `pb_admin_role` on demotion (closes HI-10).

### 1.6 Validation — *one schema, both sides*
`lib/schemas/*` Zod schemas replace `lib/validation.js`. The Server Action `safeParse`s authoritatively; the client reuses the schema for instant UX via `useActionState`.

### 1.7 Forms — *React 19 native*
Migrate all forms to `<form action>` + `useActionState` + `useFormStatus`, removing hand-rolled `useState`/`isSubmitting`/`error`. Field-level errors come from `error.flatten().fieldErrors`. `FormField` auto-wires `id`/`htmlFor`/`aria-describedby`/`aria-invalid`.

### 1.8 Error handling — *one contract + boundaries*
One typed result shape across DAL/services/actions ([04 §5.3](./04-api-server-action-service-review.md)). Add `(booking)/loading.js` and `app/global-error.js`. The resolver branches on `status`/`code`, not message strings.

### 1.9 SEO & accessibility — *close the gaps*
Standardize indoor/outdoor copy; PNG OG logo; one JSON-LD venue node; encode OG query; `viewport`/`themeColor`; finish form-field a11y wiring; verify focus order and the `useOverlay` focus trap on every modal; ensure a skip link in the root layout.

### 1.10 Performance — *LCP + fonts + bundle*
Hero via `next/image` `fill priority`; consolidate fonts in a layout; keep the lazy map; add `useReportWebVitals` and `@next/bundle-analyzer`.

### 1.11 Testing — *broaden the pyramid*
Keep `node:test` for pure logic (extend to services/DAL with injected fetch). Add Playwright for the critical E2E flows and async Server Components; add Vitest + RTL for client components.

### 1.12 Security — *CSP + HSTS + headers*
SRI CSP on public pages, nonce CSP on dynamic surfaces, HSTS, full header set, `sameSite:"strict"` for admin/refresh cookies, `safeNext()` redirect guard.

### 1.13 Tooling — *format + hooks + types*
Prettier + prettier-plugin-tailwindcss; Husky + lint-staged; `checkJs` + CI `tsc --noEmit`; correct the README.

---

## 2. Architecture Decision Records

> These follow the format of `docs/adrs/ADR-001..009`. They are proposed (not yet approved). Numbering continues the web-scope sequence as `ADR-W001…` to avoid colliding with the backend ADRs.

### ADR-W001: Introduce a Data Access Layer; stop using Server Actions for reads

**Status:** Proposed

**Context:** Reads are modeled as POST-only Server Actions wrapped by `lib/api.js`, which imports those actions (inverted dependency) and re-throws their `{success,error}` contract. This blocks caching, fragments error handling, and contradicts Next.js 16 guidance (Server Actions are for mutations; reads belong in cacheable async functions / a DAL).

**Decision:** Create `lib/dal/*` containing cacheable async read functions that call the transport (`lib/dal/httpClient.js`) directly, with `"use cache"`+`cacheTag` on public reads and `<Suspense>` for dynamic reads. Server Actions are mutation-only. Delete `lib/api.js` and the read actions.

**Alternatives considered:**
| Alternative | Trade-off |
|---|---|
| Keep reads as Server Actions | Uncacheable, serialized POSTs; violates Next.js 16; blocks PPR |
| Full internal BFF (all data via Route Handlers) | Extra HTTP hop for server reads; more boilerplate; over-engineered for a web-first app |
| DAL for reads + actions for mutations (**chosen**) | Matches Next.js 16; one read path, one mutation path; some refactor cost |

**Consequences:** Reads become cacheable (unlocks PPR); dependency graph points the right way; one error contract; the resolver calls the DAL instead of `import("./api.js")`. Breaking change to internal call sites (no external consumers — safe per ADR-005).

**Priority:** Critical.

---

### ADR-W002: The DAL is the authorization boundary; proxy is optimistic-only

**Status:** Proposed

**Context:** Authorization is enforced in layouts via `requireRouteAccess` called with a **static** path, so the permission table fail-opens; `(booking)` routes have no guard; the proxy is leaned on as a real gate. Next.js 16: *"perform security checks as close as possible to your data source"*; *proxy "should not be used as a full authorization solution."*

**Decision:** Move authoritative authz into `lib/dal/session.js` (`verifySession`/`requirePermission`/`requireOwnership`), invoked from pages, owned-resource reads, and every mutation action with the **real** path/permission/resource. `canAccessRoute` becomes fail-closed for protected prefixes. The proxy keeps optimistic redirects + refresh only. Role/permissions are derived from `/users/me`, not the cookie.

**Alternatives considered:**
| Alternative | Trade-off |
|---|---|
| Keep authz in layouts | Layouts don't re-render on navigation; static-path bug; not the data boundary |
| Authz in the proxy | Explicitly discouraged; can't do resource-level checks; runs on prefetches |
| Authz in the DAL (**chosen**) | Correct boundary; defense-in-depth; minor per-call verbosity |

**Consequences:** Closes CR-1, CR-2, HI-14, HI-10. Slightly more code per protected read/action (a `requireX()` call), which is the point.

**Priority:** Critical.

---

### ADR-W003: Adopt Zod for one shared client/server validation schema

**Status:** Proposed

**Context:** Validation is hand-rolled (`lib/validation.js`) and **client-only**; Server Actions forward raw input; direct action calls bypass all validation.

**Decision:** Add **Zod** (the only new runtime dependency this plan endorses). Define one schema per input in `lib/schemas/*`; the Server Action `safeParse`s authoritatively; the client reuses it for UX. Replace `lib/validation.js`.

**Alternatives considered:**
| Alternative | Trade-off |
|---|---|
| Keep hand-rolled validators | Client-only, bypassable, duplicated, no shared error shape |
| Valibot | Smaller bundle, but weaker ecosystem; reconsider only if client bundle is a hard limit (swap via Standard Schema) |
| Zod (**chosen**) | Best ergonomics/ecosystem; `flatten().fieldErrors` maps to `useActionState`; pays off even in JS (runtime validation of untrusted input) |

**Consequences:** Closes HI-2; one validation source; typed errors. One dependency added — justified.

**Priority:** High.

---

### ADR-W004: Make caching opt-in per read; invalidate via tags

**Status:** Proposed

**Context:** `cacheComponents: true` is on but `apiClient` forces `no-store` everywhere and no tags exist — the app pays PPR's constraints for no benefit; venue is double-fetched; the booking route doesn't stream.

**Decision:** Remove the blanket `no-store`; decide cache policy per DAL function. Cache+tag public reads (`venue:slug`) with a `cacheLife` profile; leave user/time-sensitive reads uncached behind `<Suspense>`. Mutations call `revalidateTag`/`updateTag`. Dedupe shared reads with `react.cache()`.

**Alternatives considered:**
| Alternative | Trade-off |
|---|---|
| Keep `no-store` everywhere | No PPR benefit; double fetches; no streaming |
| Turn `cacheComponents` off | Loses the future caching/PPR path; still no streaming wins |
| Per-call caching + tags (**chosen**) | Real PPR; needs disciplined tag/invalidation design |

**Consequences:** Closes HI-3, HI-6; enables HI-4; faster booking/landing. Requires a tag taxonomy and `revalidateTag` discipline in mutations.

**Priority:** High.

---

### ADR-W005: Migrate forms to React 19 actions; decompose `BookingClient`

**Status:** Proposed

**Context:** React 19 form primitives are unused; forms are hand-rolled; `BookingClient` is a 410-line god component that also orchestrates the checkout transaction client-side.

**Decision:** Adopt `<form action>` + `useActionState` + `useFormStatus` (with Zod). Move the hold→waiver→pay transaction into `lib/services/checkout.js` behind one `checkoutBookingAction`. Split `BookingClient` into a selection reducer hook + presentational subcomponents.

**Alternatives considered:**
| Alternative | Trade-off |
|---|---|
| Keep hand-rolled forms | More code/bugs; worse progressive enhancement; duplicated validation |
| Add react-hook-form now | Premature for these small forms; extra dependency |
| React 19 native + Zod (**chosen**) | Zero new deps; server-enforced; cleaner | 

**Consequences:** Closes HI-11, HI-12, HI-13; testable checkout; smaller client islands.

**Priority:** High.

---

### ADR-W006: Add CSP (single static, SRI-backed) + HSTS + full headers

**Status:** Accepted (implemented)

**Context:** No CSP on the app; no HSTS; `secure` gated on `NODE_ENV`; deprecated `X-XSS-Protection`.

**Decision:** A **single static, SRI-backed CSP** applied uniformly to every route via `next.config.mjs` `headers()`, plus `experimental.sri: { algorithm: 'sha256' }` so every emitted script carries an `integrity` hash. Add HSTS (`max-age=63072000; includeSubDomains; preload`) and the full header set; drop `X-XSS-Protection`; `sameSite:"strict"` for admin/refresh markers; `secure` derived from HTTPS (not `NODE_ENV`); `safeNext()` redirect guard. The CSP is centralized in a framework-free `lib/csp.js` builder.

**Deviation from the original "nonce-for-dynamic" proposal (documented):** The original ADR proposed nonce-based CSP on the "already-dynamic" authenticated surfaces. That assumed those routes were fully dynamic. Under ADR-W004 the app runs `cacheComponents: true`, so **every** route is Partial-Prerendered or static — there are no fully-dynamic routes. The official Next.js CSP guide is explicit that **nonce-based CSP requires dynamic rendering and is incompatible with PPR** ("static shell scripts won't have access to the nonce"). Injecting a per-request nonce from `proxy.js` would break the prebuilt PPR shells at runtime. The same guide names SRI as the mechanism that *preserves* SSG/PPR while enforcing a strict policy. We therefore adopt SRI uniformly and keep the proxy focused on optimistic auth/refresh (ADR-W002). `script-src` retains `'unsafe-inline'` for Next's inline RSC-bootstrap scripts (whose per-stream hashes can't be enumerated at config time); the residual risk is bounded by SRI integrity on all external scripts and a strict `connect-src` allowlist that blocks exfiltration.

**Alternatives considered:**
| Alternative | Trade-off |
|---|---|
| Nonce CSP on authenticated routes | Incompatible with PPR (this app is PPR-everywhere); breaks prebuilt shells at runtime |
| No CSP (status quo) | No XSS backstop for a payments app |
| Single static SRI-backed CSP (**chosen**) | Strict policy that preserves SSG/PPR and CDN caching; `'unsafe-inline'` on script-src is the accepted residual, mitigated by SRI + `connect-src` |

**Consequences:** Closes CR-5, HI-1, HI-8, LO-11, LO-12; adds CSP-maintenance discipline (allowlists for PhonePe, MapTiler, the API); one policy to maintain instead of two.

**Priority:** High (CR-5 is Critical).

---

### ADR-W007: Type-safety via JSDoc + `checkJs`, not a TypeScript migration

**Status:** Proposed

**Context:** The project standard mandates JavaScript. TypeScript is installed (devDep) but unused; there is no type-checking.

**Decision:** Enable `checkJs: true` in `jsconfig.json`; annotate the DAL, schemas, and domain libs with JSDoc; enforce `tsc --noEmit --allowJs --checkJs` in pre-commit/CI. Do **not** migrate to TypeScript (honors the JS standard).

**Alternatives considered:**
| Alternative | Trade-off |
|---|---|
| Migrate to TypeScript | Violates the JS standard for this project; larger change |
| No types at all | Higher defect risk in auth/payments/data layers |
| JSDoc + `checkJs` + CI `tsc` (**chosen**) | Most of TS's safety, no build-step change, honors the standard; more verbose, enforcement only via the CI gate |

**Consequences:** Type safety on the highest-risk modules without violating the standard. The CI `tsc` gate is mandatory or the checks are toothless.

**Priority:** Medium.

---

### ADR-W008: Testing pyramid — keep `node:test`, add Playwright + Vitest

**Status:** Proposed

**Context:** Good `node:test` pure-logic suite; no component tests, no E2E; one RBAC test gives false confidence by calling the function with the real path the app never passes.

**Decision:** Keep `node:test` for pure logic (extend to services/DAL with injected fetch). Add **Playwright** for critical E2E flows (login/OTP, booking→payment, admin auth, RBAC enforcement) and async Server Components. Add **Vitest + RTL** for client components. Add an E2E test that asserts a `staff` user is **denied** `/admin/settings` (would have caught CR-1).

**Alternatives considered:** Jest (ESM friction, against the no-Jest ethos); Cypress (WebKit gap, paid parallelization). Both rejected.

**Consequences:** Real coverage of the flows the unit tests can't reach; dev-only dependencies.

**Priority:** Medium (Playwright High for the auth/checkout flows).

---

### ADR-W009: Server Actions live in a route-independent module; reusable layers never import from `@/app/`

**Status:** Proposed

**Context:** 10 files in `components/` and `lib/` import Server Actions from route segments (`@/app/(auth)/actions`, `@/app/(booking)/venues/[slug]/book/actions`, …). This inverts the dependency direction (inner, reusable layers depending on the outermost routing layer), couples reusable components to specific routes, and produces the near-circular graph that forces `bookingResolver.js` to use a dynamic `import("./api.js")`. The actions are **shared** across many components and route groups, so co-locating them in a single route segment is arbitrary.

**Decision:** Establish the rule: **`app/` is the outermost layer; `components/`, `lib/`, `hooks/`, `config/` must never import from `@/app/`.** Move all Server Actions into a route-independent `lib/actions/*` (`"use server"`), grouped by domain (`auth.js`, `booking.js`, `review.js`). Both `app/` route files and components import from `@/lib/actions/*`. Enforce permanently with an ESLint `no-restricted-imports` boundary (ESLint core — no new dependency) banning `@/app/*` and relative `app` paths from `src/{components,lib,hooks}/**`.

**Alternatives considered:**
| Alternative | Trade-off |
|---|---|
| Keep actions co-located in route segments | Idiomatic only for single-route actions; here actions are shared → couples components to routes, inverts dependencies, near-circular graph |
| Top-level `src/actions/` directory | Equivalent and discoverable, but adds a new top-level folder; `lib/actions/` reuses the existing `lib/` convention with zero restructuring |
| Route-independent `lib/actions/*` (**chosen**) | Clean one-way dependency; consistent with existing `lib/` (DAL, services, schemas); lint-enforceable |

**Consequences:** Closes ME-19; removes all `@/app/` imports from reusable code; reinforces ADR-W001 (the `app/` tree stops behaving like a library). Every component/route imports mutations from one predictable place. A lint rule prevents regression.

**Priority:** High (closely tied to ADR-W001; land them together in Phase 2).

---

## 3. Non-goals (explicitly out of scope)

To avoid scope creep and unnecessary churn, this plan **does not** recommend:
- Reorganizing the folder/route structure (it's good).
- TypeScript migration (the standard is JavaScript).
- Adopting shadcn/ui, CVA, Zustand, react-hook-form, TanStack Query, nuqs, or Sentry **now** (each is optional/deferred per [01](./01-research-and-technology-evaluation.md)).
- Replacing the design system, the map approach, or the `node:test` runner.
- Rewriting the backend or changing the cookie/JWT token model.
