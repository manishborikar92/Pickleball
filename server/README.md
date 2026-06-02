# Pickleball Platform Backend

Node.js + Express API for the Pickleball booking platform.

## Design Choices

- Feature routes mount through one router factory, so modules can be added without changing `app.js`.
- Request lifecycle is standardized: request id, Helmet, CORS, request logging, body parsers, rate limiting, routes, 404, global error handler.
- Validation uses Joi and stores sanitized data in `req.validated` without mutating `req.body`, matching the cleaner pattern.
- Auth uses short-lived JWT access tokens plus opaque rotating refresh tokens stored in HTTP-only cookies.
- API responses use one envelope: `{ success, message, data, meta? }`.
- PostgreSQL is the application database. Prisma owns schema generation and migration history.

## Structure

```text
server/
  src/
    app.js                    # Express app factory
    server.js                 # Process startup and graceful shutdown
    config/                   # Env, CORS, Helmet, database
    lib/prisma.js             # Prisma client lifecycle
    middleware/               # Request, validation, auth, error handling
    modules/auth/             # OTP, token, refresh-session, logout APIs
    modules/health/           # Health, liveness, readiness endpoints
    modules/openapi/          # OpenAPI and Postman generation support
    modules/users/            # Current-user and onboarding APIs
    routes/                   # Router composition
    utils/                    # Logger, responses, errors, serialization
    validators/               # Reusable Joi schemas
  prisma/
    schema.prisma             # Prisma model source
    migrations/               # SQL migration source of truth
  postman/                    # Generated collection and environment
  tests/
```

## Commands

```bash
npm install
npm test
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run postman:generate
npm run dev
npm start
```

## Endpoints

- `GET /`
- `GET /api/v1/health`
- `GET /api/v1/live`
- `GET /api/v1/ready`
- `POST /api/v1/auth/otp/send`
- `POST /api/v1/auth/otp/verify`
- `POST /api/v1/auth/staff/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `POST /api/v1/auth/onboarding`
- `GET /api/v1/users/me`
- `GET /api/v1/docs/openapi.json`
- `GET /api/v1/docs`

## Adding A Feature Module

Create a folder such as `src/modules/users/` with route, controller, service, repository, serializer, and validator files. Then mount it through `configureRoutes` or `src/routes/index.js`.

```js
import createApp from './src/app.js';
import usersRoutes from './src/modules/users/users.routes.js';

const app = createApp({
  configureRoutes(router) {
    router.use('/users', usersRoutes);
  },
});
```

## Provider Modules

Provider integrations remain separated from auth business logic:

- OTP providers are selected through `OTP_MODE`.
- `sandbox` returns deterministic OTP `123456`.
- `test` uses `OTP_TEST_CODE`.
- `production` is reserved for the WhatsApp Cloud API provider.

Production PhonePe, WhatsApp, email, storage, and scheduler implementations are added as provider modules without changing core domain services.

## Seed Data

`npm run prisma:seed` is idempotent. It creates launch roles, permissions, role-permission mappings, the Besa venue, two courts, base prices, and standard schedules. To seed the first super-admin account, set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`; `SEED_ADMIN_NAME` and `SEED_ADMIN_PHONE` are optional.
