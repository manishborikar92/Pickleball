# 06 — Implementation Plan

A phased, sequenced plan to execute the modernization. Each phase is independently shippable, lists the issue IDs it closes (from [03](./03-issues-register.md)), the concrete steps, the validation gate that must pass before merge, and the rollback note. Phases are ordered by dependency and risk: **security/correctness hot-fixes first, then the data-layer refactor that everything else builds on, then performance, forms, hardening, and tooling.**

**Conventions for the executing engineer:**
- Work on a feature branch per phase; the repo's default working branch is `dev`, PRs target `main`.
- Naming per the project standard: **PascalCase** for components/layouts/providers; **camelCase** for hooks/utilities/services/DAL/schemas/config; **kebab-case** only where Next.js dictates (route segments, special files). Do **not** rename documentation files.
- Every phase must keep `npm run lint`, `npm run test`, and `npm run build` green.
- Greenfield project (ADR-005): breaking internal changes are acceptable; there are no external consumers.

---

## Phase 0 — Critical hot-fixes (no architecture change)

**Goal:** stop the bleeding with small, low-risk, independently valuable fixes before the larger refactor. Closes the worst correctness/security defects without waiting on the DAL.

**Closes:** CR-3 (review), HI-7 (admin error handling), HI-8 (open redirect), CR-1 (partial — fail-closed RBAC), ME-12, LO-7, LO-8, ME-18 (README).

**Steps:**
1. **Fix `submitReview` (CR-3):** in `review/actions.js`, read the access token via `cookies().get(COOKIE_NAMES.ACCESS_TOKEN)` (as other actions do); gate on `session?.user`, not `session.accessToken`. Add a minimal inline validation for `rating`/`comment` (formalized to Zod in Phase 3).
2. **Fix `ReviewForm` Button usage (CR-3):** replace `<Button asChild variant="outline">` with valid `Button` usage (`<Button href="...">` / `variant="secondary"`). Remove or wire up the dead photo upload.
3. **`signInAdminAction` error handling (HI-7):** wrap in try/catch; return `{success:false,error}`; surface via the form (interim: keep current form wiring; full `useActionState` in Phase 4).
4. **Open-redirect guard (HI-8):** add `lib/safeNext.js` → `safeNext(next, fallback)` enforcing `startsWith("/") && !startsWith("//") && !startsWith("/\\")`; use it in `signInAdminAction` and the proxy.
5. **Fail-closed RBAC (CR-1 partial):** change `canAccessRoute` so unknown `/admin/*` and `/dashboard/*` prefixes **deny** instead of allow. (Full per-path enforcement lands with the DAL in Phase 2.)
6. **Copy/SEO quick wins:** standardize indoor/outdoor (ME-12); encode root OG query or route it through `getPageMetadata` (LO-7); drop the UUID from the review title (LO-8).
7. **Correct `web/README.md`** auth-model description (ME-18).

**Validation gate:**
- Manual: review submission succeeds end-to-end for a logged-in user; admin wrong-password shows an inline error, not a crash; `/admin/login?next=//evil.com` does not redirect off-site.
- `npm run test` green (add a `safeNext` unit test + a `canAccessRoute` fail-closed test).
- `npm run build` green.

**Rollback:** each step is isolated; revert per-commit.

---

## Phase 1 — Security headers, CSP, HSTS

**Goal:** establish the security backstop independently of the data refactor.

**Closes:** CR-5, HI-1, LO-9, LO-11, LO-12, ME-5.

**Steps:**
1. Add HSTS + tighten headers in `next.config.mjs` (`Strict-Transport-Security`, keep `nosniff`/`Referrer-Policy`, set `Permissions-Policy` to allow `geolocation=(self)`); drop deprecated `X-XSS-Protection` (LO-11).
2. **Public-page CSP:** enable `experimental.sri: { algorithm: 'sha256' }` and validate strict CSP on marketing/landing/venue pages (keeps SSG/PPR).
3. **Dynamic-surface CSP:** generate a per-request nonce in `proxy.js`, inject via `x-nonce` + the CSP header for dashboard/admin/checkout; allowlist `connect-src` for the API, PhonePe, MapTiler; `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
4. `secure: true` whenever HTTPS (HI-1); `sameSite:"strict"` for admin/refresh cookies (LO-12); add `serverActions.allowedOrigins` if deployed behind a proxy domain (ME-5); add `export const viewport` with `themeColor` (LO-9).

**Validation gate:**
- CSP report-only first: deploy with `Content-Security-Policy-Report-Only`, confirm **zero violations** across all routes (especially PhonePe checkout iframe + MapTiler tiles), then switch to enforcing.
- Lighthouse/security-headers scan shows CSP + HSTS present; no console CSP errors on the booking → payment flow.
- `npm run build` green.

**Rollback:** CSP can revert to report-only or be removed via `next.config`; headers are config-only.

**Risk:** a too-strict CSP can break the PhonePe iframe or map tiles → mitigated by the report-only rollout.

---

## Phase 2 — Data Access Layer + authorization boundary (the keystone)

**Goal:** the core refactor everything else depends on. Implements ADR-W001 + ADR-W002.

**Closes:** CR-4, CR-1 (full), CR-2, HI-14, HI-9, HI-10, ME-1, ME-2, ME-3, ME-6, ME-8, ME-9, ME-19, LO-1, LO-4, and unblocks Phase 3 (caching).

**Steps:**
1. **Create `lib/dal/httpClient.js`** from the current `apiClient.js`: keep the stateless `apiRequest`, but (a) propagate `error.status`/`code` in a typed error, (b) add **refresh-on-401** (call the backend refresh endpoint, set new cookies — valid because this runs in actions/route handlers) to close HI-9, (c) accept a per-call cache option instead of a hard-coded `no-store`.
2. **Create `lib/dal/session.js`:** `verifySession()` (`cache()`-wrapped) reads cookies, calls `/users/me`, returns a minimal DTO with **role/permissions from the API response** (HI-10). Add `requireUser()`, `requirePermission(pathnameOrPermission)`, `requireOwnership(resource, userId)`.
3. **Create read modules:** `lib/dal/venues.js`, `availability.js`, `bookings.js` (with ownership checks — CR-2), `wallet.js`, `admin.js` (replace the mock — ME-3). Move normalization here; extend normalizers to mutation responses (ME-2). Use `??` not `||` for numeric fields (LO-1).
4. **Repoint consumers:** pages/layouts call DAL reads; `bookingResolver.js` (moved to `lib/services/bookingStatus.js`) calls the DAL directly (drop `import("./api.js")`); the poll hook and `BookingClient` availability read call the DAL/actions consistently.
5. **Harden mutation actions:** each calls `verifySession()` + authorization first (HI-14); returns the single typed result shape; normalizes its response (ME-2).
6. **Enforce per-path RBAC (CR-1 full):** pages call `requirePermission` with the **real** path/permission; `(booking)` owned reads enforce ownership (CR-2).
7. **Relocate Server Actions to `lib/actions/*` and prune (CR-4, ME-19):** create route-independent `lib/actions/{auth,booking,review}.js` (`"use server"`) holding the **mutation** actions; update every component and route file to import from `@/lib/actions/*`; then delete `lib/api.js`, the **read** Server Actions, and the now-empty route-segment action files (`app/(auth)/actions.js`, `app/(booking)/venues/[slug]/book/actions.js`, `app/(booking)/review/actions.js`); remove the `wait()` mock indirection (LO-4). After this step, **nothing under `components/`, `lib/`, or `hooks/` imports from `@/app/`**.
8. **Single-flight note (ME-6):** document reliance on the backend's concurrent-refresh grace window; add a per-instance single-flight if feasible.

**Validation gate:**
- All existing `node:test` cases pass; **add** tests: `verifySession` DTO shape; `requirePermission` denies `staff` on `/admin/settings`; ownership check denies cross-user `getBooking`.
- Manual: a `staff` user is redirected away from `/admin/settings` and `/admin/pricing`; a customer cannot load another user's `/booking/[id]`; checkout still works after a 15-minute idle (refresh-on-401 fires).
- Grep confirms `lib/api.js` is gone, `lib/actions/*` exists, and **no file under `src/{components,lib,hooks}` imports from `@/app/`** (the new ESLint boundary rule from Phase 6 should pass).
- `npm run build` green; no `import("./api.js")` remains.

**Rollback:** large phase — land behind a branch with full E2E (Phase 7 can run first for the auth/booking flows to protect this). If issues arise, revert the branch; Phase 0's fail-closed RBAC still holds the line.

**Risk (highest in the plan):** touches auth + data + checkout. Mitigations: write the Playwright auth/booking/RBAC E2E (Phase 7) *before or alongside* this phase; ship behind a preview deploy; verify against a live backend (the `node:test` suite mocks the DB, so manual/E2E against staging is required).

---

## Phase 3 — Caching, streaming & performance

**Goal:** turn `cacheComponents` from liability into benefit (ADR-W004) and fix the user-facing perf issues. Depends on Phase 2 (the DAL is where cache policy lives).

**Closes:** HI-3, HI-4, HI-5, HI-6, ME-4, ME-10, LO-5, LO-10, plus Web Vitals tooling.

**Steps:**
1. **Cache policy in the DAL:** `getVenue` → `"use cache"` + `cacheTag('venue:'+slug)` + `cacheLife('hours')`; availability/bookings/wallet remain uncached. Dedupe `getVenue` with `react.cache()` (HI-6).
2. **Stream the booking route:** wrap availability in `<Suspense>`; add `(booking)/loading.js` (HI-4); remove the redundant client re-fetch for the server-provided `initialDate` (HI-4).
3. **Invalidate on mutation:** `revalidateTag('venue:'+slug)` / `updateTag` in the relevant actions.
4. **LCP hero (HI-5):** render `.court-hero` via `<Image fill priority>` with AVIF/WebP; remove the CSS background.
5. **Fonts (ME-10):** move `Montserrat` into the root layout (or drop it).
6. **Admin Suspense (ME-4):** add boundaries before real admin API wiring.
7. **Tidy:** drop needless `async` on static admin pages (LO-5); fix `MapCore` `window.innerWidth` read (LO-10).
8. **Tooling:** add `useReportWebVitals` (root client component) + `@next/bundle-analyzer`.

**Validation gate:**
- Lighthouse on `/` and `/venues/[slug]/book`: LCP improves (hero optimized), no layout shift; booking route shows a skeleton immediately on navigation.
- Network: `getVenue` fetched **once** per booking load; a venue mutation invalidates the cached read.
- Bundle analyzer: map chunk still lazy; no regression in shared chunk size.
- `npm run build` green.

**Rollback:** caching is per-DAL-function; revert individual `"use cache"` additions; the hero/image change is isolated.

---

## Phase 4 — Validation schemas + React 19 forms

**Goal:** one schema both sides (ADR-W003) and native forms (ADR-W005).

**Closes:** HI-2, HI-11, HI-12, HI-13, ME-13, ME-7.

**Steps:**
1. **Add Zod**; create `lib/schemas/*` (phone, otp, name, review, coupon, bookingSelection). Replace `lib/validation.js`; keep the same normalized outputs the tests assert (port the `node:test` cases to the schemas).
2. **Server-side validation (HI-2):** every mutation action `safeParse`s its input first; returns `error.flatten().fieldErrors`.
3. **Migrate forms (HI-11):** `PhoneForm`, `OtpForm`, `NameForm`, `ReviewForm`, `AdminLoginForm`, `CustomerOnboardingForm`, coupon → `<form action>` + `useActionState` + `useFormStatus`; reuse the schema client-side.
4. **Form a11y (ME-13):** `FormField` auto-wires `id`/`htmlFor`/`aria-describedby`/`aria-invalid`.
5. **Checkout service (HI-13):** move hold→waiver→pay into `lib/services/checkout.js` behind `checkoutBookingAction` returning a discriminated result; `BookingClient` only navigates.
6. **Decompose `BookingClient` (HI-12):** extract `useBookingSelection` reducer + presentational subcomponents; split client islands.
7. **Poll UX (ME-7):** distinguish 4xx (stop, error) from transient (retry) in `useBookingStatusPoll`.

**Validation gate:**
- A direct call to a mutation action with invalid input is rejected by the server (add an E2E/integration check).
- Forms work with JS disabled where Server Actions allow (progressive enhancement spot-check).
- Axe/Lighthouse a11y: form fields announce labels + errors; no critical violations.
- `npm run test` green (schema tests ported); `npm run build` green.

**Rollback:** migrate forms one at a time; each form is an isolated commit.

---

## Phase 5 — SEO, accessibility & error-UX polish

**Goal:** close the remaining Medium/Low gaps.

**Closes:** ME-11, ME-14, ME-15, ME-16, ME-17, LO-2, LO-3, LO-6, LO-13, remaining a11y items.

**Steps:**
1. OG PNG logo (ME-11); single canonical JSON-LD venue node (LO-6).
2. `app/global-error.js` (ME-14).
3. `useTable` sort/`columns` fix (ME-15).
4. Logout failure surfacing (ME-16); rate-limit/inline `getSessionAction` (ME-17); clear stale `pb_admin_role` on customer login (LO-13).
5. Domain edge cases: clamp `upiAmount` (LO-2); `buildDateWindow` via `formatToParts` (LO-3).
6. A11y sweep: focus order, `useOverlay` trap on every modal, skip link, heading order, contrast spot-check.

**Validation gate:** axe clean on key pages; OG card renders the logo (validator); `node:test` covers the clamped/`formatToParts` changes; `npm run build` green.

**Rollback:** all isolated.

---

## Phase 6 — Tooling & developer experience

**Goal:** lock in quality gates (ADR-W007, ADR-W009).

**Steps:**
1. Prettier 3.9 + `prettier-plugin-tailwindcss`; `npm run format`; align with `eslint-config-prettier/flat`.
2. Husky 9 + lint-staged: run lint + format + `tsc --noEmit` on staged files; optional commitlint.
3. `checkJs: true` in `jsconfig.json`; JSDoc-annotate the DAL/schemas/services; `tsc --noEmit --allowJs --checkJs` script.
4. **Module-boundary lint rule (ADR-W009 / ME-19):** add an ESLint `no-restricted-imports` override (ESLint core — no new dependency) that bans importing `@/app/*` (and relative `../app` paths) from `src/components/**`, `src/lib/**`, and `src/hooks/**`. This makes the "reusable layers never import from `@/app/`" rule self-enforcing and prevents regression after Phase 2. Example:

   ```js
   // eslint.config.mjs — add an override
   {
     files: ["src/components/**", "src/lib/**", "src/hooks/**"],
     rules: {
       "no-restricted-imports": ["error", {
         patterns: [{
           group: ["@/app/*", "@/app/**", "**/app/**/actions"],
           message: "Reusable modules must not import from app/. Import Server Actions from @/lib/actions/* instead (ADR-W009).",
         }],
       }],
     },
   }
   ```
5. CI workflow: `lint`, `test`, `tsc --noEmit`, `build`, Playwright; `npm audit` + Dependabot; optional Socket.
6. (Optional) bump ESLint 9 → 10 (flat config unchanged).

**Validation gate:** pre-commit blocks a deliberate type error, an unformatted file, **and an `@/app/*` import added to a component/lib/hook file**; CI runs all gates on a PR.

**Rollback:** tooling-only; hooks can be disabled.

---

## Phase 7 — Testing expansion (run in parallel; gate Phase 2)

**Goal:** real coverage of the flows unit tests can't reach (ADR-W008). Begin the **E2E for auth/booking/RBAC before Phase 2 merges** to protect the keystone refactor.

**Steps:**
1. Playwright (run against `next build && next start`): login/OTP, onboarding, booking → payment (sandbox), admin login, **RBAC denial** (a `staff` user is denied `/admin/settings` — would have caught CR-1), token-expiry checkout recovery.
2. Vitest + RTL: client components (forms, `SlotGrid`, `OrderSummary`, table).
3. Extend `node:test` to services/DAL with injected fetch.
4. Async Server Components covered by Playwright (per official guidance).

**Validation gate:** the RBAC-denial E2E is red on `dev` today (proving the bug) and green after Phase 2; the full E2E suite passes in CI.

---

## Migration strategy & sequencing summary

| Phase | Theme | Depends on | Risk | Closes (headline) |
|---|---|---|---|---|
| 0 | Critical hot-fixes | — | Low | CR-3, HI-7, HI-8, CR-1(part) |
| 1 | CSP/HSTS/headers | — | Low-Med | CR-5, HI-1 |
| 7a | E2E for auth/booking/RBAC | — | Low | (safety net) |
| 2 | **DAL + authz boundary** | 7a recommended | **High** | CR-4, CR-1, CR-2, HI-9/10/14 |
| 3 | Caching/streaming/perf | 2 | Med | HI-3, HI-4, HI-5, HI-6 |
| 4 | Schemas + React 19 forms | 2 | Med | HI-2, HI-11/12/13 |
| 5 | SEO/a11y/error polish | 2–4 | Low | ME/LO tail |
| 6 | Tooling/DX | — | Low | (quality gates) |
| 7b | Component/unit test expansion | 2–4 | Low | (coverage) |

Phases 0, 1, 6, and 7a can start immediately and in parallel. Phase 2 is the keystone; do not start 3/4/5 until it lands.

---

## Breaking changes (internal only — no external consumers, per ADR-005)

1. **`lib/api.js` removed.** All imports of `getVenue`/`getAvailability`/`getUserBookings`/`getWallet`/`getBookingById`/`getPaymentStatus` must move to `lib/dal/*`.
2. **Read Server Actions removed** from `book/actions.js`; client/server callers move to the DAL.
2b. **All Server Actions relocated to `lib/actions/*`** (ME-19/ADR-W009). Every `import … from "@/app/(…)/actions"` in components/lib (10 files) changes to `@/lib/actions/*`; the route-segment action files are deleted. A new ESLint boundary rule forbids `@/app/*` imports from `src/{components,lib,hooks}`.
3. **Session DTO source changes:** `role`/`permissions` now come from `/users/me`, not the cookie — requires the backend to include roles/permissions in that response (coordinate with `server/`).
4. **Error contract unified:** consumers that relied on `api.js` throwing, or on `{success,error}` from reads, adopt the single typed result.
5. **`lib/validation.js` replaced by `lib/schemas/*` (Zod).**
6. **Checkout moves server-side:** `BookingClient` no longer orchestrates hold→waiver→pay; it calls one `checkoutBookingAction`.
7. **`apiClient` cache default changes** from `no-store` to per-call policy.

---

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Phase 2 regresses auth/checkout | Med | High | Land E2E (7a) first; preview deploy; manual verification vs live backend (unit suite mocks the DB) |
| Backend doesn't return roles/permissions in `/users/me` | Med | High (blocks HI-10) | Coordinate with `server/` early; until then, derive cautiously and keep fail-closed RBAC |
| CSP breaks PhonePe iframe / MapTiler | Med | Med | Report-only rollout; explicit `connect-src`/`frame-src` allowlists |
| Over-caching leaks stale availability | Low | Med | Only cache venue config; availability stays uncached behind Suspense; tag-based invalidation |
| Single-flight refresh under horizontal scaling | Low | Med | Rely on documented backend grace window; add per-instance single-flight |
| Scope creep into optional libraries | Med | Low | Non-goals in [05 §3](./05-proposed-architecture-and-adrs.md) keep the surface minimal |

---

## Validation checklist (whole programme — done = all true)

- [ ] A `staff` user is denied `/admin/settings`, `/admin/pricing`, `/admin/courts` (CR-1) — proven by E2E.
- [ ] A customer cannot load another user's `/booking/[id]` or `/review/[id]` (CR-2).
- [ ] Review submission works end-to-end; review buttons render correctly (CR-3).
- [ ] No `lib/*` module imports Server Actions; reads go through `lib/dal/*` (CR-4).
- [ ] No file under `src/{components,lib,hooks}` imports from `@/app/`; Server Actions live in `lib/actions/*`; the ESLint boundary rule enforces it (ME-19/ADR-W009).
- [ ] CSP + HSTS present on all routes; report-only shows zero violations before enforcing (CR-5, HI-1).
- [ ] Every mutation action validates (Zod) and authorizes (`verifySession`) before calling the backend (HI-2, HI-14).
- [ ] Booking route streams with a skeleton; `getVenue` fetched once; hero is an optimized image (HI-3/4/5/6).
- [ ] Checkout survives a 15-minute idle via refresh-on-401 (HI-9).
- [ ] Role/permissions derive from `/users/me`; `pb_admin_role` clears on demotion (HI-10, LO-13).
- [ ] All forms use `useActionState`; fields announce labels/errors (HI-11, ME-13).
- [ ] Open redirect closed; `safeNext` covers all redirects (HI-8).
- [ ] `npm run lint`, `npm run test`, `tsc --noEmit`, `npm run build`, and Playwright all green in CI.
- [ ] `web/README.md` and `docs/ai/*` reflect the new architecture.

---

## Expected outcome

After all phases: authorization is enforced at the data boundary with defense-in-depth; a strict CSP+HSTS backstops XSS; inputs are server-validated from one schema; the data layer flows in one direction (component → DAL/service → transport → backend) with one error contract; reads are cached and the booking/landing routes stream and hit better Core Web Vitals; forms are React 19-native; and the codebase is guarded by formatting, type-checking, and an E2E suite — all achieved **without restructuring folders, without a TypeScript migration, and with exactly one new runtime dependency (Zod)**, consistent with the project's minimal-dependency philosophy.
