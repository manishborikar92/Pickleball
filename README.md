# Pickleball Court Booking Platform

A production-grade court booking platform featuring row-level slot locking, WhatsApp OTP customer login, email/password staff authentication, PhonePe payment gateway integrations, and monetary wallet credits.

---

## 1. Documentation Directories

This codebase follows a structured, domain-based documentation model:

*   **Documentation Entrypoint ([docs/README.md](docs/README.md))**: The main table of contents for human developers.
*   **Product Layer ([docs/product/01-PROJECT-OVERVIEW.md](docs/product/01-PROJECT-OVERVIEW.md))**: Business intent, scope definitions, wireframes, pricing policies, costing sheets, and future plans.
*   **Technical Design ([docs/architecture/01-SYSTEM-DESIGN.md](docs/architecture/01-SYSTEM-DESIGN.md))**: System topology boundaries, Prisma mappings, entity relationships, backend modules, and modular [API specifications](docs/architecture/api/00-INDEX.md).
*   **Operations & Infrastructure ([docs/operations/01-DEVELOPMENT-GUIDE.md](docs/operations/01-DEVELOPMENT-GUIDE.md))**: Guides for developers and sysadmins, run commands, deployments checklists, active issues logs, and technical debt trackers.
*   **Decision History ([docs/adrs/00-INDEX.md](docs/adrs/00-INDEX.md))**: Historical ADR logs detailing choices of framework and tools.

For AI agents and automated coding assistants, use [llms.txt](llms.txt) as the starting crawling index.

---

## 2. Onboarding Quick-Start

To get the codebase running locally:
1. Ensure Node.js `>=20.11.0` and a local PostgreSQL instance are available.
2. Refer to the [Development Guide](docs/operations/01-DEVELOPMENT-GUIDE.md) to set up configuration environment keys, execute migrations, seed mock records, and run backend/frontend local instances.
3. To execute tests, navigate to the `/server` directory and run:
   ```bash
   npm run test
   ```
