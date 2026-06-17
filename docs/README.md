# Pickleball Booking Platform — Documentation Index

Welcome to the documentation repository for the Pickleball Booking Platform. This documentation is organized into clear domain folders based on Option C.

---

## Documentation Folders Map

### 1. [Product Specs (product/)](product/01-PROJECT-OVERVIEW.md)
*Business intent, requirements, and user experience specs.*
*   [01-PROJECT-OVERVIEW.md](product/01-PROJECT-OVERVIEW.md): Besa Nagpur facility scope, courts count, and MVP definitions.
*   [02-PROJECT-CONTEXT.md](product/02-PROJECT-CONTEXT.md): Customer and staff user journeys, roles overview, and contextual scopes.
*   [03-BUSINESS-LOGIC.md](product/03-BUSINESS-LOGIC.md): Core functional workflows, customer onboarding paths, and refund logic intent.
*   [04-UI-UX-SPECIFICATION.md](product/04-UI-UX-SPECIFICATION.md): Layout guides, styling variables, grid layouts, and color tokens.
*   [05-COSTING-ANALYSIS.md](product/05-COSTING-ANALYSIS.md): Running costs breakdown for server, WhatsApp API, and domains.
*   [06-FUTURE-WORK.md](product/06-FUTURE-WORK.md): Deferred post-MVP features, gamification, and reward engines.

### 2. [Technical Architecture (architecture/)](architecture/01-SYSTEM-DESIGN.md)
*System boundaries, designs, data schemas, and API contracts.*
*   [01-SYSTEM-DESIGN.md](architecture/01-SYSTEM-DESIGN.md): Network boundaries topology, container specs, and deployment architecture.
*   [02-DATABASE-SCHEMA.md](architecture/02-DATABASE-SCHEMA.md): Table-level business meanings, columns descriptions, and relational prose.
*   [03-DATABASE-MODEL.md](architecture/03-DATABASE-MODEL.md): Prisma client database mappings, schema index rules, and Mermaid ER diagram.
*   [04-FRONTEND.md](architecture/04-FRONTEND.md): Next.js router conventions, middleware boundary rules, and CSS styling guidelines.
*   [05-BACKEND.md](architecture/05-BACKEND.md): Express modules divisions, route files, and middleware pipeline flow.
*   [06-BUSINESS-RULES.md](architecture/06-BUSINESS-RULES.md): Technical permissions keys, checkout slot holds limits, and pricing waterfalls logic.
*   [07-INTEGRATIONS.md](architecture/07-INTEGRATIONS.md): Unified PhonePe Checkout v2 signature, WhatsApp template payloads, and Cloudflare R2 configurations.
*   [API Specifications Directory (api/)](architecture/api/00-INDEX.md): Modular request/response endpoints schema definitions.

### 3. [Operations & Maintenance (operations/)](operations/01-DEVELOPMENT-GUIDE.md)
*Local development guides, infrastructure setup instructions, status trackings.*
*   [01-DEVELOPMENT-GUIDE.md](operations/01-DEVELOPMENT-GUIDE.md): Local development run scripts, seed generators, and testing commands.
*   [02-INFRASTRUCTURE-SETUP.md](operations/02-INFRASTRUCTURE-SETUP.md): Infrastructure provisioning setup steps for GoDaddy, Hetzner, Dokploy, and Cloudflare.
*   [03-MAINTENANCE-RULES.md](operations/03-MAINTENANCE-RULES.md): Rule governance, changelog triggers, and documentation rules.
*   [04-IMPLEMENTATION-STATUS.md](operations/04-IMPLEMENTATION-STATUS.md): Current completion status mapping of all modules.
*   [05-ACTIVE-ISSUES.md](operations/05-ACTIVE-ISSUES.md): Active sandbox locks, runtime exceptions, and bug logs.
*   [06-TECHNICAL-DEBT.md](operations/06-TECHNICAL-DEBT.md): Stubs, optimization tickets, and deferred performance backlogs.

### 4. [Architectural Decision Records (adrs/)](adrs/00-INDEX.md)
*Record of decisions explaining technical selections.*
*   [00-INDEX.md](adrs/00-INDEX.md): Index linking to individual ADR documents.
*   [ADR-001-postgresql-prisma.md](adrs/ADR-001-postgresql-prisma.md): Selection of PostgreSQL database engine.
*   [ADR-002-refresh-token-sessions.md](adrs/ADR-002-refresh-token-sessions.md): Architecture of refresh sessions rotation.
*   [ADR-003-otp-provider-abstraction.md](adrs/ADR-003-otp-provider-abstraction.md): Selection of abstract messaging providers interfaces.

### 5. [Historical Reports (reports/)](reports/DOCUMENTATION-MIGRATION-REPORT.md)
*Audits and relocation reviews.*
*   [DOCUMENTATION-MIGRATION-REPORT.md](reports/DOCUMENTATION-MIGRATION-REPORT.md): Relocation execution logs and post-migration validation checks.
