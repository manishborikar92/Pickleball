# 04 — API / Server Action / Service Architecture Review

This is the dedicated review the brief requires. It (1) explains the current architecture, (2) identifies the inconsistencies, (3) summarizes the latest Next.js 16 recommendations, (4) compares the viable approaches, (5) recommends the best architecture for this project, and (6) states explicitly whether to retain or refactor — and why.

---

> **Historical plan record.** This review captures the pre-implementation architecture and recommendations. See `docs/ai/01-IMPLEMENTATION-OVERVIEW.md` and `docs/ai/02-CODEBASE-MAP.md` for the implemented state.

## 1. The current architecture

### 1.1 The layers as they exist today

```
                            ┌────────────────────────────────────────────┐
  Server Components ───────▶│ lib/api.js  (façade — RE-THROWS on failure) │
  (pages, layouts)          └───────────────┬────────────────────────────┘
                                            │ imports
  Client Components ──┐                     ▼
  (BookingClient,     │   app/(booking)/venues/[slug]/book/actions.js   ← "use server"
   ReviewForm, polls) ├──▶  app/(auth)/actions.js                       ← Server Actions
                      │     app/(booking)/review/actions.js               (READS *and* writes)
                      │             │
                      │             ▼  normalizes here
                      │     lib/apiClient.js  (apiRequest — stateless, cache:"no-store", throws .status)
                      │             │
                      └─────────────┼──────────────────────────────────▶  Backend API
  Domain libs (pure): lib/bookingEngine.js · lib/bookingResolver.js · lib/normalizers.js · lib/validation.js
  Edge: src/proxy.js (token refresh + optimistic guards)   ·   Route Handler: app/api/og/route.js (OG image only)
```

### 1.2 What each layer does

- **`lib/apiClient.js`** — the only clean layer. Stateless `apiRequest(path, {method, body, accessToken, refreshToken})`; builds headers, `fetch`es with `cache:"no-store"` (`:47`), throws an `Error` with a `.status` property on non-2xx (`:56-60`), returns `{payload, setCookie}`. Never touches cookies. **This is correct and should be kept** (it becomes the transport under the DAL).
- **Server Actions (three files)** — the de-facto service tier. `book/actions.js` has 11 actions: **6 reads** (`getVenueBySlugAction`, `getVenueAvailabilityAction`, `getUserBookingsAction`, `getWalletAction`, `getPaymentStatusAction`, `getBookingByIdAction`) and **5 writes** (`previewBookingPriceAction`, `createBookingHoldAction`, `acceptBookingWaiverAction`, `initiateBookingPaymentAction`). Each reads the access token from cookies via a local `getAccessToken()` (`:17-20`), calls `apiRequest`, sometimes normalizes, and returns `{success,data}` / `{success:false,error}`. `(auth)/actions.js` mixes OTP/onboarding/login/logout with cookie writes and redirects. `(booking)/review/actions.js` has `submitReview` (broken) and `getVenueReviews`.
- **`lib/api.js`** — a façade that imports six of the Server Actions and **re-throws** on `!success` (`:13-81`), inverting their contract. Also contains `getAdminOverview` — hardcoded mock data behind a `// TODO` (`:48-65`). It imports Server Actions into a plain library module — backwards.
- **Domain libs** — `bookingEngine.js` (currency, date window, slot range, receipt/payment classification), `bookingResolver.js` (a clean status state machine), `normalizers.js` (snake→camel + venue enrichment + selection-payload assembly), `validation.js` (hand-rolled field validators). These are good; the resolver's only flaw is reaching *up* into `api.js` via a dynamic import.
- **`proxy.js`** — token refresh + optimistic route guards (analyzed in [03](./03-issues-register.md)/§auth).
- **Route Handlers** — exactly one: `api/og/route.js` (OG image). No data Route Handlers exist.

### 1.3 Concrete data flows

- **Booking page read:** `book/page.js:27` → `api.js:getVenue` (re-throws) → `getVenueBySlugAction` → `apiRequest` → backend; then `api.js:getAvailability` (sequential) → action → apiRequest. `generateMetadata` independently calls `getVenue` again (double fetch, no dedupe).
- **Availability re-fetch (client):** `BookingClient.js:75` calls `getVenueAvailabilityAction` **directly** (bypassing `api.js`).
- **Checkout (client):** `BookingClient.js:283-303` calls hold → waiver → initiate-payment in sequence, then branches on `payment.type`/`redirect_url` to drive PhonePe. **The transaction lives in the client.**
- **Booking status (server):** `booking/[bookingId]/page.js:16` → `resolveBookingResult` → `await import("./api.js")` → `getBookingById` (re-throws) → action → apiRequest; the resolver catches and **string-matches** the thrown message to reconstruct status.
- **Poll (client):** `useBookingStatusPoll.js:49` → `api.js:getBookingById` (throws; swallowed).

---

## 2. The inconsistencies (the brief's specific questions, answered)

| Question | Finding |
|---|---|
| Is API logic duplicated across layers? | **Yes.** `api.js` duplicates the action surface as a re-throwing wrapper; some callers use actions directly (`BookingClient`, poll-via-`api.js`), others via `api.js` (pages). `getAccessToken` is re-implemented inline in `(auth)/actions.js`. `clearAllAuthCookies` (proxy) and `clearSessionCookies` (cookies.js) duplicate the delete-loop. |
| Does business logic exist in multiple layers? | **Yes.** Payment-mode branching is in `BookingClient.js:306-337` **and** `BookingFailedView.js:44-55`. The "latest payment failed" rule is in `bookingResolver.js:51` **and** `useBookingStatusPoll.js:56`. Coupon normalization (`trim().toUpperCase()`) is in `validation.js:49` **and** `normalizers.js:222`. |
| Do Server Actions contain business logic that belongs in a service? | **Partially**, but the bigger problem is the inverse: the **real** orchestration (hold→waiver→pay) is *not* in an action — it's in the client. Auth-flow logic (role resolution, redirect sanitization, cookie-session assembly) sits inline in `(auth)/actions.js` with no service seam. |
| Do services duplicate Server Action logic? | **Partly.** `bookingResolver.js` is a service but depends *up* on the action layer via `import("./api.js")` (`:22-23`), creating an inverted, near-circular dependency: page → resolver → api.js → action → apiClient. |
| Do Route Handlers duplicate service logic? | **N/A** — only the OG Route Handler exists. But this is itself a gap: the status **poll** is semantically a cacheable GET being served by a mutation-style action, and any future payment webhook *must* be a Route Handler. |
| Is validation consistently applied? | **No.** Validation is **client-only**; no Server Action re-validates. Hand-rolled, no schema, bypassable by direct action calls. |
| Are responsibilities clearly separated? | **Partially, with leaks.** Clean: `apiClient`, `auth.js`, `auth.config.js`. Leaking: `api.js` mixes façade + mock; normalization lives in actions (and is *missing* for mutation responses); orchestration is in the client; the resolver depends upward. |
| Is error handling consistent? | **No.** Three contracts coexist (`{success,error}` returns; `api.js` re-throws; `apiClient` throws with `.status`; `getVenueReviews` returns `{success,data,meta}`). `error.status` is dropped, forcing brittle message string-matching in the resolver. |

---

## 3. Latest Next.js 16 recommendations (summary)

From the official docs (full citations in [01](./01-research-and-technology-evaluation.md)):

1. **Server Actions are for mutations**, not data fetching — they are serialized POST endpoints with no parallelism or caching. *"Treat Server Actions with the same security considerations as public-facing API endpoints"* — re-verify authz inside each.
2. **Reads belong in async functions called from Server Components**, cached with `"use cache"` + `cacheTag`/`cacheLife`. The shared place for these is a **Data Access Layer (DAL)**.
3. **Route Handlers** are for real HTTP endpoints — webhooks, OAuth callbacks, third-party/mobile clients, custom caching/streaming.
4. **The DAL is the security boundary**: *"The majority of security checks should be performed as close as possible to your data source."* A `cache()`-wrapped `verifySession()` + minimal DTOs + resource-level ownership checks.
5. **`proxy.js` does optimistic cookie checks only** — never the authoritative authz.

The current architecture violates (1), (2), and (4) directly.

---

## 4. Architectural options compared

### Option A — Keep as-is (reads as Server Actions, `api.js` façade)
- **Pros:** no migration; works today.
- **Cons:** violates Next.js 16 guidance on every count above; uncacheable reads (blocks the entire performance story); inverted dependencies; three error contracts; client-side transaction; broken authz enforcement. **Rejected.**

### Option B — Data Access Layer + thin services + Server Actions for mutations (recommended)
- A `lib/dal/` of cacheable async **read** functions calling `apiRequest` directly, with `verifySession()` + ownership checks at the data boundary and `"use cache"`+`cacheTag` on public reads.
- A thin **service** layer (`lib/services/`) for multi-step domain operations (checkout orchestration, booking resolution) — pure, testable, calling the DAL.
- **Server Actions** become mutation-only entry points that validate (Zod) → authorize (verifySession) → call a service/DAL → `revalidateTag`/`updateTag` → return one typed result shape.
- **Route Handlers** only where a real HTTP endpoint is needed (future payment webhook; optionally a cached availability GET if a non-React client appears).
- **Pros:** matches Next.js 16 exactly; one read path, one mutation path, one error contract, one validation source; reads become cacheable (unlocks PPR); authz enforced at the data boundary (closes CR-1/CR-2/HI-14); removes the inverted/circular deps; testable services.
- **Cons:** a real refactor (breaking), touching the data and auth layers. Acceptable — the project is greenfield (ADR-005) and backward compatibility is not required.

### Option C — Full BFF Route-Handler layer (all data through `/api/*` Route Handlers)
- Every read/write goes through internal Route Handlers that the client/server call via `fetch`.
- **Pros:** a single uniform HTTP surface; natural home for refresh-on-401; works for future mobile clients.
- **Cons:** reintroduces an HTTP hop for server-side reads that could be direct function calls; more boilerplate; loses Server Action ergonomics for form mutations; over-engineered for a primarily web app. **Rejected as the default**, but selectively adopt Route Handlers where Option B calls for them (webhooks, a token-refresh proxy if reads ever need 401-refresh outside actions).

---

## 5. Recommendation

**Adopt Option B.** Refactor — do not retain — the current API/Action/Service split. Concretely:

### 5.1 Target shape

```
src/lib/
  dal/                      ← NEW. Cacheable reads + auth boundary (server-only)
    session.js              ← verifySession() [cache()], requireUser(), requirePermission()
    venues.js               ← getVenue(slug)        ["use cache" + cacheTag('venue:'+slug)]
    availability.js         ← getAvailability(...)  [uncached, behind <Suspense>]
    bookings.js             ← getUserBookings(), getBooking(id) [ownership check]
    wallet.js               ← getWallet()           [user-scoped, uncached]
    admin.js                ← getAdminOverview()     [real API; replaces the mock]
    httpClient.js           ← apiRequest (moved/kept from lib/apiClient.js) + refresh-on-401
  services/                 ← NEW. Pure multi-step domain logic
    checkout.js             ← runCheckout(selection): hold→waiver→initiate, returns discriminated result
    bookingStatus.js        ← resolveBookingResult (moved from lib/bookingResolver.js; calls dal/bookings)
  schemas/                  ← NEW. One Zod schema per input (client + server share)
  actions/                  ← NEW. Server Actions = mutations ONLY ("use server"), ROUTE-INDEPENDENT
    auth.js                 ←   signIn/signOut/sendOtp/verifyOtp/onboarding
    booking.js              ←   checkoutBookingAction, previewBookingPriceAction, ...
    review.js               ←   submitReview
  bookingEngine.js  normalizers.js   ← KEEP (normalizers extended to mutation responses)

src/app/.../actions.js      ← REMOVED. Actions no longer live in route segments (see §5.4)
src/app/api/                ← Route Handlers: og/ (keep), payments/webhook/ (future), [optional] availability GET
```

Delete: `lib/api.js` (façade) and **all** route-segment action files (`app/(auth)/actions.js`, `app/(booking)/venues/[slug]/book/actions.js`, `app/(booking)/review/actions.js`). Reads move to the DAL; mutations move to `lib/actions/*`. Keep `apiClient.js` (as `dal/httpClient.js`). Each mutation action still does: validate (Zod) → authorize (`verifySession`) → service/DAL → `revalidateTag` → typed result — it just lives in `lib/actions/` instead of a route segment.

### 5.2 Responsibility matrix (where things live in the target)

| Concern | Lives in |
|---|---|
| HTTP transport, token headers, 401-refresh | `lib/dal/httpClient.js` |
| Reads (cacheable) + normalization | `lib/dal/*` |
| Session verification + authorization + ownership | `lib/dal/session.js` (called by DAL, actions, route handlers) |
| Multi-step domain orchestration | `lib/services/*` |
| Input validation (authoritative) | Server Action boundary, via `lib/schemas/*` (Zod) |
| Input validation (UX) | Client form, via the same `lib/schemas/*` |
| Mutations (entry points) | `lib/actions/*` (`"use server"`, route-independent — imported by both components and route files) |
| Real HTTP endpoints (webhooks, external) | `app/api/*` Route Handlers |
| Cache invalidation | `revalidateTag`/`updateTag` inside the mutation action |
| Pure business rules (pricing, dates, receipts, status) | `lib/bookingEngine.js`, `lib/services/bookingStatus.js` |

### 5.3 One error contract

Replace the three contracts with a single typed result from the DAL/services and actions:

```js
// success: { ok: true, data }
// failure: { ok: false, error: { code, message, status } }   // status carried from apiClient, never string-matched
```

Reads in Server Components can still `throw` (so error boundaries catch them) by unwrapping at the call site; the resolver consumes `error.status`/`code` instead of `message.includes("not found")`.

### 5.4 Dependency-direction rule — reusable modules never import from `@/app/`

`app/` is the outermost layer (routing + composition). `components/`, `lib/`, `hooks/`, and `config/` are inner, reusable layers. The dependency rule is one-directional: **inner layers must never import from `app/`.** `app/` route files import from the inner layers — never the reverse.

Today this is violated by **10 files** importing Server Actions from route segments: `lib/api.js`, `components/layout/AppSidebar.js`, `components/layout/AdminShell.js`, `components/features/review/ReviewForm.js`, `components/features/auth/{AdminLoginForm,CustomerLoginForm,CustomerOnboardingForm,CustomerCheckoutAuthGate}.js`, and `components/features/booking/{BookingClient,BookingFailedView}.js`. Because the actions are co-located under arbitrary route segments (e.g. booking actions live under `app/(booking)/venues/[slug]/book/actions.js` yet are imported by a checkout gate and the failed-view), the route tree behaves as a de-facto library — coupling reusable components to specific routes and producing the near-circular graph that forces `bookingResolver.js` to use a dynamic `import("./api.js")`.

**Rule (ADR-W009):** Server Actions live in a **route-independent** `lib/actions/*` module (`"use server"`), grouped by domain (`auth.js`, `booking.js`, `review.js`). Both `app/` route files **and** components import from `@/lib/actions/*`. Nothing under `components/`, `lib/`, or `hooks/` imports from `@/app/`.

Next.js *permits* co-locating an action in a route segment, and that is idiomatic when the action is used by **one** route. The justification for extraction here is that these actions are **shared across many components and route groups** — exactly the case where the documented best practice is to lift the action into a route-independent module. The rule is enforced going forward by an ESLint `no-restricted-imports` boundary (built into ESLint core — no new dependency) banning `@/app/*` and relative `app` paths from `src/components/**`, `src/lib/**`, and `src/hooks/**`.

---

## 6. Verdict — retain or refactor?

| Component | Decision | Why |
|---|---|---|
| `lib/apiClient.js` (transport) | **Retain** (move into `dal/httpClient.js`, add refresh-on-401) | Already correct and stateless |
| `lib/api.js` (façade) | **Remove** | Inverts dependencies; re-throws; holds mock data; duplicates the action surface |
| Read Server Actions (`getVenueBySlugAction`, …) | **Refactor → DAL reads** | Reads must not be POST-only Server Actions (Next.js 16); blocks caching |
| Mutation Server Actions (hold, waiver, pay, OTP, onboarding, login) | **Retain as actions — move to `lib/actions/*` + harden** | Correct use of Server Actions, but relocate out of route segments (§5.4 / ADR-W009); add validation + authz + normalized responses + one error shape + revalidation |
| Checkout orchestration (in `BookingClient`) | **Refactor → `services/checkout.js` + one action** | Business transaction belongs on the server |
| `bookingResolver.js` | **Retain, repoint** | Good state machine; should call the DAL, not `import("./api.js")` |
| `normalizers.js`, `bookingEngine.js` | **Retain, extend** | Good domain libs; normalize mutation responses too |
| `validation.js` | **Replace → `schemas/*` (Zod)** | Hand-rolled, client-only, bypassable |
| Route Handlers | **Add where needed** | Webhook (future), optional cached availability GET |

**Bottom line:** the current implementation should be **refactored, not retained**. The split is not a valid intentional pattern — it is an inversion (a library importing route-segment Server Actions to serve reads) that contradicts Next.js 16 guidance, blocks caching, fragments error handling, and leaves authorization unenforced. The transport layer and the pure domain libraries are the salvageable, well-designed parts and should be preserved and built upon.
