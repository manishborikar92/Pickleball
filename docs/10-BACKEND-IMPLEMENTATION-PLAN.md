# Backend Platform Implementation Plan

## Goal

Build the greenfield PostgreSQL/Prisma backend foundation, production authentication/session system, onboarding APIs, API documentation, Postman automation, and frontend auth integration.

## Execution Rules

- Use TDD for behavior-bearing backend services and API routes.
- Keep migrations as the database source of truth.
- Do not preserve MongoDB scaffold decisions.
- Keep Supabase-managed schemas untouched.
- Verify each slice before moving to the next.

## File Structure

### Backend

- `server/prisma/schema.prisma`: Prisma data model.
- `server/prisma/migrations/*/migration.sql`: SQL migration source of truth.
- `server/src/config/env.js`: validated PostgreSQL, JWT, refresh, cookie, OTP, and CORS configuration.
- `server/src/config/database.js`: Prisma lifecycle.
- `server/src/lib/prisma.js`: Prisma client singleton.
- `server/src/modules/auth/*`: OTP, token, session, customer auth, staff auth, routes, validators, tests.
- `server/src/modules/users/*`: current user, onboarding/profile APIs, tests.
- `server/src/modules/openapi/*`: OpenAPI registry/spec route.
- `server/scripts/generate-postman.mjs`: Postman collection/environment generation.
- `server/tests/*`: unit and integration coverage.

### Frontend

- `web/src/services/apiClient.js`: backend fetch wrapper.
- `web/src/services/authService.js`: backend-driven auth methods.
- `web/src/context/AuthContext.js`: session hydration and mutations.
- `web/src/app/actions/auth-actions.js`: server-side auth bridge where needed.
- `web/src/lib/session.js` and `web/src/lib/proxy-core.js`: route guards backed by server-issued session cookies.
- Auth components under `web/src/components/features/auth/*`: remove client-side OTP hard-code.

### Documentation

- `docs/09-BACKEND-PLATFORM-DESIGN.md`: architecture design.
- `docs/adrs/*.md`: major decisions.
- Targeted updates to `01`, `02`, `03`, `05`, setup guide, and future-work docs.

## Task Slices

### Task 1: Dependency and Prisma Foundation

1. Install backend dependencies: Prisma client/CLI, bcryptjs, cookie-parser, swagger tooling, and ensure Supertest is installed.
2. Remove Mongoose.
3. Add Prisma schema and migration SQL for all launch tables and auth-session tables.
4. Apply migrations to the development database.
5. Verify public tables, constraints, indexes, enums, and `_prisma_migrations`.

### Task 2: Auth Utility Tests and Implementation

1. Write failing tests for phone normalization, OTP hashing/verification, token issuance, refresh-token hashing, and session rotation.
2. Implement utilities with dependency injection for clock, random bytes, and OTP provider.
3. Verify unit tests pass.

### Task 3: Customer Auth APIs

1. Write failing integration tests for OTP send, OTP verify, refresh, logout current device, logout all devices, and invalid/reused refresh token behavior.
2. Implement auth repository, service, controller, validators, and routes.
3. Verify integration tests pass against an isolated test setup.

### Task 4: Onboarding and Current User APIs

1. Write failing integration tests for `GET /users/me` and `POST /auth/onboarding`.
2. Implement user repository, onboarding service, validators, and routes.
3. Verify onboarding incomplete and complete behavior.

### Task 5: Staff Auth Foundation

1. Write failing tests for staff login, account lockout, suspended account rejection, and force-password-change response.
2. Implement staff credential verification and JWT/session issuance.
3. Keep admin provisioning endpoints documented if not fully exposed in the first implementation slice.

### Task 6: OpenAPI and Postman Automation

1. Add OpenAPI route registry for implemented endpoints.
2. Serve `/api/v1/docs/openapi.json` and Swagger UI in non-production.
3. Generate Postman collection and environment from OpenAPI.
4. Add tests that assert the spec includes auth and onboarding endpoints.

### Task 7: Frontend Auth Integration

1. Replace client-side OTP hard-code with backend `sendOtp` and `verifyOtp`.
2. Replace localStorage user registry with backend `GET /users/me`.
3. Wire onboarding to `POST /auth/onboarding`.
4. Keep route redirects aligned with `next_step`.
5. Verify web tests and a manual auth happy path.

### Task 8: Documentation and Final Validation

1. Update token lifecycle docs to reflect refresh-token sessions.
2. Update database schema docs for auth sessions and refresh tokens.
3. Add future-work report.
4. Run backend tests, frontend tests, Prisma validation, migration status, and metadata inspection.
