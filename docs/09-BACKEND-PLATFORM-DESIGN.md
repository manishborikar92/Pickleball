# Backend Platform Design

## Status

Approved for implementation for the greenfield pre-launch build.

## Source of Truth

The product documentation is the primary source of truth. The existing frontend is a secondary reference for screens and user journeys, but its mock data, demo cookies, and client-side OTP behavior are not production contracts.

The PostgreSQL development database was inspected on 2026-06-02. Supabase-managed schemas exist (`auth`, `storage`, `realtime`, `vault`), but the application-owned `public` schema is empty: no product tables, constraints, indexes, enums, or Prisma migration history. The platform is therefore treated as greenfield.

## Final Architecture

The backend is a modular Express API with PostgreSQL as the only application database and Prisma as the ORM/migration source of truth. Feature modules own their routes, validation schemas, controllers, services, repositories, tests, and OpenAPI metadata. Shared infrastructure lives under `src/config`, `src/middleware`, `src/lib`, and `src/utils`.

The API remains versioned under `/api/v1`. Implemented public routes include root metadata, health/liveness/readiness, authentication entry points, OpenAPI JSON, and Swagger UI. Protected routes use access-token authentication and validate active PostgreSQL sessions when the database is enabled. Sensitive session lifecycle operations use refresh tokens stored in secure HTTP-only cookies.

## Backend Technology Decisions

| Concern | Decision | Rationale |
|---|---|---|
| Framework | Express 5 | Existing scaffold, mature ecosystem, low operational complexity |
| ORM | Prisma | Migration source of truth, strong schema visibility, generated typed client |
| Database | PostgreSQL | Required by product docs; ACID and row-level locking for booking correctness |
| Validation | Joi | Already present; mature request validation and easy OpenAPI conversion |
| Auth | JWT access tokens plus opaque refresh tokens | Stateless API authorization with server-side revocation and rotation |
| Password hashing | bcryptjs | Portable bcrypt implementation for staff credential flows |
| Logging | Existing structured logger, upgraded to Pino later if needed | Preserve current utility until observability scope broadens |
| API docs | OpenAPI JSON generated from route registry and Joi schemas | Single source for Swagger UI and Postman generation |
| Postman | Script generated from OpenAPI | Avoid manual endpoint drift |
| Testing | Node test runner plus Supertest | Already selected; sufficient for unit and API integration coverage |
| Rate limiting | express-rate-limit | Existing dependency; per-route limiters for OTP and staff auth |

## Database Design

The schema is normalized around these domains:

| Domain | Tables |
|---|---|
| Venue and courts | `venues`, `courts` |
| Identity and RBAC | `users`, `roles`, `permissions`, `role_permissions`, `venue_user_roles`, `staff_credentials` |
| Auth sessions | `otp_requests`, `auth_sessions`, `refresh_tokens` |
| Scheduling and pricing | `schedules`, `schedule_exceptions`, `pricing_rules`, `base_prices`, `coupons`, `coupon_usages` |
| Booking and payment | `bookings`, `booking_slots`, `payments`, `wallet_transactions` |
| Engagement | `reviews`, `reward_mechanisms`, `reward_instances` |

All product tables live in the `public` schema and use UUID primary keys. Monetary values use `Decimal`. Core operational tables include `created_at` and `updated_at`. Critical historical records are not hard-deleted. User-facing entities include `deleted_at` only where soft deletion has operational value (`venues`, `courts`, `users`, `staff_credentials`, `coupons`, `reward_mechanisms`).

Double booking is prevented by a partial unique index on `booking_slots(court_id, slot_date, slot_start_time)` for active statuses. Prisma does not model partial indexes directly, so the migration SQL owns that index.

## Authentication Design

Customer authentication is phone-first:

1. `POST /auth/otp/send` normalizes an Indian mobile number, rate-limits by phone/IP, creates a hashed OTP request, and sends through the configured OTP provider.
2. `POST /auth/otp/verify` validates the OTP, upserts the user, marks the phone verified, creates an auth session, issues an access token, rotates in an initial refresh token, and returns `next_step`.
3. `POST /auth/refresh` validates the current refresh token cookie, atomically revokes the used token, creates the next refresh token, updates the session heartbeat, and returns a new access token. A partial unique index allows only one active refresh token per session.
4. `POST /auth/logout` revokes the current session and refresh token.
5. `POST /auth/logout-all` revokes all sessions for the authenticated user.

Refresh tokens are opaque random values. Only HMAC-SHA256 hashes are stored. Reuse of a revoked refresh token revokes the full session as a security response.

OTP providers are selected by environment:

| Mode | Behavior |
|---|---|
| `sandbox` | OTP is always `123456`; response may expose the OTP for local development |
| `test` | OTP uses `OTP_TEST_CODE` from the environment |
| `production` | Provider interface calls the WhatsApp Cloud API implementation |

Staff authentication uses email and password through `staff_credentials`. Staff login is implemented; staff provisioning, activation, reset-password, and forced-password-change routes remain future modules backed by the same schema.

## Onboarding Design

Onboarding completion is still derived from `users.name IS NOT NULL`. `onboarding_completed_at` is analytics metadata and is set the first time a name is submitted. `POST /auth/onboarding` requires authentication but not completed onboarding, allowing interrupted OTP-verified users to resume without a second OTP while their session remains valid.

Protected booking, wallet, rewards, and customer history routes require both authentication and onboarding completion. Admin users are provisioned with names, so onboarding checks pass for staff.

## API Contract Strategy

The existing backend response envelope is retained:

```json
{ "success": true, "message": "Success", "data": {} }
```

Auth endpoints place tokens and next-step data inside `data`. Refresh tokens are delivered only as HTTP-only cookies. Access tokens are returned in JSON for the frontend API client and may also be mirrored into an HTTP-only cookie if server-side route guards need it.

OpenAPI is generated from a route registry that binds method, path, validation schema, auth requirements, and response examples. Swagger UI serves the generated spec in non-production environments. The Postman collection and environment are generated from the same OpenAPI document.

## Frontend Integration Strategy

The frontend no longer treats localStorage as the source of auth truth. Auth forms call backend APIs, `AuthContext` hydrates from `GET /users/me`, and route guards read server-controlled cookies or server action session resolution. Fabricated booking, wallet, admin activity, review, and hard-coded coupon data has been removed; backend-dependent screens return empty operational state until corresponding APIs are implemented.

## Security Baseline

- Access tokens are short-lived and signed with a dedicated secret.
- Refresh tokens are opaque, rotated, hashed at rest, and stored in secure HTTP-only cookies.
- OTPs are hashed at rest and expire.
- Rate limits apply globally and more strictly to OTP and staff auth endpoints.
- Helmet, CORS allowlists, request IDs, and centralized error handling remain mandatory.
- Production startup fails when required secrets or provider credentials are missing.
- Passwords and tokens are never logged.

## Implementation Order

1. Prisma/PostgreSQL foundation and migrations.
2. Auth-session schema and token utilities.
3. OTP provider abstraction and customer auth APIs.
4. Onboarding and current-user APIs.
5. Staff auth foundation.
6. OpenAPI and Postman generation.
7. Frontend auth integration.
8. Documentation and final validation.
