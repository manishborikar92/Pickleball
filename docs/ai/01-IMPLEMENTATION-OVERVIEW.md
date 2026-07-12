# 01-IMPLEMENTATION-OVERVIEW

This document provides a comprehensive implementation snapshot of the Pickleball court booking platform, outlining the system's runtime architecture, data flows, core components, and external integrations.

---

## 1. High-Level System Architecture & Component Roles

The platform is divided into two primary execution boundaries designed for security, performance, and low-latency client interaction:

### A. Next.js 16 Frontend (`web/`)
- **App Router with Cache Components**: Route groups organized by concern — `(marketing)` for static/cached public pages, `(booking)` for dynamic booking flow, `(auth)` for authentication, `(dashboard)` for customer views, and `(admin)` for admin dashboards. Cache Components (`"use cache"`) enabled for the landing page, sitemap, and the venue read in the Data Access Layer (`cacheTag('venue:<slug>')`). Partial Prerendering (PPR) for dashboard and admin pages.
- **Optimistic Proxy + Proactive Refresh**: The `proxy.js` performs optimistic cookie-presence checks, coarse redirects, and **proactive token refresh** at the network edge — when the access token is expired but a refresh token is present, it refreshes before the render runs and forwards the fresh cookies. `lib/dal/httpClient.js` is a stateless transport that additionally performs refresh-on-401 for authenticated calls invoked from Server Actions.
- **Data Access Layer & Authorization Boundary**: Reads flow through `lib/dal/*` (cacheable async functions), never through Server Actions. `lib/dal/session.js` `verifySession()` (memoized with React `cache()`) is the authorization boundary — it reads cookies, calls `/users/me`, and derives role/permissions from that authoritative response. Pages call `requireRouteAccess()`/`requireUser()` with the real path; mutation Server Actions live in route-independent `lib/actions/*` and validate (Zod) + authorize before calling the backend. No global client-side `AuthProvider` or `AuthContext` — public pages ship zero auth JavaScript.
- **Client State Preservation**: Designed as a single-scroll interface under `/booking`. State variables (such as active slot arrays, selected dates, and venue identifiers) are maintained in React state. Authentication is requested via an in-context bottom-sheet modal rather than full-page redirects, preventing selection state loss during logins.

### B. Express Backend (`server/`)
- **Domain-Driven Architecture**: Backend routes, validators (Joi), services, and repositories are encapsulated under modular domain folders in `server/src/modules/` (e.g., `auth`, `users`).
- **Prisma PostgreSQL client**: Interacts with the database via Prisma client models. Database indexing and model associations (e.g., mapping user permissions contextualized to venue roles) are managed dynamically through the Prisma ORM.

---

## 2. High-Level Runtime Flows

### 2.1 The Booking & Slot Locking Sequence
When a customer attempts to secure a court booking, the system coordinates availability lookups, lock holds, and payment routing:

```
[Customer Client]       [Next.js Proxy]          [Express API]         [PostgreSQL DB]
        │                       │                      │                      │
        │ 1. Query Availability │                      │                      │
        ├──────────────────────>│                      │                      │
        │                       │ 2. Forward Request   │                      │
        │                       ├─────────────────────>│                      │
        │                       │                      │ 3. Query Active Holds│
        │                       │                      │    & Scheduled Slots │
        │                       │                      ├─────────────────────>│
        │                       │                      │ 4. Return Slot States│
        │                       │                      │<─────────────────────┤
        │                       │ 5. Return JSON Data  │                      │
        │                       │<─────────────────────┤                      │
        │ 6. Render Availability│                      │                      │
        │<──────────────────────┤                      │                      │
        │                       │                      │                      │
        │ 7. Tap Slot (Hold)    │                      │                      │
        ├──────────────────────>│                      │                      │
        │                       │ 8. Acquire Slot Hold │                      │
        │                       ├─────────────────────>│                      │
        │                       │                      │ 9. Write Slot Hold   │
        │                       │                      │    (Atomic DB Trans) │
        │                       │                      ├─────────────────────>│
        │                       │                      │ 10. Confirm Unique   │
        │                       │                      │     Constraint Success
        │                       │                      │<─────────────────────┤
        │                       │ 11. Return Hold Data │                      │
        │                       │<─────────────────────┤                      │
        │ 12. Open Checkout View│                      │                      │
        │<──────────────────────┤                      │                      │
        │                       │                      │                      │
```

1. **Availability Generation**: The Express scheduling service checks operating hours templates, overlays overrides/exceptions for the target date, and subtracts confirmed bookings and active/expired slot holds.
2. **Atomic Hold Acquisition**: When slots are requested, the Express backend writes booking slot instances in a single database transaction. Concurrency safety is enforced by a PostgreSQL partial unique index:
   `CREATE UNIQUE INDEX "booking_slots_no_double_book" ON "booking_slots" ("court_id", "slot_date", "slot_start_time") WHERE "status" IN ('pending_payment', 'confirmed', 'walk_in', 'admin_block');`
   If any slot is already locked in an active state, the transaction fails, and the system reports the conflicting units. If free, a temporary hold is written (status `pending_payment` with a 10-minute TTL).
3. **Session Verification**: The Next.js proxy checks cookie presence, refreshes an expired access token proactively at the edge, and redirects unauthenticated users; `lib/dal/httpClient.js` additionally refreshes on a 401 for authenticated Server Action calls. If the user is not logged in during checkout, the client opens the bottom-sheet AuthModal.

---

## 3. Security & Access Control (RBAC)

- **Cookie Rotation Strategy**: Session state is backed by database-driven refresh token rotation. The access token is short-lived (15 minutes), and the refresh token is rotated on every silent refresh. Refresh happens proactively in `proxy.js` at the edge and, as a fallback, on a 401 inside `lib/dal/httpClient.js` (which can set cookies from a Server Action context).
- **Contextual Access Control**: Roles are scoped to venues using join tables (`VenueUserRole`). A user can be a "Manager" at Venue A and a "Customer" at Venue B. Authorization is enforced at the Data Access Layer (`lib/dal/session.js`): protected **pages** call `requireRouteAccess()` with the real path (fail-closed for unmapped protected routes), owned-resource reads perform ownership checks, and every mutation action re-verifies the session — role/permissions are derived from the authoritative `/users/me` response, not a client cookie.
- **Payload Validation Gating**: All HTTP inputs are checked against strict Joi validation schemas in the routing controller layer before reaching service logic.

---

## 4. Integration Boundaries

- **WhatsApp Cloud API (OTP Delivery)**: Connects to Meta's WhatsApp Business API. The service falls back to sandbox logs in local environments. Rate-limiting rules prevent sending OTPs more than once every 60 seconds.
- **PhonePe Checkout Gateway**: Integrates via checkout URL generation. The payment completion webhook uses custom basic authentication verified by matching the Authorization header with a SHA256 hash of the configured username and password.
- **Cloudflare R2**: Used for layout maps. Client uploads bypass Express backend using presigned URLs.

---

## 5. Architectural Tradeoffs & Constraints

- **Single-Server Concurrent Refresh Limit**: Concurrent silent refreshes are handled via an in-memory grace period. Scaling out horizontally to multiple VM instances will require migrating this grace period cache to a shared Redis store.
- **PostgreSQL Session Storage Write Volume**: Reading and rotating session tokens on every API call increases database write IOPS. This will eventually be moved from PostgreSQL tables to Redis caching.
