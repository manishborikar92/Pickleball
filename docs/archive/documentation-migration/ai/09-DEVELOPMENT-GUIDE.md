# AI Project Context — Development Guide

This guide details the technical environment configurations, local environment variables, running procedures, and testing commands for the Pickleball Booking Platform.

---

## 1. Environment Configurations

### 1.1 Backend Environment Variables (`/server/.env`)
Create a `.env` file in the `/server` directory using `/server/.env.example` as a template:

| Variable | Default (Dev) | Description |
|:---|:---|:---|
| `NODE_ENV` | `development` | Environment name (development, test, production). |
| `PORT` | `5000` | Port the Express API server listens on. |
| `HOST` | `0.0.0.0` | Bind host address. |
| `APP_NAME` | `"Pickleball Platform API"` | Application identity name. |
| `API_PREFIX` | `/api/v1` | Root router prefix. |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins. |
| `JWT_ACCESS_SECRET`| *Random string* | Signing key for short-lived JWT access tokens. |
| `JWT_ACCESS_TTL_SECONDS`| `900` (15 minutes) | Expiration window of the access token. |
| `REFRESH_TOKEN_TTL_SECONDS`| `2592000` (30 days) | Expiration window of the refresh session. |
| `DATABASE_URL` | `postgresql://...` | Connection URI to the PostgreSQL Database. |
| `OTP_MODE` | `sandbox` | OTP delivery mode (`sandbox`, `test`, or `production`). |
| `OTP_TEST_CODE` | `123456` | Static code used when `OTP_MODE=test`. |
| `REFRESH_COOKIE_NAME`| `pb_refresh_token` | HTTP-only cookie name storing the opaque refresh token. |
| `WHATSAPP_API_BASE_URL`| `https://graph.facebook.com`| Meta graph endpoint. Required when OTP_MODE=production. |

### 1.2 Frontend Environment Variables (`/web/.env.local`)
Create a `.env.local` file in `/web` directory:

| Variable | Default (Dev) | Description |
|:---|:---|:---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:5000/api/v1` | URL of the backend Express server. |

---

## 2. Dev Launch Commands

### 2.1 Backend Dev Launch
Run these commands from the `/server` directory:
```bash
# Install NPM dependencies
npm install

# Generate Prisma Client classes
npm run prisma:generate

# Apply database migrations dev-cycle
npm run prisma:migrate

# Seed the database (Default roles and permissions)
npm run prisma:seed

# Launch backend in nodemon watch mode
npm run dev
```

### 2.2 Frontend Dev Launch
Run these commands from the `/web` directory:
```bash
# Install dependencies
npm install

# Launch Next.js local server
npm run dev
```
By default, the web dashboard runs at `http://localhost:3000`.

---

## 3. Database Management (Prisma)

Always execute Prisma operations from the `/server` directory:
* **Apply Migrations**: `npm run prisma:migrate`
* **Deploy Migrations (Production)**: `npm run prisma:deploy`
* **Generate Client**: `npm run prisma:generate`
* **Seed database**: `npm run prisma:seed`
* **Launch Prisma Studio (DB Browser)**: `npx prisma studio` (launches dashboard at `http://localhost:5555`).

---

## 4. Testing Execution

Tests are implemented using Node's native test runner (introduced in Node v18+ / v20+).
Run tests from the `/server` directory:
* **Run All Tests**: `npm run test`
* **Run Unit Tests only**: `npm run test:unit`
* **Run Integration Tests only**: `npm run test:integration`

The test environment uses configuration settings from `server/.env.test`. Ensure this file exists containing:
```env
NODE_ENV=test
PORT=5001
```
The testing suite does not require a live WhatsApp or PhonePe connection. It uses sandbox mocks.
