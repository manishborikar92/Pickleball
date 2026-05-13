# Pickleball Platform — Project Overview

## 1. Project Description

A **headless, multi-tenant, event-driven** Pickleball Court Booking Platform designed for frictionless user-facing bookings and powerful administrative control. The platform supports a single facility at launch (Besa, Nagpur) and is architected from day one to scale to multiple venues across India without requiring structural rewrites.

---

## 2. Goals

| Goal | Description |
|---|---|
| Conversion-first UX | Authentication is deferred to mid-funnel so users can browse and select slots before being asked to log in |
| Zero double-bookings | PostgreSQL row-level locking ensures atomic slot reservation |
| Admin as command center | Admins can override schedules, manage walk-ins, issue credits, and access business intelligence — all from one dashboard |
| Multi-venue ready | Every entity in the system belongs to a Venue; expanding to new locations requires no schema changes |
| Operator safety | Strict no-cancellation policy with a digital waiver and mandatory time acknowledgment protects revenue |

---

## 3. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js (JavaScript) | Static landing pages + dynamic booking app |
| Styling | Tailwind CSS | Utility-first; dark theme with yellow-green (`#CBFF00`) accent |
| Backend | Express.js (JavaScript) | REST API; stateless, permission-guarded routes |
| Database | PostgreSQL | ACID compliance, row-level locking, JSONB for flexible pricing rules |
| Auth | JWT (short-lived) + Redis Denylist | 15-minute access tokens; instant revocation for admins |
| OTP & Messaging | Meta WhatsApp Cloud API (direct) | OTP (Authentication templates), booking notifications (Utility templates), promotional campaigns (Marketing templates). No BSP middleman — billed directly by Meta in INR |
| Chat Support | Meta WhatsApp Cloud API (direct) | Inbound user-initiated messages; service replies are free with no monthly cap |
| Payments | PhonePe Payment Gateway | Webhook-driven confirmation; idempotent handling |
| File Storage | Cloudflare R2 | Court images, court selfie uploads from reviews |
| Background Jobs | Yet to be decided | Slot expiry sweeper, notification scheduler (options: BullMQ, pg-boss) |
| Real-time Sync | Yet to be decided | Slot state broadcast to all connected clients (options: Socket.io, SSE) |
| Caching / Session | Redis | JWT Denylist; optional slot-lock TTL cache |
| Hosting / Infra | Yet to be decided | |

---

## 4. System Architecture

### 4.1 Architectural Style

The platform follows a **headless architecture**: the Next.js frontend communicates exclusively with the Express.js backend over a versioned REST API. The backend owns all business logic; the frontend never calculates prices, slot availability, or booking states.

### 4.2 Multi-Tenancy Model

The `Venue` is the top-level container for all data. Every court, schedule, pricing rule, booking, and user role is scoped to a specific Venue. This enforces strict data isolation and allows a single deployment to serve multiple independent facilities.

### 4.3 Domain Breakdown

The system is divided into five logical domains:

| Domain | Purpose |
|---|---|
| **Venue & Courts** | Venue configuration, court metadata, court status |
| **Identity & RBAC** | Global user profiles, contextual role assignments per venue |
| **Scheduling & Pricing** | Operating hours, daily overrides, dynamic pricing rules, coupons |
| **Booking & Transactions** | Slot locking, state machine, payments, wallet credits |
| **Insights & Communications** | Analytics readiness, automated notification matrix, review system |

### 4.4 Key Integration Points

```
User Browser / Mobile
        │
        ▼
  Next.js Frontend  ──────────────────────────────┐
        │                                         │
        ▼ (REST API)                              │
  Express.js Backend                              │
   ├── PostgreSQL (primary data store)            │
   ├── Redis (JWT denylist + optional TTL locks)  │
   ├── PhonePe Gateway (payment intent + webhooks)│
   ├── WhatsApp API (OTP, notifications)          │
   └── Cloudflare R2 (image storage)              │
                                                  │
  Background Worker (slot expiry, notifications) ◄┘
```

---

## 5. Environments

| Environment | Purpose |
|---|---|
| Development | Local development with seeded test data |
| Staging | Pre-production; connected to PhonePe sandbox and MSG91 test OTPs |
| Production | Live; Besa Nagpur facility |

---

## 6. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Double-booking | Zero tolerance; enforced at the database layer |
| Slot lock duration | 10 minutes from selection to payment |
| OTP validity | Yet to be decided |
| JWT expiry | 15 minutes (access token) |
| Payment webhook idempotency | Must handle duplicate signals without side effects |
| Legal compliance | Digital liability waiver with logged timestamp, IP, and verified phone |
| Accessibility | Yet to be decided |
