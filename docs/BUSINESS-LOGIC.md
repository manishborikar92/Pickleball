This is the comprehensive blueprint for your Pickleball platform. We are designing this as a **headless, multi-tenant, event-driven system**. This ensures that whether you have two courts in Hyderabad today or two hundred across India tomorrow, the logic remains unbreakable.

---

## I. Core System Architecture: The Multi-Tenant Foundation

Even if you start with one location, the logic must treat "Venues" as the top-level container to prevent future structural debt.

* **The Venue Entity:** Contains localized settings: Timezone, Currency, Rollover Time (when the next day’s slots open), and Advance Booking Window (7, 15, or 30 days).
* **The Court Entity:** Belongs to a Venue. Courts have "Types" (Indoor/Outdoor, Clay/Hard) and "Status" (Active, Under Maintenance, Offline).
* **Contextual RBAC:** Roles are assigned *per venue*. A user could be a "Manager" at Venue A but just a "Customer" at Venue B.
* **Permissions-based logic:** Code should check for `CAN_EDIT_PRICING` rather than `IS_ADMIN`.



---

## II. The Scheduling Brain: Dynamic Availability

The system must distinguish between a "Template" and "Live Reality."

### 1. The Schedule Hierarchy

1. **Standard Operating Hours (The Template):** The default (e.g., Mon-Sun, 6 AM – 10 PM).
2. **Daily Overrides:** Admin can "paint" over a specific date.
* *Example:* This Friday, close at 4 PM for a private tournament.


3. **Slot Duration Logic:** Slots are generated based on the duration setting (60, 90, 120 mins).
* **The "Gap" Rule:** If a court is open 9 AM – 12 PM and a slot is 90 mins, the system only generates two slots (9:00 and 10:30). If the admin changes it to 60 mins, it instantly generates three.



### 2. The Rollover Logic

To avoid the "Midnight Rush" where users stay up to grab slots, the admin sets a **Rollover Trigger Time** (e.g., 8:00 AM).

* On Monday at 8:00 AM, the slots for the next Monday (7 days out) become visible.

---

## III. The Pricing & Revenue Engine

We use a **Hierarchical Calculation Model** to determine the price of a slot in real-time.

### 1. The Calculation Flow (The "Waterfall" Logic)

When a user clicks a slot, the system runs this calculation:

1. **Base Price:** The default hourly rate for that court.
2. **Time-Based Modifiers:** Check for "Peak vs. Off-Peak" rules.
* *Logic:* If `Day == Weekend` OR `Time > 18:00`, apply `+20%`.


3. **Court-Specific Modifiers:** (e.g., Indoor courts cost 10% more).
4. **Coupon Application:** Final flat or percentage deduction.
5. **Taxes:** Added at the very end.

### 2. Coupon Logic & Constraints

* **Usage Limits:** "First 100 users" or "Once per phone number."
* **Stacking Rules:** A boolean flag `is_stackable`. If false, the coupon overrides time-based modifiers rather than adding to them.

---

## IV. The Booking Workflow: "Lock & Confirm"

This is the most critical logic to prevent double-booking and "phantom" inventory.

### 1. The 10-Minute Temporary Hold (State Machine)

* **State: AVAILABLE** $\rightarrow$ User selects slot.
* **State: PENDING_PAYMENT** $\rightarrow$ System creates a record with a `locked_until` timestamp.
* *Constraint:* This slot is now invisible to all other users.


* **State: BOOKED** $\rightarrow$ Payment gateway sends a "Success" webhook.
* **State: EXPIRED** $\rightarrow$ If 10 minutes pass without a success signal, the record is deleted/archived, and the slot reappears.

### 2. The Verification Gate (OTP)

To keep the top of the funnel wide, we only ask for OTP *after* the user has committed to a slot.

* **Anonymous ID:** We track the "Pending" booking via a session ID until the OTP is verified.
* **Verified Profile:** Once the OTP is successful, the phone number is linked to the booking. If the user exists, we attach the booking to their history; if not, we create a new profile.

---

## V. Operational Scenarios & Edge Cases

### 1. The "No Cancellation" Policy & The "Raincheck" Exception

Since you have a strict no-cancellation policy, you need a workflow for when the **business** fails the user (e.g., flood, power outage).

* **The Credit/Wallet Workflow:** Instead of a cash refund (to save on transaction fees), the admin cancels the slot and issues "Court Credits" to the user's phone number. These credits are automatically applied as a discount on their next booking.

### 2. The "Stale Payment" (Phantom Booking)

* **Scenario:** User pays at minute 9, but the bank takes 2 minutes to process. By then, the 10-minute hold has expired and someone else booked the slot.
* **Logic:** When the "Success" webhook arrives for an `EXPIRED` slot, the system cannot confirm the booking. It must automatically:
1. Notify the Admin.
2. Issue an immediate refund or credit to the user.
3. Send an SMS: *"Oops! The payment took too long and the slot was taken. Your refund is being processed."*



### 3. Administrative "Blackouts" & Walk-ins

* **Manual Blockout:** Admin can select a range of slots and mark them as "Reserved" (for maintenance or VIPs) without a payment record.
* **Walk-in Entry:** Admin enters a Name/Phone and marks it as "Paid Cash." This completes the booking immediately, bypassing the gateway.

### 4. Anti-Hoarding Rules

* **Velocity Checks:** A single phone number cannot have more than 2 "Pending" bookings at once. This prevents a bot or a malicious user from locking all courts for 10 minutes by just clicking slots and never paying.

---

## VI. Long-term Scalability: The "Insights" Layer

As you grow, the Admin panel should transition from a "Management Tool" to a "Business Intelligence Tool."

* **Utilization Analytics:** Which hours stay empty? (The system can then suggest "Flash Sales" for those specific times).
* **Customer Lifetime Value (CLV):** Identify your top 5% of players based on their verified phone numbers and send them exclusive early-access booking windows.
* **Dynamic Peak Adjustment:** Logic that suggests raising prices if a specific time slot (e.g., Sunday 7 PM) has been booked within 5 minutes of opening for 4 consecutive weeks.

Does this level of business logic cover the "maximum control" you were looking for, or should we refine the logic for the "Platform Wallet" and credit system?