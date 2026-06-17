# Pickleball Platform — Project Overview

## 1. Project Description

A Pickleball Court Booking Platform designed for frictionless user-facing bookings and a capable admin backend. The platform launches at a single facility (Besa, Nagpur) with two courts and a small operator team. The schema and architecture are structured from day one to support future expansion to multiple venues without structural rewrites — but the multi-venue operational layer is not built at launch.

---

## 2. MVP Scope vs. Future Enhancements

This distinction is maintained throughout all documents. Features marked **"Deferred"** have their architectural foundations in place but are not built at launch.

### Built at Launch
- Court booking with row-level slot locking and 10-minute hold
- **Dual-surface authentication:** WhatsApp OTP (customers) via both modal (booking context) and dedicated `/login` `/onboarding` pages; email + password (staff) via `/admin/login` — both share the same JWT layer
- PhonePe UPI-only payment with full webhook handling and idempotency
- Monetary wallet credit system (for force-majeure cancellations)
- Dynamic pricing (base price + time/day modifiers + coupon)
- Schedule management with daily exceptions
- Walk-in and admin-block entry
- Digital waiver and no-cancellation acknowledgment
- Staff credential-based auth (email + password) with account provisioning, activation, and password reset flows
- Reviews (stars + text; no photo upload at launch)
- Reward Engine schema (architecture-ready; not activated until user base is established)

### Deferred — Architecture-Ready, Not Built at Launch

| Feature | Reason to Defer | When to Add |
|---|---|---|
| Redis-backed cache / distributed rate limiting | PostgreSQL-backed sessions provide launch revocation; Redis is not needed until traffic or multi-instance rate limits require it | When API traffic or background jobs justify a shared cache |
| Real-time slot sync (WebSockets / SSE) | Low concurrency; "slot taken" error on click is acceptable | When concurrent booking contention is noticeable |
| WhatsApp T−24h / T−2h reminders | Requires reliable job scheduler; low impact at small scale | After launch stabilisation |
| WhatsApp inbound support webhook | A contact phone number on the landing page is sufficient | When support volume justifies a structured inbox |
| SMS fallback for OTP | WhatsApp penetration is very high in India | If OTP delivery failures are reported |
| Automated settlement reconciliation | Manual review via PhonePe dashboard is sufficient | At ~50+ daily transactions |
| Multi-venue operational layer | Schema is venue-aware from day one; operational UI waits for a second location | When a second venue is added |
| Reward Engine (scratch cards) | No customer base to engage yet | When regular player volume warrants retention mechanics |
| Review photo upload | Column exists in schema; feature is additive | Low-priority post-launch addition |

---

## 3. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js (JavaScript) | Static landing pages + dynamic booking app |
| Styling | Tailwind CSS | Utility-first; dark theme with yellow-green (`#CBFF00`) accent |
| Backend | Express.js (JavaScript) | REST API; permission-guarded routes via `requirePermission()` middleware resolving through the RBAC tables |
| Database | PostgreSQL | ACID compliance, row-level locking, JSONB for flexible pricing rules |
| Auth | Short-lived JWT access tokens + rotating opaque refresh tokens | Customers: WhatsApp OTP. Staff credential schema is in place for admin/manager/staff. Session revocation is backed by `auth_sessions` and `refresh_tokens`; role resolution always comes from `venue_user_roles` |
| OTP & Messaging | Meta WhatsApp Cloud API (direct) | OTP + booking confirmation at launch. T−24h/T−2h reminders and inbound support are deferred |
| Payments | PhonePe Payment Gateway v2 (UPI only) | Web Standard Checkout — redirect/iFrame. Direct via `pg-sdk-node`. See `08-PAYMENT-INTEGRATION.md` |
| File Storage | Cloudflare R2 | Court images. Review photo upload is deferred |
| Background Jobs | Yet to be decided | Slot expiry sweeper (required at launch). Notification scheduler is deferred (options: BullMQ, pg-boss) |
| Real-time Sync | **Deferred** | Socket.io or SSE when concurrent contention becomes a real problem |
| Hosting / Infra | Yet to be decided | |

---

## 4. System Architecture

### 4.1 Architectural Style

The platform follows a **headless architecture**: the Next.js frontend communicates exclusively with the Express.js backend over a versioned REST API. The backend owns all business logic; the frontend never calculates prices, slot availability, or booking states.

### 4.2 Multi-Tenancy Model

**Architecture-ready from day one; operational layer deferred.**

Every core table includes a `venue_id` foreign key. The server resolves the single active venue internally — no venue-switching UI, no multi-venue admin dashboard, no `x-venue-id` header requirement at launch. When a second venue is added, the schema requires no changes; only the operational layer (venue selector, per-venue admin scoping) is built at that point.

### 4.3 Domain Breakdown

| Domain | Purpose |
|---|---|
| **Venue & Courts** | Venue configuration, court metadata, court status |
| **Identity & RBAC** | Global user profiles; contextual role assignments per venue via `venue_user_roles`; permission-based route guards |
| **Scheduling & Pricing** | Operating hours, daily overrides, dynamic pricing rules, coupons |
| **Booking & Transactions** | Slot locking, state machine, payments, wallet credits |
| **Communications & Rewards** | WhatsApp notifications, review system, Reward Engine (architecture-ready) |

### 4.4 Key Integration Points (Launch)

```
User Browser / Mobile
        │
        ▼
  Next.js Frontend
        │ (REST API)
        ▼
  Express.js Backend
   ├── PostgreSQL (primary data store)
   ├── PhonePe Gateway (payment + webhooks)
   ├── WhatsApp API (OTP + confirmation)
   └── Cloudflare R2 (court images)

  Background Worker (slot expiry sweeper)
```

> Redis, WebSockets, and a notification job scheduler are not part of the launch architecture. They are added as distinct layers when their specific use cases arise.

---

## 5. Environments

| Environment | Purpose |
|---|---|
| Development | Local development with seeded test data |
| Staging | Pre-production; PhonePe sandbox + WhatsApp test OTPs |
| Production | Live; Besa Nagpur facility |

---

## 6. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Double-booking | Zero tolerance; enforced at the database layer |
| Slot lock duration | 10 minutes from selection to payment |
| OTP validity | 5 minutes by default, environment-configurable |
| Auth session lifecycle | Short-lived access tokens; refresh tokens rotate on every refresh and can be revoked per device or all devices |
| Payment webhook idempotency | Must handle duplicate signals without side effects |
| Legal compliance | Digital liability waiver with logged timestamp, IP, and verified phone |
| Accessibility | Yet to be decided |

---

## 7. Complementary Technical Indexes
*   **Documentation Index**: Refer to [docs/README.md](../README.md) for a map of other product specs.
*   **Code Implementation Status**: Refer to [Implementation Status](../operations/04-IMPLEMENTATION-STATUS.md) to inspect which of these specifications are currently implemented, partially implemented, planned, or blocked in the codebase.


