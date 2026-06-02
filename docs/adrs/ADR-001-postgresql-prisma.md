# ADR-001: Use PostgreSQL and Prisma for Application Persistence

## Status

Accepted

## Context

The server scaffold was created from a generic MongoDB-capable template. Product documentation, booking rules, and deployment guidance require PostgreSQL. The development database was inspected and the application-owned `public` schema is empty, so there is no legacy schema to preserve.

## Decision

Use PostgreSQL as the only application database and Prisma as the ORM and migration source of truth. Remove MongoDB-specific dependencies, configuration, connection code, and repository assumptions unless a non-database utility remains useful.

## Alternatives Considered

| Alternative | Tradeoff |
|---|---|
| Keep Mongoose/MongoDB | Conflicts with product docs and cannot enforce booking locks cleanly |
| Use `pg` with raw SQL only | Maximum control, but weaker schema discoverability for a fast-moving pre-launch project |
| Use Knex | Good migrations and SQL control, but less type visibility and model clarity than Prisma |
| Use Prisma | Strong schema and migration workflow; partial indexes require raw SQL in migrations |

## Consequences

Prisma owns models, generated client access, and migration history. Raw SQL remains acceptable inside migrations for PostgreSQL features Prisma cannot model, such as partial unique indexes. Supabase-managed schemas are left untouched.
