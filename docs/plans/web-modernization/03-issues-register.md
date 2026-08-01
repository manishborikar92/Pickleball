# 03 — Issues Register

> **Historical plan record.** The issues and file references below are the pre-implementation audit baseline, not a list of current defects. See `docs/ai/03-IMPLEMENTATION-STATUS.md` for implemented work and remaining debt.

Every issue found during the audit, severity-classified, with `file:line`, impact, and a concrete fix. IDs are stable references used by the implementation plan ([06](./06-implementation-plan.md)).

**Severity key:** **Critical** = broken correctness or exploitable security / blocks scaling the codebase · **High** = significant security, performance, or correctness risk · **Medium** = real but bounded · **Low** = polish / hygiene.

Counts: **Critical 5 · High 14 · Medium 19 · Low 13** (≈51 issues).

---

## 1. Critical

### CR-1 — RBAC permissions are never enforced (fail-open authorization)
`lib/session.js:56` `requireRouteAccess(pathname)` is called with a **hard-coded** path from the layouts: `(admin)/layout.js:14` → `"/admin"`, `(dashboard)/layout.js:14` → `"/dashboard"`. `lib/rbac.js:62-68` `getRouteAccess` has no key for `/admin` or `/dashboard` (only `/admin/pricing`, `/admin/settings`, etc.), so `canAccessRoute` returns `true` (fail-open). **Impact:** a `staff` user can load `/admin/settings` (`manage_venues`) and `/admin/pricing` (`edit_pricing`); fine-grained permissions are decorative in the frontend. **Fix:** pass the real `pathname` (from a DAL helper or per-page check); make `canAccessRoute` **fail-closed** for protected prefixes (deny unknown `/admin/*`). The existing unit test passes the real path and so masks this.

### CR-2 — `(booking)` checkout routes have no frontend authorization
There is **no `(booking)/layout.js`**, and the `proxy.js:202` matcher (`/login`, `/onboarding`, `/dashboard/:path*`, `/admin/:path*`, `/booking/:path*`) does **not** match `/venues/*` or `/review/*`. `booking/[bookingId]/page.js` calls `getSession()` only for display branching. **Impact:** authorization for the entire checkout/review surface rests solely on the backend; any backend IDOR gap is unguarded by the frontend (no defense-in-depth). **Fix:** enforce ownership at the DAL for `getBookingById`/review; optionally add a `(booking)` segment guard; treat each owned-resource read as needing a resource-level check.

### CR-3 — `submitReview` is permanently broken (wrong session contract) + broken Button API
`review/actions.js:9` gates on `session?.accessToken` and `:20-21` pass `session.accessToken`/`refreshToken` to `apiRequest`, but `getSession()` returns only `{ user, role, permissions }` (`session.js:35-43`) — no token field. **Review submission always returns "You must be logged in," for everyone.** Compounding it, `ReviewForm.js:62,65` render `<Button asChild variant="outline">`, but `Button` (`components/shared/Button.js`) implements neither `asChild` nor an `outline` variant — the success-screen buttons render unstyled and structurally wrong. The photo upload (`ReviewForm.js:233-269`) only captures a filename and never uploads. **Impact:** the review feature is non-functional end to end. **Fix:** read the token via the cookie accessor like other actions; gate on `session?.user`; add server-side schema validation; fix the `Button` usage (use `href` or a real composition API); either implement or remove photo upload.

### CR-4 — Data layer is inverted; all reads run through Server Actions
`lib/api.js:1-8` imports Server Actions from `app/(booking)/venues/[slug]/book/actions.js`; every read (`getVenue`, `getAvailability`, `getUserBookings`, `getWallet`, `getBookingById`, `getPaymentStatus`) is a POST-only Server Action wrapped by `api.js`, which **re-throws** (inverting the action's `{success,error}` contract). `bookingResolver.js:22-23` must `await import("./api.js")` dynamically to stay testable. **Impact:** reads are uncacheable; three error contracts coexist; the dependency graph points the wrong way; the booking transaction lives in the client. This is the root cause of CR-1/CR-2 being exploitable in the frontend tier and of the cache contradiction (HI-3). **Fix:** introduce a DAL (`lib/dal/*`) of cacheable async read functions calling `apiRequest` directly; Server Actions become mutations only and call the DAL; delete the `api.js` façade and the GET actions; repoint the resolver to the DAL. (See [04](./04-api-server-action-service-review.md).)

### CR-5 — No Content-Security-Policy on the application
`next.config.mjs:16-45` sets several headers but **no CSP** for the app; only `/login`, `/onboarding`, `/admin/login` get a minimal `frame-ancestors 'none'; object-src 'none'`. No `default-src`/`script-src`/`connect-src`, no nonce/hash strategy. **Impact:** any XSS anywhere executes with no CSP backstop and no `connect-src` to stop exfiltration to attacker origins. **Fix:** add a strict CSP — SRI/hash-based for public cacheable pages, nonce-based (generated in `proxy.js`) for dynamic authenticated surfaces — plus HSTS (see HI-1). Severity is Critical because it is the single largest defense-in-depth gap for a payments app.

---

## 2. High

### HI-1 — No HSTS; `secure` cookie flag gated on `NODE_ENV`
`next.config.mjs` omits `Strict-Transport-Security` entirely; `lib/auth.js:16` sets `secure: process.env.NODE_ENV === "production"`. **Impact:** staging/preview/misconfigured deploys serve auth cookies without `Secure`; no HSTS means SSL-strip exposure on first contact even in prod. **Fix:** add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`; set `secure: true` whenever served over HTTPS.

### HI-2 — Server-side validation is missing (client-only)
`lib/validation.js` validators are called only in client components (`PhoneForm.js:31`, `OtpForm.js:30`, `NameForm.js:31`, `ReviewForm.js:26`, `BookingClient.js:212`). No Server Action re-validates; `completeOnboardingAction(name)`, `sendCustomerOtpAction(phone)`, `submitReview(id, ...reviewData)` forward raw input (and `...reviewData` forwards arbitrary fields). **Impact:** Server Actions are public POST endpoints; all validation is bypassable by a direct call. **Fix:** one shared Zod schema per input, `safeParse`d authoritatively in the action.

### HI-3 — `cacheComponents` defeated by blanket `no-store` + zero tags
`lib/apiClient.js:47` hard-codes `cache: "no-store"` on every request; **no** `cacheTag`/`cacheLife`/`revalidateTag`/`revalidatePath` exist anywhere; only two `"use cache"` directives, both on data-less pages. **Impact:** the app pays PPR's constraints for zero benefit; no invalidation path exists. **Fix:** per-call cache policy — cache+tag public reads, `no-store` user-scoped reads; `revalidateTag`/`updateTag` in mutations.

### HI-4 — Booking page: no streaming, no `loading.js`, redundant client re-fetch
`book/page.js:25-32` `await connection()` then sequential `venue → availability` with **no Suspense**; `(booking)` has **no `loading.js`**; `BookingClient.js:72-95` re-fetches availability on mount for the **initial date already passed as a prop**, creating a server→client→server waterfall and a double-fetch. **Impact:** blank/frozen navigation on the hottest route; wasted round-trips. **Fix:** wrap availability in `<Suspense>`; add `(booking)/venues/[slug]/book/loading.js`; skip the client effect for the server-provided `initialDate`.

### HI-5 — Hero LCP image is an unoptimized CSS background
`globals.css:60-67` `.court-hero` loads `url("/court-1.png")` as the above-the-fold LCP element — no `next/image`, no responsive `srcset`, no AVIF/WebP, no `priority`/preload. **Impact:** the dominant LCP cost on the landing page. **Fix:** render the hero with `<Image fill priority>` (or add a preload link + modern formats).

### HI-6 — `getVenue` fetched twice per booking render, no dedupe
`book/page.js:12` (`generateMetadata`) and `:27` (body) both call `getVenue(slug)`, each `no-store`, with no `react.cache()` wrap (only `getSession` is cached). **Impact:** two full network round-trips per booking load. **Fix:** make the DAL `getVenue` a `cache()`-wrapped, `"use cache"`-tagged read.

### HI-7 — `signInAdminAction` has no error handling
`(auth)/actions.js:98-117` calls `apiRequest` with no try/catch and is wired as a form `action` (`AdminLoginForm.js:36`). **Impact:** a wrong password throws raw into the error boundary instead of an inline "invalid credentials." **Fix:** try/catch → return `{success:false,error}` consumed via `useActionState`.

### HI-8 — Open redirect in `signInAdminAction`
`(auth)/actions.js:116` `redirect(next.startsWith("/") ? next : ...)` does not reject `//evil.com` or `/\evil.com`. The proxy and client forms validate `!startsWith("//")` but this action does not. **Impact:** post-login open redirect for admins. **Fix:** mirror the proxy check (`startsWith("/") && !startsWith("//") && !startsWith("/\\")`); centralize a `safeNext()` helper.

### HI-9 — Token refresh gap on `/venues/*` (mid-checkout 401)
`proxy.js:202` matcher excludes `/venues/:path*`; the booking page lives there. Access TTL is 15 min (`auth.config.js:17`). A user idling on the booking page past TTL then invoking `createBookingHoldAction`/`initiateBookingPaymentAction` sends a stale token (`book/actions.js:54,85`) → 401 with no refresh path. **Impact:** checkout fails with a raw error and no recovery. **Fix:** add refresh-on-401 inside the DAL/auth-required actions (actions can set cookies), and/or extend the matcher.

### HI-10 — Role/permissions derived from a client-presentable cookie, not the API
`session.js:34` reads `role` from the `pb_auth_role` cookie and `:42` falls back to `getRolePermissions(role)`; the authoritative `user.roles` from `/users/me` is fetched but discarded. The edge admin gate trusts `pb_admin_role` (`proxy.js:133`), never reconciled on demotion (persists up to 30 days). **Impact:** role spoofing if cookies can be injected; demoted admins retain access until expiry/logout. **Fix:** have the backend return canonical roles/permissions in `/users/me` and derive them there; treat role cookies as optimistic hints only; clear `pb_admin_role` on any refresh returning a non-admin role.

### HI-11 — React 19 form primitives unused; forms are hand-rolled
`useActionState`/`useFormStatus`/`useOptimistic` = **0 occurrences**. Every form (`PhoneForm`, `OtpForm`, `NameForm`, `ReviewForm`, `AdminLoginForm`, `CustomerOnboardingForm`, coupon) is `useState` + manual `isSubmitting`/`error` + an `onSubmit` interpreting `{success}`. **Impact:** more code, more bug surface, worse progressive enhancement, duplicated client/server validation. **Fix:** migrate to `<form action>` + `useActionState` with Zod, reusing one schema.

### HI-12 — `BookingClient.js` is a 410-line god component
`components/features/booking/BookingClient.js` holds ~12 `useState`s, two data `useEffect`s, checkout orchestration, the auth-step machine, and PhonePe integration. **Impact:** least maintainable/testable file; couples UI, data fetching, and a payment transaction. **Fix:** extract a `useBookingSelection` reducer hook, move the hold→waiver→pay transaction into a single server action (HI-13), and split presentational subcomponents.

### HI-13 — Checkout transaction orchestrated in the client
`BookingClient.js:272-343` runs hold → waiver → initiate-payment as three sequential action calls plus payment-mode branching (duplicated in `BookingFailedView.js:44-55`). **Impact:** the business sequence + validation + authz are not server-enforced or atomic; hard to test; snake_case fields (`hold.booking_id`, `payment.redirect_url`) leak into the client because mutation actions return raw `payload.data`. **Fix:** one `checkoutBookingAction(selection)` returning a discriminated result (`{kind:"wallet_only"|"redirect"|"error"}`); normalize its response; client only navigates.

### HI-14 — Mutation Server Actions perform no authz/ownership check
`book/actions.js:52,66,83,135,123` attach a bearer token only if a cookie happens to exist; none assert a session or verify the caller owns `bookingId`/`orderId`. **Impact:** no defense-in-depth; relies entirely on the backend. **Fix:** `const s = await verifySession(); if (!s) return unauthorized;` plus resource-ownership checks at the DAL.

---

## 3. Medium

### ME-1 — Three inconsistent error contracts
Actions return `{success,error}`; `api.js` re-throws; `apiClient` throws with `.status`; `getVenueReviews` returns a third shape `{success,data,meta}`. `error.status` is dropped at the action boundary, forcing `bookingResolver.js:68-77` to **string-match** messages (`"not found"`, `"unauthorized"`). **Impact:** fragile, locale-dependent error handling. **Fix:** one contract (typed result objects with a numeric `status`/`code`) end to end.

### ME-2 — Mutation responses returned raw (snake_case leak)
`createBookingHoldAction:60`, `acceptBookingWaiverAction:77`, `initiateBookingPaymentAction:93`, `getPaymentStatusAction:129` return raw `payload.data`. **Impact:** client consumes `booking_id`/`redirect_url`/`merchant_order_id`, inconsistent with the camelCase app. **Fix:** add normalizers for hold/payment/status responses.

### ME-3 — `getAdminOverview` is hardcoded mock data
`lib/api.js:48-65` returns fake stats/courts behind a `// TODO`; the admin overview page renders fiction. **Impact:** admin overview is non-functional. **Fix:** implement against the real admin API via the DAL (tracked by the existing TODO).

### ME-4 — Admin pages `await` data with no Suspense
`admin/overview/page.js:9`, `admin/bookings/page.js:6`, `admin/courts/page.js:6` `await getAdminOverview()` directly. Harmless with mock data; will block the route once wired to a real API. **Fix:** add Suspense boundaries before real integration.

### ME-5 — No CSRF/Origin allowlist configured for Server Actions
`next.config.mjs` has no `serverActions.allowedOrigins`. Next.js ships a same-origin check by default (so this is not currently exploitable), but `sameSite: "lax"` on admin/refresh cookies is weaker than `strict`. **Fix:** set `allowedOrigins` if deployed behind a proxy domain; use `sameSite: "strict"` for admin/refresh cookies.

### ME-6 — Refresh thundering-herd / no single-flight
`proxy.js:92` fires a refresh per in-flight matched request; parallel navigations each POST `/auth/refresh` with the same token. The backend has an in-memory grace period (`docs/ai/04-ISSUES-AND-DEBT.md` §4.2), which mitigates this **only on a single instance**. **Impact:** sporadic forced logouts under horizontal scaling. **Fix:** server-instance single-flight keyed on the refresh token, or rely on the documented backend grace window and note the multi-instance limitation.

### ME-7 — Poll swallows all errors; misleading "timed out" UX
`useBookingStatusPoll.js:63-66` logs and swallows every error; a hard 401/403 spins until `maxPolls` then shows "Payment verification timed out… it will reflect shortly" (`BookingPendingView.js:43`). **Impact:** genuine failures masquerade as success-pending. **Fix:** distinguish 4xx (stop, show error) from transient (retry).

### ME-8 — `getSession` calls `/users/me` on every authenticated render
`session.js:30` hits the backend on every render (in addition to the proxy refresh round-trip). It is `cache()`-deduped per render but not across the request lifecycle beyond that. **Impact:** extra backend load per navigation. **Fix:** acceptable for now; once the DAL exists, consider a short `"use cache: private"`-style scope or rely on the verified cookie for non-sensitive reads.

### ME-9 — Single-venue config baked into normalization
`normalizers.js:1,53` merges the singleton `VENUE` config into **every** venue (`googleMapsLink`, `hours`, `location` fallback). **Impact:** breaks the moment a second venue exists. **Fix:** key static config by slug or source it from the backend.

### ME-10 — `Montserrat` font loaded inside a component
`components/layout/Header.js:4` loads a Google font from a component rather than a layout. **Impact:** off-center font management, a second font payload. **Fix:** consolidate fonts in the root layout (or drop the second font).

### ME-11 — OG image embeds an SVG logo
`api/og/route.js:11,33` loads `/baseline-full-logo.svg` into Satori. **Impact:** Satori SVG support is unreliable; the logo may not render in production OG cards. **Fix:** use a PNG logo.

### ME-12 — "indoor" vs "outdoor" keyword conflict
Root metadata/OG say "outdoor" (`layout.js:16`); `(marketing)/page.js:14`, `about/page.js:9`, `book/page.js:19` say "indoor." **Impact:** conflicting primary keyword dilutes SEO and reads as a copy bug. **Fix:** standardize on one.

### ME-13 — Form fields not programmatically associated with labels/errors
`FormField` (`components/shared/Form.js:17`) generates an `id` via `useId` but doesn't wire `htmlFor`/`aria-describedby`/`aria-invalid`; `PhoneForm`/`OtpForm` rely on placeholders + a detached `FormAlert`. **Impact:** screen readers don't announce the field's error/relationship (WCAG 1.3.1/3.3.1). **Fix:** auto-wire `id`/`htmlFor`/`aria-describedby`/`aria-invalid` in `FormField` and inputs.

### ME-14 — No `app/global-error.js`
Errors thrown in the root layout (e.g. font load) fall through to the default Next.js error screen, not a branded one. **Fix:** add `app/global-error.js`.

### ME-15 — `useTable` nests a `setState` inside another updater; `columns` dep churn
`useTable.js:62-72` calls `setSortOrder` inside the `setSortBy` updater (an anti-pattern); `processedDataResult` depends on `columns` which is likely a new array each render (`:163`), recomputing every render. **Impact:** subtle re-render/correctness fragility. **Fix:** compute next sort state in one pass; memoize `columns` at call sites or accept a stable ref.

### ME-16 — Logout swallows backend failure; access token valid until expiry
`(auth)/actions.js:73-79,88-94` `.catch(()=>null)` the logout call. **Impact:** if backend logout fails, the refresh token may remain valid server-side; the access token stays usable up to 15 min. **Fix:** surface logout failure; rely on short access TTL (already 15 min); consider server-side refresh revocation confirmation.

### ME-17 — `getSessionAction` is an unthrottled public Server Action
`(auth)/actions.js:12-14` exposes `getSession()` to the client (`CustomerCheckoutAuthGate.js:57`), triggering a `/users/me` call per invocation. **Impact:** low, but an unauthenticated unthrottled endpoint. **Fix:** rate-limit or inline the check.

### ME-18 — `web/README.md` is incorrect on the auth model
README claims the proxy does "no token refresh" and refresh happens "in `apiClient.js` on 401" — both false (refresh is proactive in `proxy.js`; `apiClient` never refreshes). **Impact:** misleads maintainers about a security-critical flow. **Fix:** correct the README as part of the auth refactor.

### ME-19 — Reusable modules import Server Actions from `@/app/` (wrong dependency direction)
**10 files** in `components/` and `lib/` import Server Actions from route segments: `lib/api.js:8`, `components/layout/AppSidebar.js:4`, `components/layout/AdminShell.js:5`, `components/features/review/ReviewForm.js:9`, `components/features/auth/AdminLoginForm.js:5`, `CustomerLoginForm.js:7`, `CustomerOnboardingForm.js:6`, `CustomerCheckoutAuthGate.js:11`, `components/features/booking/BookingClient.js:20`, `BookingFailedView.js:6`. **Impact:** inner, reusable layers depend on the outermost routing layer; reusable components are coupled to specific routes; this is the near-circular graph that forces `bookingResolver.js:22` to use a dynamic `import("./api.js")`. **Fix (ADR-W009):** move Server Actions to a route-independent `lib/actions/*` (`"use server"`); both components and route files import from `@/lib/actions/*`; nothing under `components/`/`lib/`/`hooks/` imports from `@/app/`; enforce with an ESLint `no-restricted-imports` boundary. Same architectural root as CR-4; closed in Phase 2.

---

## 4. Low

### LO-1 — Numeric `0` treated as missing in normalization
`normalizers.js:65,81,97` use `||` on prices (`slot.unit_price || ... || 0`); a free slot priced `0` is indistinguishable from missing. **Fix:** use `??` for numerics.

### LO-2 — `upiAmount` not clamped
`bookingEngine.js:50` `upiAmount = totalAmount - creditsApplied` can go negative on bad data → misclassified "mixed." **Fix:** `Math.max(0, …)`.

### LO-3 — `buildDateWindow` parses `Intl` output positionally
`bookingEngine.js:18-33` splits `Intl` formatter output by spaces and indexes `[weekday, day, month]`. **Fix:** use `formatToParts`.

### LO-4 — `wait`/`Promise.resolve` indirection around mock
`lib/api.js:10-11` wraps a sync value to keep `getAdminOverview` async-shaped — dead-code smell tied to ME-3. **Fix:** removed with ME-3.

### LO-5 — Needlessly `async` admin pages with no `await`
`admin/schedule|pricing|users|settings/page.js` are `async` but contain no awaits. **Fix:** drop `async` or add real data needs.

### LO-6 — Two `SportsActivityLocation` JSON-LD nodes for one venue
`(marketing)/page.js:35` and `book/page.js:34` differ in `priceRange` (`INR` vs `₹₹`) and `@id`. **Fix:** one canonical node or consistent values.

### LO-7 — Unencoded OG query string in root layout
`layout.js:41,53` pass spaces/commas unencoded (the `getPageMetadata` helper encodes correctly). **Fix:** encode or route through the helper.

### LO-8 — Review `<title>` leaks the booking UUID
`review/[bookingId]/page.js:7` → `Rate Your Experience - <uuid>`. Noindex, low impact. **Fix:** drop the UUID from the title.

### LO-9 — No explicit `viewport`/`themeColor` export
Only `manifest.json` carries `theme_color`. **Fix:** add `export const viewport` with `themeColor`.

### LO-10 — `MapCore.js:35` reads `window.innerWidth` at render top-level
Non-reactive to resize; safe only via `ssr:false`. **Fix:** read in an effect / use a resize observer if responsiveness matters.

### LO-11 — Deprecated `X-XSS-Protection` header
`next.config.mjs:31` sets a deprecated header that can introduce issues in old browsers. **Fix:** drop it; rely on CSP.

### LO-12 — `secureCookieOptions` uses `sameSite: "lax"` uniformly
`lib/auth.js:18` applies `lax` to refresh/admin cookies too. **Fix:** `strict` for refresh/admin; `lax` only where a top-level GET redirect needs it.

### LO-13 — `cookies.js` `setSessionCookies` never clears a stale `pb_admin_role`
`lib/cookies.js:29-31` sets `ADMIN_ROLE` only when `role !== "customer"`, but never deletes it when a now-customer logs in without a full `clearSessionCookies`. **Fix:** explicitly delete `ADMIN_ROLE` when role is customer.

---

## 5. Cross-references

- The data-layer items (CR-4, ME-1, ME-2, HI-13, HI-14) are analyzed in depth in [04-api-server-action-service-review.md](./04-api-server-action-service-review.md).
- The fixes are sequenced into phases in [06-implementation-plan.md](./06-implementation-plan.md); each phase lists the IDs it closes.
