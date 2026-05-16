# Pickleball Platform — Project Overview

## 1. Project Description

A Pickleball Court Booking Platform designed for frictionless user-facing bookings and a capable admin backend. The platform launches at a single facility (Besa, Nagpur) with two courts and a small operator team. The schema and architecture are structured from day one to support future expansion to multiple venues without structural rewrites — but the multi-venue operational layer is not built at launch.

---

## 2. MVP Scope vs. Future Enhancements

This distinction is maintained throughout all documents. Features marked **"Deferred"** have their architectural foundations in place but are not built at launch.

### Built at Launch
- Court booking with row-level slot locking and 10-minute hold
- WhatsApp OTP authentication and booking confirmation
- PhonePe UPI-only payment with full webhook handling and idempotency
- Monetary wallet credit system (for force-majeure cancellations)
- Dynamic pricing (base price + time/day modifiers + coupon)
- Schedule management with daily exceptions
- Walk-in and admin-block entry
- Digital waiver and no-cancellation acknowledgment
- Basic admin panel (bookings, walk-ins, schedule, pricing, users)
- Reviews (stars + text; no photo upload at launch)
- PostHog product analytics and booking funnel tracking
- Reward Engine schema (architecture-ready; not activated until user base is established)

### Deferred — Architecture-Ready, Not Built at Launch

| Feature | Reason to Defer | When to Add |
|---|---|---|
| Redis JWT denylist (instant token revocation) | One admin user; standard JWT expiry is sufficient | When staff accounts require immediate revocation |
| Real-time slot sync (WebSockets / SSE) | Low concurrency; "slot taken" error on click is acceptable | When concurrent booking contention is noticeable |
| WhatsApp T−24h / T−2h reminders | Requires reliable job scheduler; low impact at small scale | After launch stabilisation |
| WhatsApp inbound support webhook | A contact phone number on the landing page is sufficient | When support volume justifies a structured inbox |
| PostHog session replay | Not useful at low traffic; requires masking config | When weekly bookings exceed ~100 |
| SMS fallback for OTP | WhatsApp penetration is very high in India | If OTP delivery failures are reported |
| Automated settlement reconciliation | Manual review via PhonePe dashboard is sufficient | At ~50+ daily transactions |
| Advanced BI / CLV analytics | No data to analyse at launch | After 3+ months of booking history |
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
| Auth | JWT (standard) | 24-hour expiry at launch. **Redis JWT denylist is deferred** — see Section 2 |
| OTP & Messaging | Meta WhatsApp Cloud API (direct) | OTP + booking confirmation at launch. T−24h/T−2h reminders and inbound support are deferred |
| Payments | PhonePe Payment Gateway v2 (UPI only) | Web Standard Checkout — redirect/iFrame. Direct via `pg-sdk-node`. See `08-PAYMENT-INTEGRATION.md` |
| File Storage | Cloudflare R2 | Court images. Review photo upload is deferred |
| Background Jobs | Yet to be decided | Slot expiry sweeper (required at launch). Notification scheduler is deferred (options: BullMQ, pg-boss) |
| Real-time Sync | **Deferred** | Socket.io or SSE when concurrent contention becomes a real problem |
| Analytics | PostHog | Funnel tracking, product analytics, error tracking. **Session replay is deferred** — see `07-ANALYTICS.md` |
| Error Monitoring | PostHog (launch) → Sentry (future) | |
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
| OTP validity | Yet to be decided |
| JWT expiry | 24 hours at launch (15 minutes when Redis denylist is added) |
| Payment webhook idempotency | Must handle duplicate signals without side effects |
| Legal compliance | Digital liability waiver with logged timestamp, IP, and verified phone |
| Accessibility | Yet to be decided |
