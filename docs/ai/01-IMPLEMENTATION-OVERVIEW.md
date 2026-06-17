# 01-IMPLEMENTATION-OVERVIEW

This document provides a comprehensive implementation snapshot of the Pickleball court booking platform, outlining the system's runtime architecture, data flows, core components, and external integrations.

---

## 1. High-Level System Architecture & Component Roles

The platform is divided into two primary execution boundaries designed for security, performance, and low-latency client interaction:

### A. Next.js Frontend (`web/`)
- **App Router Routing**: Isolates client dashboard routes `(app)/dashboard`, customer login/onboarding routes `(auth)/`, public court navigation `(public)/booking`, and operator/manager dashboards `(staff)/admin`.
- **Edge Request Proxying**: Serves as a secure boundary. The frontend uses a custom Next.js `proxy.js` mapping layer that intercepts user requests. It parses session cookies (`pb_access_token`, `pb_refresh_token`) and maps them to authorization headers passed downstream to the API server, protecting the Express API from direct public exposure.
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
        │                       │ 8. Acquire Slot Lock │                      │
        │                       ├─────────────────────>│                      │
        │                       │                      │ 9. SELECT FOR UPDATE │
        │                       │                      │ (Set OtpRequest/Slot)│
        │                       │                      ├─────────────────────>│
        │                       │                      │ 10. Confirm Success  │
        │                       │                      │<─────────────────────┤
        │                       │ 11. Return Hold Data │                      │
        │                       │<─────────────────────┤                      │
        │ 12. Open Checkout View│                      │                      │
        │<──────────────────────┤                      │                      │
        │                       │                      │                      │
```

1. **Availability Generation**: The Express scheduling service checks operating hours templates, overlays overrides/exceptions for the target date, and subtracts confirmed bookings and active/expired slot holds.
2. **Atomic Hold Acquisition**: When a slot is clicked, the Express backend acquires a slot lock. To prevent race conditions from concurrent bookings, the database runs a raw transaction executing:
   `SELECT * FROM "BookingSlot" WHERE "courtId" = $1 AND "startTime" = $2 FOR UPDATE;`
   If the slot is unlocked, a temporary hold instance is written (valid for 10 minutes).
3. **Session Verification**: The Next.js edge proxy injects authenticated headers. If the user session is expired, the client opens the bottom-sheet AuthModal.

---

## 3. Security & Access Control (RBAC)

- **Cookie Rotation Strategy**: Session state is backed by database-driven refresh token rotation. The access token is short-lived (15 minutes), and the refresh token is rotated on every silent refresh. 
- **Contextual Access Control**: Roles are scoped to venues using join tables (`VenueUserRole`). A user can be a "Manager" at Venue A and a "Customer" at Venue B. The access proxy maps these permissions to request headers.
- **Payload Validation Gating**: All HTTP inputs are checked against strict Joi validation schemas in the routing controller layer before reaching service logic.

---

## 4. Integration Boundaries

- **WhatsApp Cloud API (OTP Delivery)**: Connects to Meta's WhatsApp Business API. The service falls back to sandbox logs in local environments. Rate-limiting rules prevent sending OTPs more than once every 60 seconds.
- **PhonePe Checkout Gateway**: Integrates via checkout URL generation. The payment completion webhook uses SHA256 header signatures calculating checksums from raw body data and verify keys.
- **Cloudflare R2**: Used for layout maps. Client uploads bypass Express backend using presigned URLs.

---

## 5. Architectural Tradeoffs & Constraints

- **Single-Server Concurrent Refresh Limit**: Concurrent silent refreshes are handled via an in-memory grace period. Scaling out horizontally to multiple VM instances will require migrating this grace period cache to a shared Redis store.
- **PostgreSQL Session Storage Write Volume**: Reading and rotating session tokens on every API call increases database write IOPS. This will eventually be moved from PostgreSQL tables to Redis caching.
