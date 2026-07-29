# Future Work

## Completed in This Platform Slice

- PostgreSQL/Prisma architecture decision and migrations (`schema.prisma`, `20260727104633_notifications`).
- Complete application domain modules: `auth`, `venues`, `bookings`, `payments`, `users` (wallet), `reviews`, `rewards`, `notifications`.
- Customer OTP authentication with environment-selected OTP providers.
- Access tokens, refresh tokens, refresh-token rotation, current-device logout, all-device logout, and session revocation.
- Admin login foundation using `admin_credentials`, bcrypt password verification, status checks, lockout tracking, and the shared session/token lifecycle.
- Customer onboarding through `POST /auth/onboarding`.
- Current-user profile through `GET /users/me`.
- Booking availability, hold lock concurrency, waiver, PhonePe payment, wallet credits, reviews, and reward engine APIs.
- In-process scheduler (`core/scheduler.js`) driving slot hold cleanup, payment reconciliation, reward expiry, and PostgreSQL outbox notification dispatch (T-24h/T-2h reminders, post-session review requests — ADR-011).
- Admin settings UI (`/admin/settings`) with accessible notification toggles and recent activity log.
- OpenAPI JSON and Swagger UI (`openapi.spec.js`).
- Generated Postman collection (`notifications.postman_collection.json`).
- Idempotent Prisma seed script for launch permissions, roles, venue, courts, base prices, standard schedules, and notification settings.
- Cookie-based frontend auth integration for customer login, onboarding, and route-guard session hydration.
- Unit, integration, OpenAPI, Postman-generator, frontend lint, frontend unit, and frontend build validation.

## Pending External Setup

- WhatsApp Business API production credentials, approved utility templates (`reminder_t24`, `reminder_t2h`, `review_request`), phone-number ID, and setting `NOTIFICATIONS_TRANSPORT_MODE=live` (~30 days out).
- Production OTP delivery monitoring and alerting.
- Production email provider for admin activation and password-reset flows.
- PhonePe production credentials and live merchant endpoint deployment.
- Cloudflare R2 credentials and storage provider implementation for court/review images.
- Production deployment environment, secrets, domains, HTTPS, and backup/restore procedures.

## Required Future Codebase Updates

- Admin provisioning endpoint and UI (`super_admin` invite flow).
- Admin activation endpoint backed by email delivery.
- Admin reset-password request/confirm endpoints backed by email delivery.
- Admin change-password endpoint and forced-password-change guard.
- Admin coupon management CRUD API and frontend panel (`/admin/pricing`).
- Admin dynamic pricing rules CRUD API and frontend panel.
- Production observability upgrades: structured log sink, uptime checks, error monitoring, audit events, and security alerts.
- CI/CD workflow that runs Prisma validation, migrations in deploy mode, backend tests, frontend lint/tests/build, Postman generation, and OpenAPI artifact publishing.

## Known Residual Risks

- The development database contains the new schema and launch seed data. The first admin account is only created when seed admin environment variables are supplied.
- Customer auth and admin login are implemented; the remaining admin lifecycle depends on the email/provider slice.
- `npm audit` reports moderate vulnerabilities in the current dependency tree; they should be reviewed before production hardening.
