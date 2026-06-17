# Pickleball Court Booking Platform

A production-grade court booking platform featuring row-level slot locking, WhatsApp OTP customer login, email/password staff authentication, PhonePe payment gateway integrations, and monetary wallet credits.

---

## 1. Documentation Directories

This codebase follows a structured, repository-native documentation model:

* **Product Specifications ([docs/](docs/00-INDEX.md))**: Contains high-level business specifications, user story maps, wireframe details, legal compliance checklists, and costing estimates.
* **AI Context & Technical State ([docs/ai/](docs/ai/00-INDEX.md))**: Contains technical architecture diagrams, Prisma database schemas, modular API endpoint definitions, active issue backlogs, and technical debt trackers.
* **Architectural Decisions ([docs/ai/13-DECISION-HISTORY.md](docs/ai/13-DECISION-HISTORY.md))**: Contains historical ADR logs detailing why specific tools and libraries were selected.

For AI agents and automated coding assistants, use [llms.txt](llms.txt) as the starting crawling index.

---

## 2. Onboarding Quick-Start

To get the codebase running locally:
1. Ensure Node.js `>=20.11.0` and a local PostgreSQL instance are available.
2. Refer to [docs/ai/09-DEVELOPMENT-GUIDE.md](docs/ai/09-DEVELOPMENT-GUIDE.md) to set up configuration environment keys, execute migrations, seed mock records, and run backend/frontend local instances.
3. To execute tests, navigate to the `/server` directory and run:
   ```bash
   npm run test
   ```
