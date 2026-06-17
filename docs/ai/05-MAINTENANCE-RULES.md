# 05-MAINTENANCE-RULES

This document defines the rules for maintaining, validating, and auditing the documentation and AI context layers.

## 1. Ownership Model
- **Product Specifications (`docs/product/`)**: Managed exclusively by the Product Owner (PO). No developer may modify these requirements without formal PO sign-off.
- **Technical Specifications (`docs/specs/`, `docs/integrations/`)**: Maintained by the Technical Lead or Solutions Architect.
- **Operations Specifications (`docs/operations/`)**: Maintained by DevOps and Operations Managers.
- **AI Context Layer (`docs/ai/`)**: Owned collectively by the development team. The Technical Lead governs and reviews these files during development cycles.

---

## 2. Context Maintenance Procedures & Authority Model
To maintain documentation integrity, the repository enforces a strict hierarchy of authority:

Codebase (Actual Behavior / Source of Truth)
↓
AI Context (Documentation of Actual Behavior)
↓
Product Documentation (Intended Behavior)
↓
ADRs
↓
Archive

### Core Authority Rules:
- **Source of Truth**: The codebase is always the source of truth for actual system behavior.
- **Intended Behavior**: Product documentation represents intended behavior.
- **Documenting Actual Behavior**: AI context documents actual behavior and records any divergence from specifications.
- **Handling Divergence**: When implementation differs from specifications, the AI context must document the divergence rather than assuming either source is correct. Do not update product specifications or assume the codebase is wrong without explicit verification; instead, log the difference in `docs/ai/04-ISSUES-AND-DEBT.md` under Divergences.

---

## 3. Update Triggers
Any code modification must trigger updates to the corresponding documentation and AI context files:
- **Exposing an API Route**: Update `docs/specs/02-API-SPECIFICATION.md` and `docs/ai/02-CODEBASE-MAP.md` (traceability matrix).
- **Database Schema Migration**: Update `docs/specs/01-DATABASE-SCHEMA.md` and `docs/ai/02-CODEBASE-MAP.md` (traceability matrix).
- **Feature Completion/Modification**: Update checklists and status in `docs/ai/03-IMPLEMENTATION-STATUS.md`.
- **Directory Restructuring / Package Updates**: Update `docs/ai/02-CODEBASE-MAP.md` and the root `llms.txt`.
- **Known Bugs or Test Failures**: Update `docs/ai/04-ISSUES-AND-DEBT.md`.
- **New Architecture Decisions**: Add a file to `docs/adrs/` and add a new row in the ADR registry section of `docs/INDEX.md`.

---

## 4. Review Requirements
- **PR Alignment**: Pull Requests that update backend routes, database schemas, or frontend directories must show corresponding updates to the `docs/ai/` files before merging.
- **Architectural Verification**: Any divergence from specifications documented in AI context must be reviewed and resolved by the Tech Lead and Product Owner during PR or sprint reviews.

---

## 5. Validation Requirements
- **Link Audits**: Developers must check that relative markdown links between relocated files resolve correctly before merging PRs.
- **Orphan Prevention**: Check that all directory paths introduced in the codebase are represented correctly in `docs/ai/02-CODEBASE-MAP.md`.

---

## 6. Stale Context Detection
- **Staleness Threshold**: Context files are considered stale if code changes to corresponding directories are merged without updates to the status checklists or codebase maps.
- **Automated Check**: If validation checks or manual reviews show new folders or endpoints are unmapped, the context is marked as stale.

---

## 7. Synchronization Workflows
- **Monthly Audits**: The Tech Lead will run a monthly manual audit comparing Git diffs over the month against changes to `docs/ai/` to ensure documentation matches the actual state of the codebase.
- **Traceability Cleanups**: Deprecated modules and removed routes must be cleared from `docs/ai/02-CODEBASE-MAP.md` (traceability matrix) to avoid confusing future AI agents.
