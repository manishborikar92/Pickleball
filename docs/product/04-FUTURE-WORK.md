# Future Work

## Completed in This Platform Slice

- PostgreSQL/Prisma architecture decision and migrations.
- Application schema for venue, court, identity, RBAC, OTP, sessions, refresh tokens, scheduling, pricing, bookings, payments, wallet, reviews, and rewards.
- Customer OTP authentication with environment-selected OTP providers.
- Access tokens, refresh tokens, refresh-token rotation, current-device logout, all-device logout, and session revocation.
- Admin login foundation using `admin_credentials`, bcrypt password verification, status checks, lockout tracking, and the shared session/token lifecycle.
- Customer onboarding through `POST /auth/onboarding`.
- Current-user profile through `GET /users/me`.
- OpenAPI JSON and Swagger UI.
- Generated Postman collection and local environment.
- Idempotent Prisma seed script for launch permissions, roles, venue, courts, base prices, and standard schedules.
- Frontend auth integration away from demo OTP/localStorage assumptions for customer login, onboarding, and route-guard session hydration.
- Frontend removal of fabricated booking, wallet, admin activity, review, and hard-coded coupon fixture data where backend APIs are not yet implemented.
- Unit, integration, OpenAPI, Postman-generator, frontend lint, frontend unit, and frontend build validation.

## Pending External Setup

- WhatsApp Business API production credentials, approved authentication template, phone-number ID, and production provider activation.
- Production OTP delivery monitoring and alerting.
- Production email provider for admin activation and password-reset flows.
- PhonePe production credentials and webhook endpoint deployment.
- Cloudflare R2 credentials and storage provider implementation for court/review images.
- Production deployment environment, secrets, domains, HTTPS, and backup/restore procedures.
- Background job runner for pending-payment expiry sweeps and deferred WhatsApp notifications.

## Required Future Codebase Updates

- Admin provisioning endpoint and UI.
- Admin activation endpoint backed by email delivery.
- Admin reset-password request/confirm endpoints backed by email delivery.
- Admin change-password endpoint and forced-password-change guard.
- Booking availability, hold, waiver, payment, wallet, review, and admin API modules on top of the completed schema.
- Admin provisioning endpoint and UI; the seed script can create the first admin only when `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are provided.
- Production WhatsApp OTP provider implementation behind the existing provider interface.
- Production observability upgrades: structured log sink, uptime checks, error monitoring, audit events, and security alerts.
- CI/CD workflow that runs Prisma validation, migrations in deploy mode, backend tests, frontend lint/tests/build, Postman generation, and OpenAPI artifact publishing.

## Known Residual Risks

- The development database contains the new schema and launch seed data. The first admin account is only created when seed admin environment variables are supplied.
- Customer auth and admin login are implemented; the remaining admin lifecycle depends on the email/provider slice.
- Booking and payment APIs are not yet implemented even though their tables and product contracts are defined.
- `npm audit` reports moderate vulnerabilities in the current dependency tree; they should be reviewed before production hardening.
