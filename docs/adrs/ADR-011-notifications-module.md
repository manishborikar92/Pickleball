# ADR-011: Scheduled Notifications as an Independent Module with a PostgreSQL Outbox Scheduler

## Status

Approved

## Context

The platform documents two WhatsApp notification workflows in `docs/product/02-BUSINESS-LOGIC.md` §8 ("Automated Notification Matrix") and `docs/audits/01-END-USER-GAP-ANALYSIS.md` §3, both previously classified as **Deferred**:

1. **Scheduled reminders** at T-24h and T-2h before a player's session start.
2. **Post-session review request** sent after a booking ends, linking `/review/{bookingId}`.

Meta WhatsApp Business delivery is intentionally deferred (~30 days). The goal is to build all scheduling infrastructure, business logic, handlers, transport abstraction, admin controls, tests, and documentation **now**, so only Meta credentials/templates/webhook config remain at activation. The product document names "a job scheduler (BullMQ or pg-boss)" as the dependency.

Key facts established during analysis:

- **The stack is PostgreSQL-only.** No Redis exists anywhere; ADR-002 explicitly defers Redis to "a future scaling option." BullMQ therefore cannot be used without introducing a new infrastructure dependency.
- **An in-process scheduler already exists.** `server/src/core/scheduler.js` (`createScheduler`) is a sequential interval poller — no overlap, drains in-flight work on shutdown, error-isolated per job — already running five sweepers (`purge-expired-records`, `expire-pending-holds`, `sweep-completed-bookings`, `sweep-expired-reward-instances`, `reconcile-stale-payments`) from `server.js`. All other deferred/periodic work already runs this way.
- **Scale is small.** ~250 bookings/month, single venue. Timing precision equal to the scheduler interval (30s–5min) is far tighter than T-24h/T-2h/post-session require.
- **The booking-confirmation state transition happens in exactly three repository transactions** (`confirmWalletOnlyPayment`, `confirmProviderPayment`, `confirmBooking`) in `bookings.repository.js` — the same single seam ADR-010 used for atomic reward issuance.
- **Phantom/late payments must not schedule.** `handleProviderPaymentEvent` sets `forceExpire: isSessionEnded`, so a payment landing after the session already ended transitions the booking to `expired` (not `confirmed`) inside `confirmProviderPayment`.

## Decision

Model notifications as a **first-class, self-contained module** (`server/src/modules/notifications/`) with a **PostgreSQL-backed outbox** driven by the **existing in-process scheduler** — no new dependency, no Redis, no second migration system.

### Scheduling (planner) — inside the confirm transaction

A `createNotificationPlannerService` is injected into the bookings repository (an optional `notificationPlanner` param on `createDefaultBookingsService`, defaulting to `createDefaultNotificationPlanner()`) and called inside **all three** confirm transactions, immediately after the reward-issuance hook. It computes the session-start UTC (`getBookingStartUtc`) and session-end UTC (`getBookingEndUtc`, overnight-aware) from `booking.slotDate` + session times + `venue.timezone`, and **only inserts outbox rows** (never sends), inside the same transaction — confirmation and scheduling commit/rollback atomically. Duplicate confirm signals are absorbed by `UNIQUE (booking_id, type)` (P2002 → skip). Targets already in the past are never scheduled. The phantom `forceExpire` branch never reaches the confirm path, so it schedules nothing.

### Delivery (dispatcher) — the outbox + a scheduler job

The `notifications` table is the outbox: `booking_id, venue_id, user_id, type, scheduled_for, status, attempts, next_retry_at, sent_at, provider, last_error` with `UNIQUE(booking_id, type)` and an index on `(status, scheduled_for)`. A new `dispatch-due-notifications` job in the existing scheduler:

1. **Claims** due rows atomically (`scheduled → sending` via a status-guarded `updateMany`) — safe under future multi-instance dispatchers.
2. **Re-checks booking eligibility at dispatch time** — the core correctness guard against state changes between scheduling and delivery:
   - Reminders send while `confirmed|walk_in`; `skipped` if the session already ended (`completed`); `cancelled` if the booking voided.
   - `review_request` sends only when `completed`; if the completion sweeper hasn't transitioned yet (`confirmed|walk_in`) the row is **released back to `scheduled`** (no attempt consumed) and retried next cycle, giving up only after a 48h max delay.
3. Sends via the transport; **dry-run until Meta is configured**.
4. On failure, retries with backoff and **dead-letters at `maxAttempts`** (visible in the log).

**Cancellation:** no dedicated cancel-booking endpoint exists yet; the at-dispatch eligibility re-check is the primary (and sufficient) guard — a cancelled/expired booking's reminders never send.

### Transport abstraction — dry-run vs live

`createNotificationTransport({ config, fetchImpl })` generalizes the OTP-provider pattern (`auth/otp.provider.js`): in `dry_run` mode (default, when `NOTIFICATIONS_TRANSPORT_MODE !== 'live'` or Meta creds/templates are absent) it logs the would-be message and returns `{ provider: 'dry_run', delivered: true }` without a network call, so the full pipeline is exercised and observable pre-Meta. In `live` mode it POSTs the utility template to the Graph API. Scheduling/business logic never call the transport directly — only the dispatcher does — so transport replacement later (Meta-specific final config) touches one module, not the business rules. `otp.provider.js` is intentionally left untouched (auth-specific; refactoring it to share the transport is out of scope).

### Admin controls

Venue notification toggles are a DB row (`notification_settings`, per-venue — the established DB-toggle pattern like `reward_mechanisms.is_active`), defaulting **off** so the feature is inert until an admin opts in:

| Method & path | Purpose | Auth |
|---|---|---|
| `GET /notifications/settings?venue_id=` | Venue notification toggles | `manage_venues` (route-resolved) |
| `PATCH /notifications/settings` | `{ venue_id, reminders_enabled?, review_requests_enabled? }` upsert | `manage_venues` (route-resolved) |
| `GET /notifications/log?venue_id=&status=&type=&page=&limit=` | Paginated dispatch log + per-status summary (observability) | `manage_bookings` (route-resolved) |

Permission enforcement is at the route layer via `requireVenuePermission` (venue supplied in query/body), mirroring the reviews/rewards list endpoints; the service does not re-authorize. The frontend `/admin/settings` page (previously a read-only stub) now renders the two toggles (accessible `role=switch` control) plus a recent-activity panel, following the rewards admin pattern.

## Alternatives Considered

| Alternative | Tradeoff |
|---|---|
| **BullMQ + Redis** | Real delayed-job queue, but Redis is not in the stack and ADR-002 explicitly defers it — introduces a new infrastructure dependency and operational burden for negligible gain at this scale |
| **pg-boss** | PostgreSQL-native queue with built-in retry/dead-letter, but adds a dependency and a second (non-Prisma) schema/migration system; the existing scheduler already covers the periodic-work pattern, and the outbox table provides the needed retry/audit semantics directly |
| **Extend `core/scheduler.js` + DB outbox (chosen)** | No new dependency, no Redis; mirrors how all other deferred/periodic work already runs; idempotency/retry/observability come from the outbox table; timing precision (scheduler interval) is far tighter than the workflows need |
| **pg-cron / database-side scheduling** | Moves orchestration into the database and away from the app's structured logging/error handling; harder to test and observe |
| **Fire reminders via a daily cron + `SELECT … WHERE session_date = tomorrow`** | Misses intra-day timing (T-2h) and can't express post-session review timing cleanly; the outbox captures exact per-booking target times at confirm |

## Consequences

- **Benefits:** Clear domain ownership; scheduling atomicity for free at every present and future confirmation path (walk-ins included); idempotency, retry, dead-letter, and full dispatch auditability from the outbox table; zero new infrastructure or dependencies; the whole pipeline is exercisable and observable pre-Meta; activation later requires only env vars + Meta credentials + approved templates + enabling the toggles.
- **Trade-offs:** Dispatch precision is bounded by the scheduler interval (30s–5min) — irrelevant at this notification granularity. Bookings confirmed before a toggle is enabled are never scheduled (scheduling is at confirm time); a backfill is out of scope. The `otp.provider` and notifications transport remain two similar modules (a deliberate scope decision — a shared transport can be extracted later).
- **Meta activation runbook:** (1) configure Meta credentials and approve the three utility templates (`reminder_t24`, `reminder_t2h`, `review_request`); (2) set `NOTIFICATIONS_TRANSPORT_MODE=live` + the three `WHATSAPP_*_TEMPLATE_NAME` env vars (config-build validation enforces them in production); (3) admin enables the toggles at `/admin/settings`. New confirmations from that point send live.
- **Documentation reconciliation:** `docs/product/02-BUSINESS-LOGIC.md` §8 still classifies these workflows as deferred — accurate, since *delivery* is deferred; the scheduling/logic/admin layers are now built. Recorded in `docs/ai/03-IMPLEMENTATION-STATUS.md`.
