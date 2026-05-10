Here is the complete Product, Business Logic, and Architecture Blueprint for the platform.

# Pickleball Platform Specification

## 1. Executive Summary

This document outlines the complete specification for a dynamic, highly configurable, and scalable Pickleball Court Booking Platform. The platform is designed with a frictionless, conversion-optimized user experience on the frontend, paired with an immensely powerful, centralized, multi-tenant administrative backend.

---

## 2. Technology Stack & Architecture

The system is built as a **headless, multi-tenant, event-driven platform** to ensure long-term scalability across multiple locations and venues.

* **Database (PostgreSQL):** Chosen for strict ACID compliance to prevent double-bookings via row-level locking. It utilizes `JSONB` columns for flexible, NoSQL-like pricing and scheduling rules.
* **Backend (Express.js / Node.js):** Lightweight, fast, and unopinionated. It facilitates rapid development and integration with modern AI tooling.
* **Frontend (Next.js):** Handles both the lightning-fast static landing pages and the dynamic user booking application.

### The Multi-Tenant Foundation

To prevent future structural debt, the database is partitioned by **Venues**. Every court, schedule, pricing rule, and user role belongs to a specific Venue. This allows seamless expansion from one facility to a nationwide franchise without rewriting the database logic.

---

## 3. Security & Access Control (RBAC)

The system utilizes a **Contextual Role-Based Access Control** model. Roles are not hardcoded to users globally; they are dynamically assigned per venue.

* **Permissions over Roles:** The backend code guards routes by checking specific capabilities (e.g., `hasPermission('edit_pricing')`) rather than checking generic titles (e.g., `isAdmin`).
* **Venue_User_Roles:** A mapping table ensures a user can be a "Manager" at Venue A, but just a regular "Customer" at Venue B.
* **Session Management:** The system combines short-lived JWTs (JSON Web Tokens) with a Redis Denylist. This allows Super Admins to instantly revoke access for rogue employees without waiting for their token to expire natively.

---

## 4. Core Business Logic & Workflows

### A. The Scheduling Brain

The admin controls the availability of courts dynamically using a layered scheduling system.

1. **Standard Operating Hours:** The default baseline template (e.g., Mon-Sun, 6 AM – 10 PM, 60-min slots).
2. **Daily Overrides (Exceptions):** Admins can alter specific days (e.g., close at 4 PM on Friday for a tournament). Overrides dynamically alter the generated slot array for that specific day.
3. **Advance Rolling Window:** Users can only book *X* days in advance. A system "Rollover Time" (e.g., 8:00 AM) dictates exactly when the next day becomes visible, preventing users from camping the site at midnight.

### B. Dynamic Pricing Engine (The Waterfall Logic)

Pricing is calculated entirely on the backend utilizing a hierarchical ruleset stored in PostgreSQL `JSONB`.

1. **Base Price:** The default hourly rate for the court.
2. **Time/Day Modifiers:** Rules applied based on the timestamp (e.g., +20% for Weekends, -50% for 9 AM - 10 AM).
3. **Court Modifiers:** Premium fees for specific courts (e.g., indoor vs. outdoor).
4. **Coupons:** Percentage or flat discounts with usage limits and "stackable" boolean flags (dictating if they can be used alongside time modifiers).

### C. The Frictionless Booking Flow

Designed to maximize conversion by moving authentication to the middle of the funnel.

1. **Browse:** Unauthenticated user views live inventory.
2. **Select & Lock (Critical Step):** User selects a slot. The database locks the row via `SELECT ... FOR UPDATE`. A temporary 10-minute hold is placed on the slot, making it completely invisible to others.
3. **Auth Gate:** The system asks for Name & Mobile → OTP Verification.
4. **Payment:** User confirms the non-refundable policy and pays via the Gateway.
5. **Confirmation:** A success webhook converts the hold to a permanent booking. If 10 minutes pass without payment, a background job automatically releases the slot back to the public pool.

---

## 5. Operational Policies & Edge Cases

### The Strict No-Cancellation Policy & The AM/PM Trap

Bookings are 100% final. To mitigate customer errors (e.g., booking 7 AM instead of 7 PM), the checkout includes a highly visible, mandatory acknowledgment checkbox verifying the specific time and the no-refund policy before payment can be initiated.

### Platform Wallet & Force Majeure (Rainchecks)

If courts are unusable due to weather or maintenance, the Admin initiates a cancellation. Instead of a bank refund (which incurs gateway fees), the system issues "Court Credits" to the user's Platform Wallet (tied to their mobile number). This acts as forced customer retention for future bookings.

### The Stale Payment (Phantom Booking)

If a bank delays processing and the "Success" webhook arrives *after* the 10-minute slot lock has expired (and someone else booked the slot in the meantime), the system catches the mismatch. It alerts the Admin, triggers an automatic refund/credit, and sends an apology SMS to the user indicating the slot timed out.

### Anti-Hoarding Rules

To prevent malicious users or bots from continually clicking slots to trigger the 10-minute lock across the whole board without paying, the system enforces a "Velocity Check." A single session or mobile number can only hold a maximum of 2 "Pending" slots simultaneously.

---

## 6. Administrative Controls & Insights

The Admin Dashboard is built to function as a complete operational command center.

* **Walk-ins & Manual Overrides:** Admins can instantly lock a slot for cash-paying walk-ins or VIP events, bypassing the payment gateway and rolling availability windows entirely.
* **Idempotent Webhooks:** The system safely handles duplicate "Payment Success" signals from gateways (like Razorpay or Stripe) without duplicating bookings or crashing the database.
* **Business Intelligence Readiness:** The relational structure allows for future generation of detailed reports (e.g., Court utilization rates, peak drop-offs, Lifetime Value of verified phone numbers) to dynamically adjust the JSONB pricing rules for maximum revenue yield.