# Pickleball Court Booking Platform

A production-grade, end-to-end court booking and player engagement platform tailored for Pickleball venues. The system features a responsive Next.js frontend, an Express.js/PostgreSQL backend abstracted via Prisma ORM, automated WhatsApp OTP authentication, and PhonePe payment integration.

---

## 1. Project Overview & Problem Statement

### 1.1 Problem Statement
Booking court slots for Pickleball historically suffers from:
- **Double Booking**: Concurrent users attempting to select and pay for the same time slot at the same venue.
- **State Loss during Auth**: Forcing users to leave checkout flows to log in or register, causing slot selection loss.
- **Complex Schedule Management**: Venues require customized hourly pricing, schedule overrides for holidays, and specific locking windows (e.g., 10-minute hold limits).

### 1.2 Our Solution
This platform solves these friction points through:
1. **Atomic Booking holds**: Utilizing a PostgreSQL partial unique index (`booking_slots_no_double_book`) to enforce slot exclusivity atomically at hold time, preventing double bookings.
2. **In-Context Authentication**: A client-side state preservation architecture utilizing pop-up/bottom-sheet modal OTP validations. The user never navigates away from their booking configuration during registration.
3. **Role-Based Access Control (RBAC)**: Custom routing proxy mapping roles contextualized per venue, allowing operators to manage schedules dynamically.

---

## 2. Technology Stack

### 2.1 Frontend (`web/`)
- **Core Framework**: Next.js 16 (App Router, Cache Components, Partial Prerendering, Server Components)
- **Styling**: Tailwind CSS 4 (premium dark aesthetic with CSS custom properties)
- **State Management**: Server-side session via `verifySession()` — no global client auth context
- **Proxy**: Dynamic `src/proxy.js` at the edge — cookie-presence redirects, route guards, and proactive token refresh
- **Route Groups**: `(marketing)`, `(booking)`, `(auth)`, `(dashboard)`, `(admin)`
- **Customer Profile**: Authenticated customers can update their normalized name at `/dashboard/profile`, backed by `PATCH /api/v1/users/me`.

### 2.2 Backend (`server/`)
- **Core Framework**: Express.js (Node 20+)
- **ORM**: Prisma Client mapping PostgreSQL tables
- **Validation**: Joi schema validators guarding routing controllers
- **Security**: Bcrypt (admin passwords), Helmet headers, cookie-parser, and Express Rate Limiters

### 2.3 Database (`server/prisma/`)
- **Engine**: PostgreSQL
- **Key Models**: `User`, `Venue`, `Court`, `BookingSlot`, `Booking`, `Payment`, `WalletTransaction`

---

## 3. Repository Structure

```
.
├── llms.txt                       # Machine-readable AI entrypoint
├── docs/                          # Authority documentation layer
│   ├── README.md                  # Documentation entrypoint & ADR registry
│   ├── product/                   # Business requirements & logic specs
│   ├── specs/                     # API & Database schema contracts
│   ├── integrations/              # PhonePe & WhatsApp gateway specifications
│   ├── operations/                # VM deployment, Dokploy config, & costings
│   ├── ai/                        # AI context (Implementation details)
│   └── adrs/                      # Architectural Decision Records
├── server/                        # Express API Backend
│   ├── prisma/                    # Schema definition, migrations, & seeding
│   ├── src/                       # Backend module controller/service logic
│   └── tests/                     # Node native unit/integration tests
└── web/                           # Next.js 16 App Router Frontend
    ├── src/app/                   # Pages: (marketing), (booking), (auth), (dashboard), (admin)
    ├── src/components/            # UI components (features, layout, shared, seo)
    ├── src/lib/                   # Shared logic: dal/ (httpClient, session), actions/, services/, schemas/
    └── src/proxy.js               # Edge proxy (cookie redirects + proactive token refresh)
```

---

## 4. Local Development Quick Start

### 4.1 Prerequisites
- Node.js 20+
- PostgreSQL database instance

### 4.2 Initialize Backend
1. Clone the repository and navigate to the server folder:
   ```bash
   cd server/
   npm install
   ```
2. Copy environment keys:
   ```bash
   cp .env.example .env
   ```
   *Modify database connection string and credentials.*
3. Generate Prisma client & seed database:
   ```bash
   npx prisma migrate dev
   npm run prisma:seed
   ```
4. Run tests to confirm configuration:
   ```bash
   npm run test
   ```
5. Start Express dev server (runs on `http://localhost:5000`):
   ```bash
   npm run dev
   ```

### 4.3 Initialize Frontend
1. Navigate to the web folder:
   ```bash
   cd ../web/
   npm install
   ```
2. Copy environment keys:
   ```bash
   cp .env.example .env.local
   ```
3. Start Next.js dev server (runs on `http://localhost:3000`):
   ```bash
   npm run dev
   ```

---

## 5. Autoritative Documentation Directory

- **Project Scopes**: [docs/product/01-PROJECT-OVERVIEW.md](docs/product/01-PROJECT-OVERVIEW.md)
- **Business Logic & RBAC Rules**: [docs/product/02-BUSINESS-LOGIC.md](docs/product/02-BUSINESS-LOGIC.md)
- **Database Schema Schema**: [docs/specs/01-DATABASE-SCHEMA.md](docs/specs/01-DATABASE-SCHEMA.md)
- **API Rest Routing**: [docs/specs/02-API-SPECIFICATION.md](docs/specs/02-API-SPECIFICATION.md)
- **PhonePe Payment webhook Verification**: [docs/integrations/02-PAYMENT-INTEGRATION.md](docs/integrations/02-PAYMENT-INTEGRATION.md)
- **VM Setup & Dokploy configuration**: [docs/operations/02-SETUP-GUIDE.md](docs/operations/02-SETUP-GUIDE.md)

---

## 6. Implementation Context (AI Context Hub)

For developers and AI coding agents, the [docs/ai/](docs/ai/) directory houses deep, implementation-derived context:
- **Major Modules & Integrations**: [docs/ai/01-IMPLEMENTATION-OVERVIEW.md](docs/ai/01-IMPLEMENTATION-OVERVIEW.md)
- **Repository Mappings**: [docs/ai/02-CODEBASE-MAP.md](docs/ai/02-CODEBASE-MAP.md)
- **Feature Completion Checks**: [docs/ai/03-IMPLEMENTATION-STATUS.md](docs/ai/03-IMPLEMENTATION-STATUS.md)
- **Active Issues & compromises**: [docs/ai/04-ISSUES-AND-DEBT.md](docs/ai/04-ISSUES-AND-DEBT.md)
- **Update triggers & Authority Rules**: [docs/ai/05-MAINTENANCE-RULES.md](docs/ai/05-MAINTENANCE-RULES.md)
