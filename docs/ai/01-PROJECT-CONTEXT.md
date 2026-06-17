# AI Project Context — Business Domain & User Journeys

This document details the business domain, operational scope, and user journeys of the Pickleball Court Booking Platform.

---

## 1. Business Domain & Operational Scope

The Pickleball platform is designed to run bookings at a single sports venue with future scalability to multiple locations:
* **Current Launch Venue**: Besa, Nagpur.
* **Facilities**: 2 pickleball courts.
* **Administrative Operations**: Managed locally by a small staff operator team.
* **Target Audience**: Indian players using UPI mobile payments.
* **Headless Multi-Tenancy**: The database schema and system architecture support multiple venues from day one. Every table is scoped with a `venue_id` foreign key. However, multi-venue front-end dashboards, user selectors, and cross-venue dashboards are deferred for launch.

---

## 2. Customer User Journeys

A customer completes a booking by going through the following steps:

```
[ Step 1: Browse Slots ] ──► [ Step 2: Click Confirm & Pay ] ──► [ Step 3: Auth Gate ]
        │                                                                │
        ▼                                                                ▼
   (View grid on              (If valid JWT exists in client store,      (If new user: SMS/WA OTP
   calendar UI)               bypass auth gate. Otherwise, request OTP)  verified -> Onboarding name)
                                                                         │
                                                                         ▼
[ Step 6: Confirmation ] ◄── [ Step 5: UPI Payment ] ◄── [ Step 4: Waiver Acknowledgement ]
  (Receive receipt &           (Redirected to PhonePe                 (Accept waiver and no-cancellation
  WA notification)             UPI Gateway)                           rules. Lock slot for 10 minutes)
```

### 2.1 Customer Booking Path Variations
* **Path A (New Customer)**: Phone Entry -> Verify WhatsApp OTP -> Create User (name = null) -> Onboarding page (submit Name) -> Intended Waiver screen -> Lock Slot -> PhonePe Checkout -> Booking Confirmed.
* **Path B (Returning Customer)**: Phone Entry -> Verify WhatsApp OTP -> User Record Found (name is set) -> Intended Waiver -> Lock Slot -> PhonePe Checkout -> Booking Confirmed.
* **Path C (Active Session Customer)**: Valid JWT exists -> Bypass auth gate -> Intended Waiver -> Lock Slot -> PhonePe Checkout -> Booking Confirmed.

---

## 3. Staff User Journeys

Staff members do not use OTP verification. They manage bookings via the Admin Panel:

```
[ Staff Provisioning ] ──► [ Email Activation ] ──► [ Admin Dashboard ]
     (Admin creates             (Staff sets password,       (Access to calendars,
      staff record)             suspends status)            schedules, and pricing)
```

* **Staff Provisioning**: Created exclusively by a Super Admin. A credentials record is initialized with status `pending_activation`, and an email containing a link with a 72-hour validation token is dispatched.
* **Activation Flow**: Staff clicks activation link -> sets password -> status updates to `active`.
* **Login Flow**: Log in using Email + Password. If `force_password_change` flag is true, staff is forced to change their password before accessing any API routers.
* **Operations**: Staff can register walk-in entries and block courts directly on the booking grid, bypassing payment gateways.
