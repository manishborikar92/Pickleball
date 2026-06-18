# Express API Backend Server

The Express.js REST API server is the core business logic engine, database coordinator, and integration orchestrator for the Pickleball booking platform.

---

## 1. Responsibilities

- **Authentication & Sessions**: Manages customer OTP delivery (WhatsApp) and verification, and staff credential logins. Handles JSON Web Token (JWT) session creation, verification, and rotation.
- **Database Coordination**: Abstracts PostgreSQL queries using Prisma ORM. Encapsulates connection pools and atomic database-level unique constraint checks (partial unique index).
- **Validation**: Guards all endpoints via Joi schema validations, rejecting dirty payloads before processing.
- **Integrations**: Connects to WhatsApp Business API and PhonePe gateway, and handles webhook security validation.

---

## 2. Codebase Structure

All server code resides in `server/src/`:
- `config/`: System config loaders and validation guards.
- `core/`: Application lifecycle hooks and server initializers.
- `lib/`: Shared clients (e.g. Prisma client instance in `prisma.js`).
- `middleware/`: Error loggers, request limits, and authorization checks.
- `modules/`: Domain-driven component folders. Each folder contains its own route mappings, validators, controllers, and services.

---

## 3. Local Development Quick Start

### 3.1 Initial Setup
1. Open a shell and enter the server directory:
   ```bash
   cd server/
   npm install
   ```
2. Create environment file:
   ```bash
   cp .env.example .env
   ```
   *Configure the `DATABASE_URL` with your local PostgreSQL credentials.*

### 3.2 Initialize Database
1. Run Prisma migrations:
   ```bash
   npx prisma migrate dev
   ```
   *Note: Do NOT use `npx prisma db push` as it will drop custom PostgreSQL partial indexes (such as the double-booking concurrency index).*
2. Seed the database with base venues, courts, roles, and pricing variables:
   ```bash
   npm run prisma:seed
   ```
3. Generate the Prisma client build:
   ```bash
   npm run prisma:generate
   ```

### 3.3 Running Development Server
Start the Express server on port `5000`:
```bash
npm run dev
```

---

## 4. Testing Instructions

The server test suite utilizes the native Node.js test runner (`node --test`), keeping testing free of heavy third-party framework dependencies.

### 4.1 Run Tests
To run all unit and integration tests:
```bash
npm run test
```

### 4.2 Coverage
To run tests with code coverage metrics:
```bash
npm run test:coverage
```

---

## 5. Deeper Documentation References

- **Database Schemas & Relations**: [docs/specs/01-DATABASE-SCHEMA.md](../docs/specs/01-DATABASE-SCHEMA.md)
- **API Router Route Definitions**: [docs/specs/02-API-SPECIFICATION.md](../docs/specs/02-API-SPECIFICATION.md)
- **Implementation Status checklists**: [docs/ai/03-IMPLEMENTATION-STATUS.md](../docs/ai/03-IMPLEMENTATION-STATUS.md)
- **VM Setup & Deployment Runbook**: [docs/operations/02-SETUP-GUIDE.md](../docs/operations/02-SETUP-GUIDE.md)
