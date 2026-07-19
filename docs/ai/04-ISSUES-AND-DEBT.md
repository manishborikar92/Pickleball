# 04-ISSUES-AND-DEBT

This document logs active codebase issues, test suite statuses, environment sandbox behaviors, planned refactoring operations, and technical compromises (debt).

---

## 1. Active Issues & Anomalies

### 1.1 Codebase Bugs
- *No active codebase bugs are reported.*
- Bugs are logged here upon verification of unit/integration test failures or reports from staging environments. Resolving a bug and committing its fix removes it from this file.

### 1.2 Environment Discrepancies
- **Local OTP Provider Fallback**: The development environment logs OTP codes directly to the terminal console when Meta Cloud API credentials are unset. This allows local developer setup without Meta billing accounts.
- **Test Environment Database Bypass**: Integration tests run with `DATABASE_ENABLED=false` configured in `.env.test`, mocking repository queries and database constraints (such as mapping unique error codes like `P2002` for slot conflicts). The code must still be verified with a live PostgreSQL instance.

---

## 2. Test Suite Execution & Status

Our QA gating requires all tests to pass prior to merging.

### 2.1 Backend Tests (`server/tests/`)
- **Framework**: Built using the native Node.js test runner (`node --test`), keeping testing free of third-party package dependencies like Jest.
- **Pass Metrics**: All 214 native test cases are passing successfully (153 unit tests and 61 integration tests).
  - Passes: 214
  - Failures: 0
- **Execution Command**:
  ```bash
  cd server/
  npm run test
  ```

### 2.2 Frontend Tests (`web/tests/`)
- **Framework**: Node.js native test runner for pure logic (RBAC, Zod schemas — including the reward
  mechanism editor's, normalizers, booking engine, the checkout service, and the booking- and
  review-status resolvers).
- **Pass Metrics**: All native `node:test` cases pass (Failures: 0).
- **Execution Command**:
  ```bash
  cd web/
  npm run test
  ```

### 2.3 Frontend Quality Gates (`web/`)
- Lint (incl. the `@/app/*` module-boundary rule — ADR-W009) and the Next.js build both pass.
- **Execution Command**:
  ```bash
  cd web/
  npm run lint && npm run test && npm run build
  ```

---

## 3. Planned Refactoring Actions

- **Scheduling Isolation**: When implementing the scheduling system, we will isolate it in `server/src/modules/scheduling/` instead of expanding `users` or `auth` modules. This preserves domain separation boundaries.
- **Unified OTP Mock Testing**: The frontend handles OTP prompts in both a booking AuthModal bottom-sheet and a standalone `/login` page. Shared verification components should be tested using unified end-to-end integration tests (Cypress/Playwright) once added to the repository.

---

## 4. Technical Compromises & Debt

As development progresses, we record architectural compromises to ensure they are addressed in future scaling cycles:

### 4.1 Database-Backed Session Rotation
- **Compromise**: Session tokens and refresh histories are stored directly in PostgreSQL tables (`auth_sessions` and `refresh_tokens`).
- **Debt Impact**: Rotating refresh tokens on every API call increases database write IOPS.
- **Remediation Plan**: As traffic scales, we will migrate these active session tables to a Redis cache layer, using PostgreSQL only for persistent user profile backups.

### 4.2 In-Memory Silent Concurrent Refresh Grace Period
- **Compromise**: To handle concurrent silent refresh requests from client applications, the Express backend verifies active refresh tokens using an in-memory rotation log.
- **Debt Impact**: The grace period cache is instance-specific. If the backend scales horizontally to multiple VM instances, concurrent refreshes routed to different instances will fail.
- **Remediation Plan**: Multi-instance scaling will require migrating the grace period cache from local in-memory stores to a shared Redis cluster.

### 4.3 Reward Mechanism Enum Reserve
- **Compromise**: The `RewardMechanismType` Prisma enum includes `coupon_drop` and `points` values with no launch implementation; the backend API accepts `scratch_card` and `spinner` at mechanism creation, but the web app exposes only the scratch-card experience — `rewardMechanismSchema` pins `type: "scratch_card"`, and no spinner UI, text, or option exists anywhere in the frontend.
- **Debt Impact**: Backend capability (`spinner`) with no reachable UI, plus enum values that cannot be exercised end-to-end. Product docs (`02-BUSINESS-LOGIC.md` §12.5) still describe the pre-voucher prize model pending PO sign-off (see `03-IMPLEMENTATION-STATUS.md` §3).
- **Remediation Plan**: Build the spinner wheel component when marketing wants a second experience (then widen the web schema's type enum); drop or implement `coupon_drop`/`points` at the next schema review; sync product docs with ADR-010 once the PO signs off.

### 4.4 No Release-Hold Endpoint (Holds Only Time Out)
- **Compromise**: ADR-004 deliberately provides no endpoint to release a booking hold — a `pending_payment` booking only lapses via its 10-minute TTL (sweeper job + lazy on-read expiry). The web checkout is designed around this: nothing is reserved until the final Confirm & Pay click (commit-on-confirm), and an abandoned post-commit payment is offered for resume rather than released.
- **Debt Impact**: A user who commits and then abandons payment keeps the slots locked for other customers until the TTL lapses, and the abandoned hold counts toward the 2-active-holds-per-user velocity cap (`HOLD_LIMIT_EXCEEDED` on a third commit within the window). Both effects are bounded at 10 minutes.
- **Remediation Plan**: If abandoned-hold contention becomes measurable, add an owner-scoped `POST /bookings/:bookingId/release` (idempotent; only from `pending_payment`, reusing `repository.expireBooking`) and call it from the web client when the user explicitly discards a committed checkout.
