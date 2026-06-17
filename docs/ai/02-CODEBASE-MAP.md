# 02-CODEBASE-MAP

This document maps the repository layout, domain boundaries, module relationships, package dependencies, and requirement-to-file traceability.

## 1. Repository Layout & Navigation

```
/
├── docs/                          # All documentation and AI context
│   ├── product/                   # Business rules and specs
│   ├── specs/                     # API and DB specs
│   ├── integrations/              # WhatsApp and PhonePe integration details
│   ├── operations/                # Costings and server setup guides
│   ├── ai/                        # AI context (this folder)
│   └── adrs/                      # Architectural Decision Records
├── server/                        # Express.js REST API
│   ├── prisma/                    # Schema definition and seeding
│   ├── src/                       # Source files
│   │   ├── config/                # Environment configuration
│   │   ├── core/                  # Lifecycle hooks
│   │   ├── lib/                   # Database client (Prisma connection)
│   │   ├── middleware/            # Rate limiting, auth, logging guards
│   │   └── modules/               # Domain-driven backend modules
│   │       ├── auth/              # Customer OTP & staff password logic
│   │       ├── health/            # Liveness/Readiness endpoints
│   │       ├── openapi/           # OpenAPI routers and docs UI
│   │       └── users/             # User profiles and wallet details
│   └── tests/                     # Node.js native test suite
└── web/                           # Next.js App Router Frontend
    └── src/
        ├── app/                   # Next.js Page routes (grouped by domain)
        │   ├── (app)/dashboard    # Private customer views (bookings, wallet)
        │   ├── (auth)/            # Auth views (login, onboarding)
        │   ├── (public)/          # Landing page and booking slot selection
        │   └── (staff)/admin      # Staff administrative dashboards
        ├── components/            # Reusable UI React components
        ├── lib/                   # Next.js proxy-core and client-side RBAC
        └── proxy.js               # Edge request interceptor
```

---

## 2. Module Ownership & Dependencies

### 2.1 Backend Module Ownership (`server/package.json`)
- **Database Connection**: Managed by `server/src/lib/prisma.js` (Prisma client instance).
- **Authentication**: Managed by `server/src/modules/auth/` (OTP provider, JWT generation, password validation).
- **User Profiles**: Managed by `server/src/modules/users/` (profile lookup, updates, and wallet transactional tables).
- **Express Backend Dependencies**: `@prisma/client`, `prisma` CLI, `joi` (validation), `bcrypt` (staff security), `helmet` (HTTP headers), `express-rate-limit`, `cookie-parser`.
- **Test Infrastructure**: Express modular service checks run via native `node --test` runner using `supertest` for REST request mocking.

### 2.2 Frontend Module Ownership (`web/package.json`)
- **Routing & Gatekeeping**: Managed by `web/proxy.js` (Next.js middleware-equivalent interceptor) and `web/src/lib/proxy-core.js`.
- **Dashboard & Account Panels**: Managed by `web/src/app/(app)/dashboard` and subfolders.
- **Booking & Slot Selection UI**: Managed by `web/src/app/(public)/booking` (React page state holds consecutive slot parameters).
- **Staff Control Portals**: Managed by `web/src/app/(staff)/admin`.
- **Next.js Frontend Dependencies**: `next` (React framework), `react`, `react-dom`, `tailwindcss` (CSS styling).

---

## 3. Specification-to-Code Traceability Mapping

This table maps the product specifications to their database schemas, REST APIs, backend modules, and frontend pages.

| Product Spec Section | DB Models | API Routes (v1) | Backend Module | Frontend Component |
|---|---|---|---|---|
| Domain A: Venues & Courts | `Venue`, `Court` | `/venues/*` | `modules/openapi` | `components/features/admin` |
| Domain B: Customer Auth | `User`, `OtpRequest` | `/auth/otp/*` | `modules/auth` | `components/features/auth` |
| Domain B: Staff Auth | `StaffCredential` | `/auth/staff/*` | `modules/auth` | `app/(auth)/staff-login` |
| Domain C: Scheduling | `Schedule`, `ScheduleException` | `/venues/:id/availability` | `modules/scheduling (Planned)` | `components/features/booking` |
| Domain D: Slot Locking | `Booking`, `BookingSlot` | `/bookings/hold` | `modules/bookings (Planned)` | `app/(public)/booking` |
| Domain D: Payments | `Payment` | `/api/payment/*` | `modules/payments (Planned)` | `app/(app)/dashboard` |
| Domain D: Wallet | `WalletTransaction` | `/users/me/wallet` | `modules/users` | `app/(app)/dashboard/wallet` |
| Domain E: Reviews | `Review` | `/bookings/:id/review` | `modules/reviews (Planned)` | `components/features/review` |
| Domain F: Rewards | `RewardMechanism`, `RewardInstance` | `/rewards/*` | `modules/rewards (Planned)` | `app/(app)/dashboard/rewards (Planned)` |
