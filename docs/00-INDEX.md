# Pickleball Booking Platform — Documentation Index

This directory contains the specifications, integration guides, operations guidelines, and architectural decision records for the court booking platform.

## 1. Product Requirements & Business Rules
- [01-PROJECT-OVERVIEW.md](product/01-PROJECT-OVERVIEW.md) — High-level product description, scope boundary, and roadmap.
- [02-BUSINESS-LOGIC.md](product/02-BUSINESS-LOGIC.md) — Strict rules for booking locks, RBAC matrices, cancellation credits, and OTP.
- [03-UI-UX-SPECIFICATION.md](product/03-UI-UX-SPECIFICATION.md) — Design system specifications, modal behaviors, and layout wireframes.
- [04-FUTURE-WORK.md](product/04-FUTURE-WORK.md) — Plans for Redis caching, WebSockets state sync, and reminders.

## 2. Technical Contracts & Specifications
- [01-DATABASE-SCHEMA.md](specs/01-DATABASE-SCHEMA.md) — Table columns, index specifications, and Prisma associations.
- [02-API-SPECIFICATION.md](specs/02-API-SPECIFICATION.md) — JSON payload shapes, REST routes, error mappings, and authentication.

## 3. Integrations & Operations
- [01-WHATSAPP-INTEGRATION.md](integrations/01-WHATSAPP-INTEGRATION.md) — Cloud API notification triggers, pricing schedules, and Meta verification.
- [02-PAYMENT-INTEGRATION.md](integrations/02-PAYMENT-INTEGRATION.md) — PhonePe checkout redirects, webhooks signature verification, and refunds.
- [01-COSTING-ANALYSIS.md](operations/01-COSTING-ANALYSIS.md) — Meta templates and payment txn costs.
- [02-SETUP-GUIDE.md](operations/02-SETUP-GUIDE.md) — Hetzner VM creation, Dokploy setup, local seeding, and Git hooks.

## 4. Architectural Decision Records (ADRs)
This registry lists the chronological status of major design choices. Rationale details reside in the links below.

| ADR ID | Decision Title | Status | Date Approved | Rationale Link |
|---|---|---|---|---|
| **ADR-001** | Selection of PostgreSQL database and Prisma ORM | Accepted | 2026-06-15 | [ADR-001 PostgreSQL/Prisma](adrs/ADR-001-postgresql-prisma.md) |
| **ADR-002** | Database-backed auth sessions for refresh token rotation | Accepted | 2026-06-15 | [ADR-002 Session Revocation](adrs/ADR-002-refresh-token-sessions.md) |
| **ADR-003** | Abstraction of OTP provider interface for sandbox fallback | Accepted | 2026-06-16 | [ADR-003 OTP Abstraction](adrs/ADR-003-otp-provider-abstraction.md) |
