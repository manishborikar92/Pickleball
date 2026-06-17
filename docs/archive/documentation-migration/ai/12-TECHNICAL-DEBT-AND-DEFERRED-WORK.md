# AI Project Context — Technical Debt & Deferred Work

This document logs architectural shortcuts, stubs, and work deferred beyond the initial MVP launch.

---

## 1. Technical Debt

### 1.1 In-Memory Rate Limiting
* **Debt Item**: Backend utilizes `express-rate-limit` stored in Node memory.
* **Risk**: If the API scales to multiple instances/containers, rate limit state is not shared, allowing bypasses.
* **Mitigation**: Transition to a shared Redis-backed rate limiter store once traffic volume scales.

### 1.2 In-Memory Session Revocation
* **Debt Item**: While refresh tokens are stored in the database, access token verification is completely stateless.
* **Risk**: Expired or compromised JWT access tokens cannot be revoked instantly until their 15-minute TTL expires.
* **Mitigation**: Introduce a short-term Redis blacklist for revoked access tokens.

---

## 2. Deferred Work (Post-Launch Backlog)

### 2.1 Real-Time Slot Status Synchronization
* **Scope**: Court booking grids do not sync in real-time. If two users select the same slot, the conflict is caught only at checkout hold time.
* **Mitigation**: Implement Server-Sent Events (SSE) or Socket.io connection to sync slot booking statuses live.

### 2.2 Inbound WhatsApp Support Webhook
* **Scope**: Inbound support tickets are deferred. Landing page displays a static support phone number.
* **Mitigation**: Integrate Meta's WhatsApp incoming webhook to feed a shared admin support inbox.

### 2.3 Automated Settlements Reconciliation
* **Scope**: Financial reconciliation of payments is manual via the PhonePe admin dashboard.
* **Mitigation**: Code background worker scripts to fetch PhonePe transaction settlement reports and compare them against PostgreSQL bookings.
