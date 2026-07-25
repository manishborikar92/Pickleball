# Payment Redirect Completion Implementation Plan

> **For agentic workers:** Execute the remaining work test-first and validate every route, provider, and documentation contract before handoff.

**Goal:** Complete the staged frontend payment-redirect flow and make every PhonePe payment retry use a traceable, globally collision-resistant merchant order ID.

**Architecture:** PhonePe and the sandbox return the browser to the Next.js `/booking/redirect` interstitial. Its Server Action calls the public Express verification endpoint server-to-server; terminal payment events use the existing idempotent booking-service pipeline. Each PhonePe attempt receives a new 64-bit cryptographic suffix, while the payment ledger remains the authoritative mapping from exact merchant order ID to booking.

**Tech Stack:** Next.js 16 / React 19, Express 5, Prisma/PostgreSQL, Node.js native test runner, Joi, PhonePe PG v2.

---

### Task 1: Reconstruct and audit the staged implementation

**Files:**
- Review: `docs/prompts/PROMPT-004.md`
- Review: staged payment, web, API, Postman, and test files
- Review: `server/src/modules/bookings/bookings.service.js`, `bookings.repository.js`, `payments/*`, `server/prisma/schema.prisma`
- Review: `web/src/lib/actions/booking.js`, `web/src/lib/services/paymentRedirect.js`, and booking-route components

- [x] **Step 1: Map the redirect workflow and payment lifecycle.**

  Verify that the PhonePe and sandbox redirect URLs target `/booking/redirect`, the frontend calls `/payments/verify` through a Server Action, terminal states use `handleProviderPaymentEvent`, and `Payment.merchantOrderId` is the unique ledger lookup used by verification, webhooks, polling, and reconciliation.

- [x] **Step 2: Identify remaining requirements and deviations.**

  The redirect redesign and retry-ID hardening are complete. Verify that a new 64-bit cryptographic suffix is generated per PhonePe attempt, that each ID is PhonePe-safe and within 35 characters, and that the implementation context documents the final frontend interstitial and JSON verification flow.

### Task 2: Make PhonePe retry IDs collision-resistant

**Files:**
- Modify: `server/tests/unit/payment-provider.test.js`
- Modify: `server/src/modules/payments/phonepe-payment.provider.js`

- [x] **Step 1: Write the failing regression test.**

  Assert that a 14-character booking prefix and a 16-hex-character (64-bit) suffix produce IDs such as `PP-44444444444444-0123456789abcdef`: the IDs differ across attempts, preserve the booking prefix, use only PhonePe-safe characters, and are at most 35 characters.

- [x] **Step 2: Run the focused test and confirm the current 32-bit implementation fails the 35-character budget when supplied with a 64-bit suffix.**

  Run: `npm run test:unit -- tests/unit/payment-provider.test.js`

- [x] **Step 3: Implement the minimal generator correction.**

  Use `crypto.randomBytes(8).toString('hex')` (64 bits) and shorten the booking-derived prefix to 14 characters, yielding a fixed 34-character format: `PP-<booking-prefix>-<entropy>`. Keep ID generation provider-local; no schema migration is needed because the exact generated ID is already stored in the unique payment ledger before verification, webhook, polling, and reconciliation use it.

- [x] **Step 4: Re-run the focused test and verify it passes.**

### Task 3: Synchronize production documentation

**Files:**
- Modify: `docs/integrations/02-PAYMENT-INTEGRATION.md`
- Modify: `docs/audits/01-END-USER-GAP-ANALYSIS.md`
- Modify: `docs/specs/01-DATABASE-SCHEMA.md`
- Modify: `docs/ai/01-IMPLEMENTATION-OVERVIEW.md`
- Modify: `docs/ai/02-CODEBASE-MAP.md`
- Modify: `docs/ai/03-IMPLEMENTATION-STATUS.md`
- Modify: `web/.env.example`
- Modify only if required after route/reference audit: `llms.txt`, Postman/OpenAPI artifacts

- [x] **Step 1: Replace the stale deterministic order-ID examples with the 34-character per-attempt format and document why the ledger’s unique `merchant_order_id` is the authoritative correlation key.**

- [x] **Step 2: Mark the retry defect resolved in the audit and update the AI context to replace the removed browser redirect handler with the frontend redirect landing plus public JSON verification endpoint.**

- [x] **Step 3: Remove stale frontend-environment wording that claims API URLs are used for browser payment redirects.**

### Task 4: Validate the production contract

**Files:**
- Verify: all staged files and their tests

- [x] **Step 1: Run focused server unit and integration suites for payment provider, verification, routes, webhooks, reconciliation, and booking lifecycle.**

- [x] **Step 2: Run the complete backend suite, frontend unit suite, lint, and production build.**

- [x] **Step 3: Run `git diff --cached --check`, inspect the staged diff, and search for stale legacy redirect-endpoint or deterministic PhonePe order-ID references.**

- [x] **Step 4: Review requirements against the implemented data flow and report only freshly verified results.**
