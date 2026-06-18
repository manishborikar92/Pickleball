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
│   │       ├── payments/          # Gateway logic and sandbox provider
│   │       ├── users/             # User profile, wallet, and history
│   │       └── venues/            # Venues, courts, and availability
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

## 2. Module Ownership & Maintenance Guidelines

### 2.1 Backend Modules (`server/src/modules/`)
- **Database Client Layer (`server/src/lib/prisma.js`)**: Configures the connection pool, handles transaction logging, and logs query metrics. *Owner: Database Architect*.
- **Authentication Module (`server/src/modules/auth/`)**: Handles OTP dispatch via WhatsApp API, credential verification, and JSON Web Token (JWT) session cookies. *Owner: Security Engineer*.
- **User Profile & Wallet Module (`server/src/modules/users/`)**: Manages user onboard states, user profile fields, and wallet ledger logs. *Owner: Core Developer*.
- **API Spec & OpenAPI Modules (`server/src/modules/openapi/`)**: Compiles Swagger specs and serves OpenAPI schemas. *Owner: Tech Lead*.

### 2.2 Frontend Components (`web/src/`)
- **Proxy Interception (`web/proxy.js` & `web/src/lib/proxy-core.js`)**: Extracts auth headers from incoming secure requests. *Owner: Security Engineer*.
- **Onboarding Page (`web/src/app/(auth)/onboarding`)**: Handles onboarding flows. *Owner: Frontend Engineer*.
- **Private Dashboard (`web/src/app/(app)/dashboard`)**: Renders bookings list, wallet balance, and transaction history. *Owner: Frontend Engineer*.
- **Admin Panel (`web/src/app/(staff)/admin`)**: Operator interface for schedules. *Owner: Frontend Engineer*.

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
| **Slot Locking** | `docs/product/02-BUSINESS-LOGIC.md` | `BookingSlot`, `Booking` | `server/src/modules/bookings` | `web/src/app/(public)/booking` |
| **PhonePe Payments**| `docs/integrations/02-PAYMENT-INTEGRATION.md`| `Payment` | `server/src/modules/payments` | `web/src/app/(app)/dashboard` |
| **Wallet Credits** | `docs/product/02-BUSINESS-LOGIC.md` | `WalletTransaction` | `server/src/modules/users` | `web/src/app/(app)/dashboard/wallet` |
| **Review Rating** | `docs/product/01-PROJECT-OVERVIEW.md` | `Review` | `server/src/modules/reviews (Planned)` | `web/src/components/features/review` |
| **Rewards Engine** | `docs/product/01-PROJECT-OVERVIEW.md` | `RewardInstance` | `server/src/modules/rewards (Planned)` | `web/src/app/(app)/dashboard/rewards` |
