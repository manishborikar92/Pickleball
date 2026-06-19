# ADR-007: Centralized Permission Catalog

## Status

Approved

## Context

Granular capability checks were previously executed using raw string literals (e.g., `'issue_credits'`, `'view_own_bookings'`). String literals are prone to spelling errors, cannot be tracked easily, and lack autocomplete support, which increases technical debt as the number of permissions grows.

## Decision

1.  Define a centralized `Permissions` constant object in `src/shared/auth-constants.js` containing all supported authorization permission keys.
2.  Replace all runtime string literals representing capabilities with property lookups from `Permissions` (e.g., `Permissions.ISSUE_CREDITS`).
3.  Do NOT import the runtime `Permissions` catalog in `prisma/seed.mjs` to avoid runtime-to-seed import coupling. Keep using raw strings in seed data.
4.  Implement a decoupled static unit test `tests/unit/permission-coupling.test.js` that parses `seed.mjs` offline and asserts that all seeded permissions match the runtime catalog to prevent catalog drift.

## Alternatives Considered

| Alternative | Tradeoff |
|---|---|
| Use raw string literals everywhere | Easiest to write, but highly error-prone and hard to trace permission references statically |
| Import runtime Permissions enum in database seed script | Simplifies seeding validation, but introduces undesirable runtime-to-database-migration dependency coupling |
| Decoupled constants with static coupling tests | Avoids seed-to-runtime coupling while statically guaranteeing alignment via automated unit tests |

## Consequences

*   **Benefits**:
    *   Provides autocomplete support and enables safe code renaming.
    *   Maintains decoupled seed scripts while guaranteeing catalog alignment.
*   **Trade-offs**: None.
