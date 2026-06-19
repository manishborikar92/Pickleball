# Pickleball Booking Platform — Documentation Entrypoint

Welcome to the Pickleball Booking Platform documentation. This directory acts as the central hub for all project specifications, design records, integrations, and operational guides.

---

## 1. Documentation Map

Below is the structured layout of the documentation in this repository:

- **Product Requirements & Business Rules (`docs/product/`)**
  - [01-PROJECT-OVERVIEW.md](product/01-PROJECT-OVERVIEW.md) — Product vision, MVP features, and deferred roadmap.
  - [02-BUSINESS-LOGIC.md](product/02-BUSINESS-LOGIC.md) — Strict rules for booking locks, role permissions, cancellations, and OTP.
  - [03-UI-UX-SPECIFICATION.md](product/03-UI-UX-SPECIFICATION.md) — Design tokens, modal behaviors, and layout wireframes.
  - [04-FUTURE-WORK.md](product/04-FUTURE-WORK.md) — Roadmap for scaling, Redis queues, and notifications.
- **Authoritative Technical Contracts (`docs/specs/`)**
  - [01-DATABASE-SCHEMA.md](specs/01-DATABASE-SCHEMA.md) — PostgreSQL table columns, indexes, and Prisma associations.
  - [02-API-SPECIFICATION.md](specs/02-API-SPECIFICATION.md) — JSON payloads, REST routing paths, and authentication.
- **External Integrations (`docs/integrations/`)**
  - [01-WHATSAPP-INTEGRATION.md](integrations/01-WHATSAPP-INTEGRATION.md) — Cloud API notification webhooks, templates, and rates.
  - [02-PAYMENT-INTEGRATION.md](integrations/02-PAYMENT-INTEGRATION.md) — PhonePe checkout redirects, webhook signatures, and refunds.
- **Operations & VM Runbooks (`docs/operations/`)**
  - [01-COSTING-ANALYSIS.md](operations/01-COSTING-ANALYSIS.md) — SMS, Meta messages, and payment transaction cost spreadsheets.
  - [02-SETUP-GUIDE.md](operations/02-SETUP-GUIDE.md) — Hetzner VM creation, Dokploy config, local environment setup, and seeding.
- **AI Context Layer (`docs/ai/`)**
  - [01-IMPLEMENTATION-OVERVIEW.md](ai/01-IMPLEMENTATION-OVERVIEW.md) — High-level Express/Next.js implementation snapshot.
  - [02-CODEBASE-MAP.md](ai/02-CODEBASE-MAP.md) — Folder navigation, module ownership, and spec-to-code traceability.
  - [03-IMPLEMENTATION-STATUS.md](ai/03-IMPLEMENTATION-STATUS.md) — Checklists of built vs planned modules.
  - [04-ISSUES-AND-DEBT.md](ai/04-ISSUES-AND-DEBT.md) — Logs active bugs, test suite status, and technical debt compromises.
  - [05-MAINTENANCE-RULES.md](ai/05-MAINTENANCE-RULES.md) — Update triggers, stale context detection, and authority models.

---

## 2. Reading Paths by Audience

To navigate this documentation efficiently, choose the path that matches your role:

### A. AI Agents & Coding Assistants
1. Start with the root [llms.txt](../llms.txt) to parse the primary entrypoints.
2. Read [docs/ai/01-IMPLEMENTATION-OVERVIEW.md](ai/01-IMPLEMENTATION-OVERVIEW.md) for the high-level implementation summary.
3. Review [docs/ai/02-CODEBASE-MAP.md](ai/02-CODEBASE-MAP.md) and [docs/ai/05-MAINTENANCE-RULES.md](ai/05-MAINTENANCE-RULES.md) for structural rules and coding boundaries.

### B. Product Managers & Designers
1. Read [docs/product/01-PROJECT-OVERVIEW.md](product/01-PROJECT-OVERVIEW.md) to understand scope boundaries.
2. Refer to [docs/product/02-BUSINESS-LOGIC.md](product/02-BUSINESS-LOGIC.md) for state matrices and cancel credits.
3. Inspect [docs/product/03-UI-UX-SPECIFICATION.md](product/03-UI-UX-SPECIFICATION.md) for design specifications.

### C. Backend & Frontend Engineers
1. Study [docs/specs/01-DATABASE-SCHEMA.md](specs/01-DATABASE-SCHEMA.md) and [docs/specs/02-API-SPECIFICATION.md](specs/02-API-SPECIFICATION.md) to align on database structures and routes.
2. Refer to [docs/integrations/02-PAYMENT-INTEGRATION.md](integrations/02-PAYMENT-INTEGRATION.md) for webhook signature algorithms.
3. Read [docs/ai/03-IMPLEMENTATION-STATUS.md](ai/03-IMPLEMENTATION-STATUS.md) to check feature completeness.

### D. DevOps & Infrastructure Operators
1. Open [docs/operations/02-SETUP-GUIDE.md](operations/02-SETUP-GUIDE.md) to initialize the local sandbox or provision VMs.
2. Read [docs/operations/01-COSTING-ANALYSIS.md](operations/01-COSTING-ANALYSIS.md) to monitor Meta template and transaction overhead.

---

## 3. Architectural Decision Records (ADRs)

We document major technology selections and designs through ADRs.

| ADR ID | Decision Title | Status | Date Approved | Rationale Link |
|---|---|---|---|---|
| **ADR-001** | Selection of PostgreSQL database and Prisma ORM | Accepted | 2026-06-15 | [ADR-001 PostgreSQL/Prisma](adrs/ADR-001-postgresql-prisma.md) |
| **ADR-002** | Database-backed auth sessions for refresh token rotation | Accepted | 2026-06-15 | [ADR-002 Session Revocation](adrs/ADR-002-refresh-token-sessions.md) |
| **ADR-003** | Abstraction of OTP provider interface for sandbox fallback | Accepted | 2026-06-16 | [ADR-003 OTP Abstraction](adrs/ADR-003-otp-provider-abstraction.md) |
| **ADR-004** | Booking Consistency, Payment Abstraction, and Compliance Logging | Approved | 2026-06-17 | [ADR-004 Booking Lifecycle](adrs/ADR-004-booking-lifecycle-payments.md) |
| **ADR-005** | Decoupling of Authentication and Authorization Domains | Approved | 2026-06-19 | [ADR-005 Auth Separation](adrs/ADR-005-auth-separation.md) |
| **ADR-006** | Transition to Boot-Time Dependency Injection | Approved | 2026-06-19 | [ADR-006 Boot DI](adrs/ADR-006-boot-di.md) |
| **ADR-007** | Centralized Permission Catalog | Approved | 2026-06-19 | [ADR-007 Permission Catalog](adrs/ADR-007-permission-catalog.md) |
| **ADR-008** | Standardized Domain Error Hierarchy | Approved | 2026-06-19 | [ADR-008 Error Hierarchy](adrs/ADR-008-error-hierarchy.md) |

---
*For quick startup, see the root [README.md](../README.md).*
