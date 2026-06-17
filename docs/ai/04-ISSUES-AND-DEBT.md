# 04-ISSUES-AND-DEBT

This document logs active codebase issues, test suite statuses, environment sandbox behaviors, planned refactoring operations, and technical compromises (debt).

---

## 1. Active Issues & Anomalies

### 1.1 Codebase Bugs
- *No active codebase bugs are reported.*
- Bugs are logged here upon verification of unit/integration test failures or reports from staging environments. Resolving a bug and committing its fix removes it from this file.

### 1.2 Environment Discrepancies
- **Local OTP Provider Fallback**: The development environment logs OTP codes directly to the terminal console when Meta Cloud API credentials are unset. This allows local developer setup without Meta billing accounts.
- **SQLite vs PostgreSQL Testing Constraints**: Development uses PostgreSQL, but testing utilizes in-memory databases or mock pools. Minor variations in SQL behavior (such as `SELECT FOR UPDATE` syntax) must be verified on local dev environments running PostgreSQL.

---

## 2. Test Suite Execution & Status

Our QA gating requires all tests to pass prior to merging.

### 2.1 Backend Tests (`server/tests/`)
- **Framework**: Built using the native Node.js test runner (`node --test`), keeping testing free of third-party package dependencies like Jest.
- **Pass Metrics**: All 51 native test cases are passing successfully.
  - Passes: 51
  - Failures: 0
- **Execution Command**:
  ```bash
  cd server/
  npm run test
  ```

### 2.2 Frontend Builds (`web/`)
- Next.js static compilation checks pass with zero warnings.
- **Execution Command**:
  ```bash
  cd web/
  npm run build
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
