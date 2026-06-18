# ADR-004: Booking Consistency, Payment Abstraction, and Compliance Logging

## Status
Approved

## Context
The Pickleball court booking platform requires:
1. **Concurrency Safety**: Preventing two players from booking the same court at the same time.
2. **Payment Integration Flexibility**: Developing and testing the system locally without live payment gateway accounts (PhonePe) while making it simple to switch later.
3. **Compliance Logging**: Keeping durable audit records of user waiver acceptances.

## Decision

### 1. Concurrency Strategy (Declarative Partial Index)
Instead of implementing active database advisory locking or stateful row locks (`SELECT ... FOR UPDATE`) in application code—which increases locking overhead and risks holding connection pools open during network requests—we rely on a **PostgreSQL partial unique index**:
```sql
CREATE UNIQUE INDEX "booking_slots_no_double_book"
ON "booking_slots" ("court_id", "slot_date", "slot_start_time")
WHERE "status" IN ('pending_payment', 'confirmed', 'walk_in', 'admin_block');
```
This constraint is evaluated atomically in database transactions at hold time. Conflicting concurrent inserts throw a `P2002` unique constraint violation, which the service layer catches and maps into structured `SLOTS_UNAVAILABLE` errors.

### 2. Payment Gateway Abstraction
To keep the booking logic decoupled from PhonePe-specific SDKs/APIs, we implement a payment provider interface:
- `createPaymentOrder({ booking, amount, currency })`
- `getPaymentStatus({ merchantOrderId })`
- `normalizeWebhookEvent({ headers, body })`

A `sandbox` provider implements this interface, logging callbacks and facilitating mock checkout redirects for local testing and CI runs.

### 3. Compliance and Waiver Logging
To satisfy legal waiver evidence requirements, we store signing logs directly in the target `Booking` model fields (`waiverAccepted`, `waiverAcceptedAt`, `waiverIpAddress`) rather than implementing a separate, heavy database audit logging module or audit event store.

### 4. Hold Lifecycle
A booking hold is not represented by a separate database state. The `pending_payment` status represents both a hold and a pending transaction. Expiration (10-minute TTL) is enforced lazily during hold creation and explicitly through a background sweeper.

## Consequences
- **Robust Concurrency**: Database constraints serve as the final, absolute guard against double-bookings.
- **Improved Performance**: Database unique index lookups are significantly faster and consume fewer connection resources than application-managed locking states.
- **Gateway Isolation**: Live payment gateways (PhonePe) can be plugged in without changing the core bookings service.
- **Simplified Auditing**: Waiver compliance audits require only simple queries on the `bookings` table.
