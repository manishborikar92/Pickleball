# 02-CODEBASE-MAP

This document maps the repository layout, domain boundaries, module relationships, package dependencies, and requirement-to-file traceability mapping.

---

## 1. Repository Layout & File Mapping

The Pickleball platform uses a monorepo-adjacent layout split into Next.js App Router frontend and Express.js REST API backend:

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
│   │   ├── schema.prisma          # Database schemas and index designs
│   │   └── seed.js                # Seed scripts for roles and venues
│   ├── src/                       # Source files
│   │   ├── config/                # Environment configuration
│   │   ├── core/                  # Lifecycle hooks
│   │   ├── lib/                   # Database client (Prisma connection)
│   │   ├── middleware/            # Rate limiting, auth, logging guards
│   │   └── modules/               # Domain-driven backend modules
│   │       ├── auth/              # Customer OTP & staff password logic
│   │       ├── bookings/          # Selection, holds, waivers, and pricing
│   │       ├── health/            # Liveness/Readiness endpoints
│   │       ├── openapi/           # OpenAPI specs and Postman generation
│   │       ├── payments/          # Gateway logic: PhonePe provider, webhook, redirect, reconciliation
│   │       ├── reviews/           # Venue reviews: submission, public listing, and moderation
│   │       ├── users/             # User profile, wallet, and history
│   │       └── venues/            # Venues, courts, and availability
│   └── tests/                     # Node.js native test suite
└── web/                           # Next.js 16 App Router Frontend
    └── src/
        ├── app/                   # Next.js Page routes (grouped by domain)
        │   ├── (marketing)/       # Static/cached public pages (landing, about, terms, privacy, support)
        │   ├── (booking)/         # Dynamic booking flow (venue selection, checkout, confirmation)
        │   ├── (auth)/            # Auth views (login, onboarding, staff-login) + co-located actions
        │   ├── (dashboard)/       # Customer authenticated views (overview, bookings, wallet)
        │   └── (admin)/           # Staff admin dashboards (overview, bookings, schedule, pricing, courts, users, settings)
        ├── components/            # Reusable UI React components (features, layout, shared, seo)
        ├── lib/                   # Server utilities (apiClient, session, cookies, rbac, normalizers, bookingEngine)
        ├── config/                # Application configuration (venue, metadata, map)
        ├── hooks/                 # Client-side hooks (useOverlay, useTable)
        └── proxy.js               # Thin redirect-only proxy (cookie presence checks, no data fetching)
```

---

## 2. Module Ownership & Maintenance Guidelines

### 2.1 Backend Modules (`server/src/modules/`)
- **Database Client Layer (`server/src/lib/prisma.js`)**: Configures the connection pool, handles transaction logging, and logs query metrics. *Owner: Database Architect*.
- **Authentication Module (`server/src/modules/auth/`)**: Handles OTP dispatch via WhatsApp API, credential verification, and JSON Web Token (JWT) session cookies. *Owner: Security Engineer*.
- **User Profile & Wallet Module (`server/src/modules/users/`)**: Manages user onboard states, user profile fields, and wallet ledger logs. *Owner: Core Developer*.
- **Reviews Module (`server/src/modules/reviews/`)**: Owns all `/reviews` routes — submission for completed bookings, public venue listings with rating summaries, the owner's own-review lookup, and permission-gated moderation. Reviews depend one-way on bookings (eligibility gate) and never the reverse. *Owner: Core Developer*.
- **API Spec & OpenAPI Modules (`server/src/modules/openapi/`)**: Compiles Swagger specs and serves OpenAPI schemas. *Owner: Tech Lead*.

### 2.2 Frontend Components (`web/src/`)
- **Thin Proxy (`web/proxy.js`)**: Lightweight cookie-presence checks and redirects. No data fetching or token refresh. *Owner: Security Engineer*.
- **Server Auth (`web/src/lib/session.js`)**: Single auth check via `getSession()` memoized with React `cache()`. *Owner: Security Engineer*.
- **API Client (`web/src/lib/apiClient.js`)**: Server-only API client with automatic token refresh on 401 responses. *Owner: Core Developer*.
- **Cookie Management (`web/src/lib/cookies.js`)**: Centralized cookie operations (set, clear, extract). *Owner: Core Developer*.
- **Marketing Pages (`web/src/app/(marketing)/`)**: Static/cached pages with shared Header + Footer layout. *Owner: Frontend Engineer*.
- **Booking Flow (`web/src/app/(booking)/`)**: Dynamic booking with co-located server actions. *Owner: Frontend Engineer*.
- **Customer Dashboard (`web/src/app/(dashboard)/`)**: Renders bookings list, wallet balance with Suspense streaming. *Owner: Frontend Engineer*.
- **Admin Panel (`web/src/app/(admin)/`)**: Operator interface for schedules, pricing, courts, users. *Owner: Frontend Engineer*.

---

## 3. Dependency Mapping & Rationales

### 3.1 Backend Dependencies (`server/package.json`)
- **Prisma Client (`@prisma/client`)**: Chosen for type-safe query generation, migrations, and declarative database schema definitions.
- **Joi (`joi`)**: Enforces validation gating on all controllers, preventing dirty inputs from entering database queries.
- **Bcrypt (`bcrypt`)**: Staff passwords are hashed using standard bcrypt rounds to satisfy security standards.
- **Helmet (`helmet`)**: Configures HTTP headers (CSP, X-Frame-Options) to secure Express against web vulnerabilities.
- **Cookie Parser (`cookie-parser`)**: Extracts HTTP-only session cookies in middleware before JWT verification.
- **Supertest (`supertest`)**: Used in native Node tests to mock Express request handlers without binding to TCP ports.

### 3.2 Frontend Dependencies (`web/package.json`)
- **Next.js (`next`)**: Used for Server-Side Rendering (SSR), App Router layouts, and edge API route proxying.
- **Tailwind CSS (`tailwindcss`)**: Standard CSS framework chosen to construct a responsive, premium dark theme layout using custom colors (e.g., `#CBFF00` accent color).

---

## 4. Specification-to-Code Traceability Mapping

This matrix establishes bidirectional mapping between product specifications and the corresponding codebase files.

| Spec Area | Target Specification | Database Tables | Backend Module | Frontend Component |
| :--- | :--- | :--- | :--- | :--- |
| **Venues & Courts** | `docs/product/01-PROJECT-OVERVIEW.md` | `Venue`, `Court` | `server/src/modules/venues` | `web/src/components/features/admin` |
| **Customer Auth** | `docs/product/02-BUSINESS-LOGIC.md` | `User`, `OtpRequest` | `server/src/modules/auth` | `web/src/components/features/auth` |
| **Staff Auth** | `docs/product/02-BUSINESS-LOGIC.md` | `StaffCredential` | `server/src/modules/auth` | `web/src/app/(auth)/staff-login` |
| **Scheduling Engine** | `docs/product/02-BUSINESS-LOGIC.md` | `Schedule`, `ScheduleException` | `server/src/modules/venues` | `web/src/components/features/booking` |
| **Slot Locking** | `docs/product/02-BUSINESS-LOGIC.md` | `BookingSlot`, `Booking` | `server/src/modules/bookings` | `web/src/app/(booking)/venues/[slug]/book` |
| **PhonePe Payments**| `docs/integrations/02-PAYMENT-INTEGRATION.md`| `Payment` | `server/src/modules/payments` | `web/src/app/(dashboard)/dashboard` |
| **Wallet Credits** | `docs/product/02-BUSINESS-LOGIC.md` | `WalletTransaction` | `server/src/modules/users` | `web/src/app/(dashboard)/dashboard/wallet` |
| **Review Rating** | `docs/product/01-PROJECT-OVERVIEW.md` | `Review` | `server/src/modules/reviews` | `web/src/components/features/review` |
| **Rewards Engine** | `docs/product/01-PROJECT-OVERVIEW.md` | `RewardInstance` | `server/src/modules/rewards (Planned)` | `web/src/app/(dashboard)/dashboard/rewards` |
