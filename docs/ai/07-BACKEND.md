# AI Project Context — Backend Structure & Middleware Pipelines

This document outlines the folder boundaries, module layouts, and middleware pipeline of the backend Express.js server.

---

## 1. Directory Structure Map (`/server/src`)

The Express backend code resides inside `/server/src/`:

```
/server/src/
├── config/                          # Server environment configurations, CORS, and security setup
├── core/                            # Lifecycle management and shutdown routines
├── generated/                       # Auto-generated Prisma client classes
├── lib/                             # Shared library clients (e.g. Prisma Client)
├── middleware/                      # Global API middleware pipelines
├── modules/                         # Core domain module components (Routes, Controllers, Services)
│   ├── auth/                        # OTP handling, JWT authentication, and staff credentials
│   ├── health/                      # Server readiness & health check endpoint
│   ├── openapi/                     # Auto-generated Swagger documentation configuration
│   └── users/                       # Onboarding name collections and user profiles
├── routes/                          # Global routing setup & endpoint aggregation
├── utils/                           # Shared utility helpers (e.g., API responses)
├── validators/                      # Shared validator schemas (Joi)
├── app.js                           # Express application factory creation
└── server.js                        # Main HTTP server execution listener
```

---

## 2. Express Middleware Pipeline Flow

Every request entering the Express server passes through a sequential chain of middlewares before reaching a route handler. The pipeline is initialized in the backend codebase file [app.js](../../server/src/app.js):

```
       [ Request Received ]
                │
                ▼
1.  [ requestId ]                   (Attaches unique request ID header)
                │
                ▼
2.  [ helmet ]                      (Sets security headers)
                │
                ▼
3.  [ cors ]                        (Validates allowed domain origins)
                │
                ▼
4.  [ requestLogger ]               (Logs method, duration, and status code)
                │
                ▼
5.  [ cookieParser ]                (Parses cookies into req.cookies)
                │
                ▼
6.  [ jsonBodyLimit ]               (Limits JSON payload size; verifies rawBody)
                │
                ▼
7.  [ urlencodedBodyLimit ]         (Limits url-encoded payload size)
                │
                ▼
8.  [ createRateLimiter ]           (Enforces API rate limits per IP)
                │
                ▼
9.  [ Router Matcher ]              (Routes request to module routers)
                │
         ┌──────┴──────┐
         ▼             ▼
  [ Match Found ]    [ No Match ]
         │             │
         │             └─► 10. [ notFound ]  (Throws 404 error)
         ▼                         │
   [ Route Handler ]               │
   (Auth Check / Logic)            │
         │                         │
         └─────────────┬───────────┘
                       ▼
                 [ Error Thrown ]
                       │
                       ▼
                 11. [ errorHandler ] (Logs exception; returns standardized response)
```

---

## 3. Module Specifications & Responsibilities

The backend splits domains into autonomous folders inside `/server/src/modules/`:

1.  **`health`**:
    *   Exposes `GET /health` to run database ping verification and server diagnostics.
2.  **`openapi`**:
    *   Generates swagger specifications using `joi-to-swagger` schemas.
    *   Exposes `GET /docs` for Swagger UI.
3.  **`auth`**:
    *   Authenticates customers (WhatsApp OTP verification, sessions, and token rotation).
    *   Authenticates staff (Email/Password verified via bcrypt hashes).
    *   Enforces route protection via `authenticate()` and `requirePermission('key')`.
4.  **`users`**:
    *   Completes user onboarding (name collection).
    *   Serves current user profile data details.
