# AI Project Context — Maintenance Rules

This document establishes the governance, change management, and strict update matrix for the Pickleball Booking Platform AI Context system. It ensures that documentation remains perfectly synchronized with code changes.

---

## 1. Documentation Update Triggers

Whenever any changes are made to the codebase, the developer or AI assistant must update the corresponding documentation files immediately before completing the task.

| Trigger / Type of Change | Target AI Documentation Files to Update |
|:---|:---|
| **New Feature Implementation** | [10-IMPLEMENTATION-STATUS.md](10-IMPLEMENTATION-STATUS.md) (Move to Implemented)<br>[03-BUSINESS-RULES.md](03-BUSINESS-RULES.md) (Add logic)<br>[05-API/](05-API/00-INDEX.md) (Add/update endpoint contract files) |
| **Feature Modification** | [03-BUSINESS-RULES.md](03-BUSINESS-RULES.md) (Amend logic)<br>[05-API/](05-API/00-INDEX.md) (Update contracts)<br>[10-IMPLEMENTATION-STATUS.md](10-IMPLEMENTATION-STATUS.md) (Amend implementation details) |
| **Bug Fix** | [11-ACTIVE-ISSUES.md](11-ACTIVE-ISSUES.md) (Remove bug entry)<br>[10-IMPLEMENTATION-STATUS.md](10-IMPLEMENTATION-STATUS.md) (Update verification state) |
| **Refactor** | [06-FRONTEND.md](06-FRONTEND.md) or [07-BACKEND.md](07-BACKEND.md) (Update file & folder layout maps) |
| **API Endpoints Change** | [05-API/](05-API/00-INDEX.md) (Modify target endpoints, schemas, parameters, or permissions) |
| **Database Schema Change** | [04-DATABASE.md](04-DATABASE.md) (Update tables, columns, indexes, relationships) |
| **Business Logic Change** | [03-BUSINESS-RULES.md](03-BUSINESS-RULES.md) (Update waterfalls, timers, state transitions) |
| **Integration Webhooks / APIs**| [08-INTEGRATIONS.md](08-INTEGRATIONS.md) (Update PhonePe, WhatsApp, or R2 credentials/contracts) |
| **Infrastructure / VM Change** | [02-ARCHITECTURE.md](02-ARCHITECTURE.md) (Update deployment architecture/hosting) |
| **Dev commands / Variables** | [09-DEVELOPMENT-GUIDE.md](09-DEVELOPMENT-GUIDE.md) (Update run script descriptions or env templates) |
| **ADR / Design Decision** | [13-DECISION-HISTORY.md](13-DECISION-HISTORY.md) (Append summary; add ADR to `docs/adrs/`) |
| **Doc File Renaming / Moving** | [llms.txt](../../llms.txt) (Update navigation relative links) |

---

## 2. Completion Criteria for Code Changes

A task is not considered "done" until the following verification checklist is completed:

1. **Verify Implementation Against Status**: If a feature is coded, its state in [10-IMPLEMENTATION-STATUS.md](10-IMPLEMENTATION-STATUS.md) must be transitioned to **Implemented** (or **Partially Implemented** if stubs remain).
2. **Review Intended Behavior Gaps**: If any business rules described in [03-BUSINESS-RULES.md](03-BUSINESS-RULES.md) are not fully realized in the codebase, the gap must be logged in [12-TECHNICAL-DEBT-AND-DEFERRED-WORK.md](12-TECHNICAL-DEBT-AND-DEFERRED-WORK.md) or [11-ACTIVE-ISSUES.md](11-ACTIVE-ISSUES.md).
3. **Link Verification**: Ensure all internal links point to valid files.
4. **No Code Duplication in Docs**: Do not paste large blocks of actual code (JavaScript/TypeScript/SQL) into the context files. Link directly to the code files using markdown links (e.g. [app.js](../../server/src/app.js)) instead.

---

## 3. Strict Anti-Hallucination Rules

1. **Codebase is the Final Validator**: AI models must never assume a feature is implemented just because it was planned in product requirements. If the files or routing directories do not exist in the source directories (`/server/src` or `/web/src`), the feature is strictly marked **Planned** or **Deferred**.
2. **intended vs. Actual**: Intended behavior resides in `docs/ai/`. Actual state resides in code. Any deviation is considered a bug or technical debt and must be documented as such in [11-ACTIVE-ISSUES.md](11-ACTIVE-ISSUES.md) or [12-TECHNICAL-DEBT-AND-DEFERRED-WORK.md](12-TECHNICAL-DEBT-AND-DEFERRED-WORK.md).
