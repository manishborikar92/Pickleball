# AI Project Context — Current Implementation Status

This document serves as the authoritative, code-verified audit of completed, partially built, planned, and blocked modules.

---

## 1. Feature Implementation Matrix

| Module / Feature | Code Status | Verified By | Notes |
|:---|:---|:---|:---|
| **Health Checks** | **Implemented** | [app.test.js](../../server/tests/integration/app.test.js) | Exposes `GET /health` with DB connection check. |
| **Middlewares** | **Implemented** | [app.test.js](../../server/tests/integration/app.test.js) | Helmet, Cors, cookieParser, rateLimiters are active. |
| **OpenAPI Docs** | **Implemented** | [openapi.test.js](../../server/tests/integration/openapi.test.js) | Swagger UI is generated at `/docs`. |
| **Staff Auth** | **Implemented** | [auth-routes.test.js](../../server/tests/integration/auth-routes.test.js) | Email + password login, JWT issuance, and session revocation. |
| **Customer Auth (OTP)**| **Partially Implemented**| [auth-routes.test.js](../../server/tests/integration/auth-routes.test.js) | Auth endpoints stubs exist but rely on mock sandbox (always verification of `123456`). |
| **User Onboarding** | **Partially Implemented**| [user-onboarding-routes.test.js](../../server/tests/integration/user-onboarding-routes.test.js) | `/auth/onboarding` name submission is implemented, but requires integration with the database. |
| **Prisma Schema** | **Partially Implemented**| [schema.prisma](../../server/prisma/schema.prisma) | DB schema tables exist but are not yet wired to active booking endpoints. |
| **Booking Engine** | **Planned** | None | Real booking engine (slot locks, sweeper task, holds) is not implemented in `/server/src/modules/`. |
| **Pricing Engine** | **Planned** | None | Pricing logic (time modifiers, coupons, credit deductions) not implemented. |
| **PhonePe PG** | **Blocked** | None | Webhooks and checkout API blocked pending Merchant keys. |
| **WhatsApp OTP** | **Blocked** | None | Blocked pending Meta Cloud active template registration. |
| **Wallets & Credits** | **Planned** | None | Wallet credit deductions and transactions are planned. |
| **Staff Activation** | **Planned** | None | Admin provision routes (`/admin/staff`) are planned. |
| **WebSockets Sync** | **Deferred** | None | Slot real-time sync is deferred post-launch. |
| **Reward Engine** | **Deferred** | None | Reward scratch cards/spinners are deferred post-launch. |
| **Review Photo Upload**| **Deferred** | None | Photo attachment on review is deferred post-launch. |

---

## 2. Status Category Definitions

1.  **Implemented**: Fully coded in both frontend and backend modules; validated by the test suite.
2.  **Partially Implemented**: Router stubs exist or basic DB schema is declared, but logic, verification, or integration is incomplete.
3.  **Blocked**: Features waiting on external credentials, payments gateways approval, or WhatsApp sandbox verification.
4.  **Planned**: MVP-scope features (e.g. Booking Engine, dynamic pricing waterfall) that have not been written in code.
5.  **Deferred**: Features intentionally excluded from the initial MVP release (e.g. WebSockets, Redis limits, Rewards spinner).
6.  **Removed**: Features previously built or planned that have been completely deleted from repository scope.
