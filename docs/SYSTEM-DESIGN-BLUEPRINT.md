To build a system that can handle dynamic pricing, fluid schedules, strict concurrency, and future expansion to multiple venues, the architecture must be designed around **Multi-Tenancy** and **State Machines**.

When designing for potential multi-venue expansion, the system must shift to a multi-tenant architecture. Similar to structuring a practice management platform where different organizations or branches require strictly isolated data environments, every core entity in this system must eventually trace back to a specific "Tenant" or Venue.

Here is the complete blueprint for the system design, database structure, and backend business logic.

### 1. The Database Architecture (PostgreSQL)

To support maximum flexibility, the database should be divided into distinct "Domains."


#### Domain A: Venue & Multi-Tenancy

* **`Venues`:** The core entity. Every court, booking, and schedule belongs to a venue.
* **`Courts`:** Linked to a Venue. Contains basic metadata (name, indoor/outdoor).

#### Domain B: Identity & Contextual RBAC

Because a user might be a "Customer" at Venue A but a "Manager" at Venue B, roles cannot be attached directly to the user. They must be contextual.

* **`Users`:** Global identity (Phone, Name, OTP verified status).
* **`Roles` & `Permissions`:** The standard RBAC tables we discussed.
* **`Venue_User_Roles` (The Key Pivot):** This table maps a `User_ID` to a `Role_ID` for a specific `Venue_ID`. This ensures that data scoping is strictly enforced.

#### Domain C: The Scheduling & Pricing Engine

This is where the NoSQL-like flexibility of PostgreSQL's `JSONB` shines.

* **`Schedules`:** Defines standard operating hours per Venue/Court (e.g., Mon-Fri, 9 AM - 9 PM, 60-min slots).
* **`Schedule_Exceptions`:** Overrides standard schedules. For example, blocking out an entire Tuesday for maintenance, or changing tomorrow's hours to 10 AM - 7 PM.
* **`Pricing_Rules`:** This is where you use `JSONB`. Instead of hardcoding columns for every possible discount, you store the logic.
* *Example JSON payload:* `{"type": "time_modifier", "days": ["Saturday", "Sunday"], "start_time": "09:00", "end_time": "12:00", "adjustment_type": "percentage", "value": -50}`


* **`Coupons`:** Global or venue-specific codes with usage limits and expiry dates.

#### Domain D: The Booking & Transaction Engine

* **`Bookings`:** The central transaction record. It links User, Court, Time, and Status.
* **`Payments`:** Links to a Booking. Tracks the payment gateway ID, amount, and status (Success, Failed, Refunded).

### 2. The Core Backend Workflows & Logic

#### The "Slot Sniping" & Concurrency Workflow

To prevent double-booking, the backend must implement a highly strict locking mechanism.

1. **The Read Phase:** The frontend queries available slots. The backend calculates these on-the-fly by looking at the `Schedules`, subtracting `Schedule_Exceptions`, and subtracting confirmed/pending `Bookings`.
2. **The Lock Phase (Critical):** User selects 5:00 PM. The backend initiates a database transaction.
* It checks one last time: "Is 5:00 PM still free?"
* If yes, it inserts a `Booking` record with `status = 'pending_payment'` and an `expires_at` timestamp (e.g., `NOW() + 10 minutes`).
* *System Design Note:* This relies on PostgreSQL's row-level locking (`SELECT ... FOR UPDATE`) so if two requests hit the exact same millisecond, the database forces one to wait, and then rejects it because the slot was just taken.


3. **The Cleanup Phase:** You need a background worker (or a Redis TTL trigger) that constantly sweeps the database. If it finds any `pending_payment` bookings where `expires_at` has passed, it automatically changes the status to `expired`, releasing the slot back to the public.

#### The Pricing Calculation Workflow

Because pricing is dynamic, the frontend should *never* calculate the final price.

1. User selects a slot.
2. Backend calculates the base price based on the `Schedules`.
3. Backend queries `Pricing_Rules` to see if any modifiers apply to that specific date/time, applying them in a strict hierarchy.
4. Backend applies any valid `Coupons`.
5. Backend generates a final "Quote" and sends it to the payment gateway to generate a payment intent/link. This guarantees the user pays exactly what the system expects.

#### Security & Session Management Logic

Because admins have immense power, standard stateless JWTs (JSON Web Tokens) carry a risk. If you fire a Manager, you cannot easily invalidate their token until it naturally expires.

* **The Hybrid Approach:** Use short-lived JWTs (e.g., 15 minutes) combined with a Redis "Denylist". When an Admin is revoked or logs out, their current token signature is written to Redis. Every sensitive API request briefly checks Redis; if the token is listed, the request is violently rejected, enforcing an immediate lockout.

### 3. Key Edge Cases Managed by this Design

* **Idempotency:** What if the payment gateway's webhook fails, but the user's money was deducted? The webhook endpoint must be idempotent. If the payment gateway sends the "Success" signal three times, the system checks the `Booking` status. If it is already `confirmed`, it gracefully ignores the duplicate signals rather than creating duplicate records.
* **The Zero-Downtime Migration:** By storing pricing logic in `JSONB`, if the business suddenly decides to implement "Dynamic Surge Pricing based on weather," you do not need to run a massive database migration to add new columns. You simply update the backend logic to parse a new JSON rule type.

With this architecture, the business logic dictates the system behavior, rather than the database structure restricting the business.

Considering the critical nature of the payment and locking flow, would you prefer to handle the 10-minute temporary holds entirely within the PostgreSQL database using a background job, or introduce Redis as an in-memory datastore specifically to handle those fast-expiring locks?