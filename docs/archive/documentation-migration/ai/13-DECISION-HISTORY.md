# AI Project Context — Architectural Decision History

This document indexes and summarizes all Architectural Decision Records (ADRs) defined in the Pickleball Booking Platform codebase.

---

## 1. Architectural Decisions Index

| ADR Identifier | Title / Short Summary | Current Status | Original Reference |
|:---|:---|:---|:---|
| **ADR-001** | **Use PostgreSQL and Prisma for Application Persistence**<br>Decides to use PostgreSQL as the primary database and Prisma as the ORM, removing MongoDB connection configurations. | Accepted | [ADR-001-postgresql-prisma.md](../adrs/ADR-001-postgresql-prisma.md) |
| **ADR-002** | **Add Refresh Token Rotation and Server-Side Sessions From Day One**<br>Requires short-lived JWT access tokens and opaque refresh token rotation cookies to support revocations and multi-device sessions. | Accepted | [ADR-002-refresh-token-sessions.md](../adrs/ADR-002-refresh-token-sessions.md) |
| **ADR-003** | **Use Environment-Selected OTP Providers**<br>Abstracts the OTP delivery layer behind an environment parameter (`OTP_MODE`) supporting sandbox (`123456`), tests, and production Meta WhatsApp channels. | Accepted | [ADR-003-otp-provider-abstraction.md](../adrs/ADR-003-otp-provider-abstraction.md) |
