# 04-ISSUES-AND-DEBT

This document tracks active bugs, test suite failures, environment anomalies, specification-to-code divergences, planned refactors, and technical compromises.

## 1. Active Codebase Bugs
*No active codebase bugs are reported.*

## 2. Test Suite Status
- **Backend Tests (`server/tests/`)**: All 51 native Node.js unit and integration tests are passing successfully.
  - Passes: 51
  - Failures: 0
- **Frontend Tests (`web/tests/`)**: Standard build checks are passing. Next.js static builds compile without warnings.

## 3. Environment Discrepancies
- **Local OTP Provider in Sandbox**: The local development server falls back to logging OTP codes directly to the terminal console when Meta Cloud API credentials are unset. This is expected behavior for local development.

---

## 4. Specification-to-Code Divergences
- **Dedicated Onboarding View Redirects**: The specifications ([03-UI-UX-SPECIFICATION.md](../product/03-UI-UX-SPECIFICATION.md)) did not explicitly outline the `next` redirect parameter behavior for returning to intermediate booking paths from `/onboarding`. The actual implementation uses a query-string parameter `?next=/dashboard` or `?next=/book` to preserve user paths.
- **Roles in JWT**: To avoid queries on protected route verification, the user's role list is cached inside the JWT access token subject payload directly, which deviates from checking DB tables on *every* route, though permission tables are still queried.

---

## 5. Planned Refactors
- **Modular Scheduling Engine**: Once the scheduling engine is built, it must be isolated inside a dedicated backend module (`server/src/modules/scheduling`) rather than being attached to the `users` or `auth` modules.
- **Unified OTP Flow in Frontend**: The frontend handles OTP onboarding prompts in both a global popup modal and a dedicated `/login` page. The shared steps should be thoroughly tested under a single automated end-to-end framework once Cypress or Playwright is introduced.

---

## 6. Technical Compromises (Debt)
- **PostgreSQL Session Revocation**: Session tracking is currently backed directly by PostgreSQL tables (`auth_sessions` and `refresh_tokens`). While suitable for launch, as traffic grows, database read/write volume for cookie rotation will increase. This should be migrated to Redis.
- **Local In-Memory Grace Period**: Silent concurrent refresh requests are validated using an in-memory rotation log on the server instance. This limits scalability to a single server instance. Multi-instance scaling will require a shared Redis state store.
