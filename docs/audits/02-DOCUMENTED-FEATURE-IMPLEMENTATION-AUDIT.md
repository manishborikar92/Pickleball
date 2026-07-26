# Documented Feature Implementation Audit & Gap Analysis

This document presents a comprehensive, evidence-based review across all specifications in `docs/`, `server/`, and `web/`. Every item reported below is traceable directly to one or more project `.md` or `.txt` specification files and cross-referenced against the actual implementation in `server/` and `web/`.

Fully implemented features (such as PostgreSQL/Prisma migration, customer-side slot lock concurrency engine, PhonePe PG v2 payment integration with fresh entropy retries, S2S webhook processing, customer OTP auth with edge session rotation, reviews with moderation, and voucher-based scratch card reward engine) have been validated and excluded from the gap inventory per strict audit guidelines.

---

## Table of Contents

- [1. Executive Summary & Audit Matrix](#1-executive-summary--audit-matrix)
- [2. Detailed Gap Breakdown by Subsystem](#2-detailed-gap-breakdown-by-subsystem)
  - [2.1 Admin Authentication & Account Lifecycle](#21-admin-authentication--account-lifecycle)
    - [Item 1.1: Admin Account Provisioning (Invite-Only Flow)](#item-11-admin-account-provisioning-invite-only-flow)
    - [Item 1.2: Admin Account Activation & Password Setup Flow](#item-12-admin-account-activation--password-setup-flow)
    - [Item 1.3: Admin Password Reset Request & Confirmation Flow](#item-13-admin-password-reset-request--confirmation-flow)
    - [Item 1.4: Admin Forced Password Change Flow](#item-14-admin-forced-password-change-flow)
  - [2.2 Booking & Court Access Control](#22-booking--court-access-control)
    - [Item 2.1: Court Access PIN Generation & Display](#item-21-court-access-pin-generation--display)
    - [Item 2.2: Admin Booking Slots & Schedule Management (Operating Hours, Exceptions, Walk-Ins, Admin Blocks)](#item-22-admin-booking-slots--schedule-management-operating-hours-exceptions-walk-ins-admin-blocks)
  - [2.3 Notifications & Messaging (WhatsApp)](#23-notifications--messaging-whatsapp)
    - [Item 3.1: Scheduled WhatsApp Booking Reminders (T-24h / T-2h)](#item-31-scheduled-whatsapp-booking-reminders-t-24h--t-2h)
    - [Item 3.2: Post-Session WhatsApp Review Requests](#item-32-post-session-whatsapp-review-requests)
    - [Item 3.3: WhatsApp Webhook Verification Handshake Endpoint](#item-33-whatsapp-webhook-verification-handshake-endpoint)
    - [Item 3.4: Production WhatsApp Cloud API Credentials & Template Setup](#item-34-production-whatsapp-cloud-api-credentials--template-setup)
  - [2.4 Promotions, Coupons & Dynamic Pricing](#24-promotions-coupons--dynamic-pricing)
    - [Item 4.1: Admin Coupon Management REST API & Frontend UI](#item-41-admin-coupon-management-rest-api--frontend-ui)
    - [Item 4.2: Admin Dynamic Pricing Rules REST API & Frontend UI](#item-42-admin-dynamic-pricing-rules-rest-api--frontend-ui)
    - [Item 4.3: Coupon Usage Tracking & Limit Enforcement (coupon_usages)](#item-43-coupon-usage-tracking--limit-enforcement-coupon_usages)
  - [2.5 Customer Profile & Support Infrastructure](#25-customer-profile--support-infrastructure)
    - [Item 5.1: Customer Self-Service Profile Update API (PATCH /users/me)](#item-51-customer-self-service-profile-update-api-patch-usersme)
    - [Item 5.2: Support Form Submission Delivery Endpoint](#item-52-support-form-submission-delivery-endpoint)
  - [2.6 Admin Dashboard & Operational Screens](#26-admin-dashboard--operational-screens)
    - [Item 6.1: Admin Overview Dashboard Real Data API](#item-61-admin-overview-dashboard-real-data-api)
    - [Item 6.2: Admin User Lookup & Customer Booking History API](#item-62-admin-user-lookup--customer-booking-history-api)
    - [Item 6.3: Admin Venue Settings Manager](#item-63-admin-venue-settings-manager)
    - [Item 6.4: Admin Court Details & Status Management API](#item-64-admin-court-details--status-management-api)
    - [Item 6.5: Admin Force-Cancellation & Credit Issuance Endpoint](#item-65-admin-force-cancellation--credit-issuance-endpoint)
  - [2.7 Payments & Settlement Operations](#27-payments--settlement-operations)
    - [Item 7.1: Nightly Settlement Reconciliation Job](#item-71-nightly-settlement-reconciliation-job)
  - [2.8 Media Storage & Photo Uploads](#28-media-storage--photo-uploads)
    - [Item 8.1: Cloudflare R2 Integration for Court & Review Photos](#item-81-cloudflare-r2-integration-for-court--review-photos)
  - [2.9 Rewards & Gamification (Spinner Wheel)](#29-rewards--gamification-spinner-wheel)
    - [Item 9.1: Spinner Wheel Frontend Component](#item-91-spinner-wheel-frontend-component)
  - [2.10 Developer & Testing Infrastructure](#210-developer--testing-infrastructure)
    - [Item 10.1: Web Modernization Tooling & Testing Scaffolding (Phases 6–7)](#item-101-web-modernization-tooling--testing-scaffolding-phases-67)
- [3. Final Verification](#3-final-verification)

---

## 1. Executive Summary & Audit Matrix

| # | Subsystem / Area | Feature / Requirement | Status | Source Reference |
|---|---|---|---|---|
| 1 | **Admin Auth & Lifecycle** | Admin Account Provisioning (Invite-Only) | **Missing** | `docs/product/01-PROJECT-OVERVIEW.md` §2, `docs/product/02-BUSINESS-LOGIC.md` §1.4 |
| 2 | **Admin Auth & Lifecycle** | Admin Account Activation & Password Setup Flow | **Missing** | `docs/product/02-BUSINESS-LOGIC.md` §1.4, `docs/specs/02-API-SPECIFICATION.md` §11 |
| 3 | **Admin Auth & Lifecycle** | Admin Password Reset Request & Confirmation | **Missing** | `docs/product/01-PROJECT-OVERVIEW.md` §2, `docs/specs/02-API-SPECIFICATION.md` §11 |
| 4 | **Admin Auth & Lifecycle** | Admin Forced Password Change Flow | **Missing** | `docs/product/03-UI-UX-SPECIFICATION.md` §6.5, `docs/specs/02-API-SPECIFICATION.md` §11 |
| 5 | **Booking & Access Control** | Court Access PIN Generation & Display | **Partial** | `docs/product/02-BUSINESS-LOGIC.md` §5.2, `docs/specs/01-DATABASE-SCHEMA.md` Domain A |
| 6 | **Booking & Access Control** | Admin Booking Slots & Schedule Management (Hours, Exceptions, Walk-Ins, Blocks) | **Partial** | `docs/product/02-BUSINESS-LOGIC.md` §3–4, `docs/specs/02-API-SPECIFICATION.md` §11 |
| 7 | **Notifications & Messaging** | Scheduled WhatsApp Booking Reminders (T-24h / T-2h) | **Missing** | `docs/product/02-BUSINESS-LOGIC.md` §8, `docs/integrations/01-WHATSAPP-INTEGRATION.md` §1–3 |
| 8 | **Notifications & Messaging** | Post-Session WhatsApp Review Requests | **Missing** | `docs/product/02-BUSINESS-LOGIC.md` §8, `docs/integrations/01-WHATSAPP-INTEGRATION.md` §1–3 |
| 9 | **Notifications & Messaging** | WhatsApp Webhook Verification Handshake Endpoint | **Missing** | `docs/integrations/01-WHATSAPP-INTEGRATION.md` §2.4, §5.3 |
| 10 | **Notifications & Messaging** | Production WhatsApp Credentials & Template Setup | **Unclear** | `docs/product/04-FUTURE-WORK.md` §2, `docs/integrations/01-WHATSAPP-INTEGRATION.md` §2 |
| 11 | **Promotions & Pricing** | Admin Coupon Management REST API & Frontend UI | **Partial** | `docs/product/02-BUSINESS-LOGIC.md` §6, `docs/specs/02-API-SPECIFICATION.md` §11 |
| 12 | **Promotions & Pricing** | Admin Dynamic Pricing Rules REST API & Frontend UI | **Missing** | `docs/product/03-UI-UX-SPECIFICATION.md` §7, `docs/specs/02-API-SPECIFICATION.md` §11 |
| 13 | **Promotions & Pricing** | Coupon Usage Tracking & Limit Enforcement | **Partial** | `docs/product/02-BUSINESS-LOGIC.md` §6.2, `docs/specs/01-DATABASE-SCHEMA.md` Domain C |
| 14 | **Customer & Support** | Customer Self-Service Profile Update API (`PATCH /users/me`) | **Missing** | `docs/specs/02-API-SPECIFICATION.md` Section 4 |
| 15 | **Customer & Support** | Support Form Submission Delivery Endpoint | **Partial** | `docs/product/03-UI-UX-SPECIFICATION.md` §2.8, `docs/audits/01-END-USER-GAP-ANALYSIS.md` §4 |
| 16 | **Admin Operations** | Admin Overview Dashboard Real Data API | **Partial** | `docs/product/03-UI-UX-SPECIFICATION.md` §7, `docs/plans/web-modernization/03-issues-register.md` ME-3 |
| 17 | **Admin Operations** | Admin User Lookup & Customer Booking History API | **Partial** | `docs/product/03-UI-UX-SPECIFICATION.md` §7, `docs/specs/02-API-SPECIFICATION.md` §11 |
| 18 | **Admin Operations** | Admin Venue Settings Manager | **Partial** | `docs/product/03-UI-UX-SPECIFICATION.md` §7, `docs/specs/02-API-SPECIFICATION.md` §11 |
| 19 | **Admin Operations** | Admin Court Details & Status Management API | **Missing** | `docs/product/03-UI-UX-SPECIFICATION.md` §7 |
| 20 | **Admin Operations** | Admin Force-Cancellation & Credit Issuance Endpoint | **Partial** | `docs/product/02-BUSINESS-LOGIC.md` §7, `docs/specs/02-API-SPECIFICATION.md` §11 |
| 21 | **Payments & Settlement** | Nightly Settlement Reconciliation Job | **Missing** | `docs/integrations/02-PAYMENT-INTEGRATION.md` §11.2 |
| 22 | **Media & Storage** | Cloudflare R2 Integration for Photos | **Missing** | `docs/product/01-PROJECT-OVERVIEW.md` §4.4, `docs/product/04-FUTURE-WORK.md` §2 |
| 23 | **Rewards & Gamification** | Spinner Wheel UI Component | **Missing** | `docs/product/02-BUSINESS-LOGIC.md` §12.7, `docs/adrs/ADR-010-rewards-module.md` |
| 24 | **Testing & CI Tooling** | Web Modernization E2E Testing & CI Scaffolding | **Partial** | `docs/plans/web-modernization/README.md` §Status, `06-implementation-plan.md` Phases 6–7 |

---

## 2. Detailed Gap Breakdown by Subsystem

### 2.1 Admin Authentication & Account Lifecycle

#### Item 1.1: Admin Account Provisioning (Invite-Only Flow)
* **Source Documentation Reference(s):**
  * `docs/product/01-PROJECT-OVERVIEW.md` Section 2 ("Built at Launch — Admin credential-based auth")
  * `docs/product/02-BUSINESS-LOGIC.md` Section 1.4 ("Admin Account Lifecycle")
  * `docs/product/03-UI-UX-SPECIFICATION.md` Section 7 ("Admin Account Management")
  * `docs/specs/02-API-SPECIFICATION.md` Section 11 (`POST /admin/users` / `POST /auth/admin/provision`)
  * `docs/ai/03-IMPLEMENTATION-STATUS.md` Section 2.2 ("Provisioning Engine — Planned")
* **Current Implementation Status:** Missing
* **Brief Description of Documentation Specification:** Admin accounts are created strictly via invitation by a `super_admin`. The system generates an invitation token, sets the account status to `invited`, and sends an email invitation containing a 72-hour activation link.
* **Brief Description of Codebase Reality:** `server/src/modules/auth/auth.routes.js` only exposes `POST /auth/admin/login`, `POST /auth/refresh`, `POST /auth/logout`, and `POST /auth/logout-all`. The seed script (`server/prisma/seed.mjs`) creates an initial admin account only when seed environment variables are supplied. No HTTP endpoint exists for inviting or provisioning admin accounts.
* **The Exact Gap That Remains:** Missing backend endpoint (`POST /admin/users` or `POST /auth/admin/provision`), invitation token generator, transactional email dispatch service, and frontend UI action in the admin dashboard.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/auth/auth.routes.js`, `server/src/modules/auth/auth.service.js`
  * Frontend: `web/src/app/(admin)/admin/users/`

---

#### Item 1.2: Admin Account Activation & Password Setup Flow
* **Source Documentation Reference(s):**
  * `docs/product/02-BUSINESS-LOGIC.md` Section 1.4 ("Activation window (72 hours)")
  * `docs/product/03-UI-UX-SPECIFICATION.md` Section 6.1–6.2 ("Admin Activation Screen")
  * `docs/specs/02-API-SPECIFICATION.md` Section 11 (`POST /auth/admin/activate`)
* **Current Implementation Status:** Missing
* **Brief Description of Documentation Specification:** An invited admin receives a token link (`/admin/activate?token=...`), enters a new password, and submits to `POST /auth/admin/activate`. If the 72-hour window has passed, the server responds with HTTP `400 INVALID_ACTIVATION_TOKEN`.
* **Brief Description of Codebase Reality:** No activation route or controller exists in `server/src/modules/auth/`, and no `/admin/activate` page component exists under `web/src/app/(auth)/`.
* **The Exact Gap That Remains:** Missing `POST /auth/admin/activate` backend route/service logic and missing `/admin/activate` frontend page component.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/auth/auth.routes.js`, `server/src/modules/auth/auth.controller.js`
  * Frontend: `web/src/app/(auth)/`

---

#### Item 1.3: Admin Password Reset Request & Confirmation Flow
* **Source Documentation Reference(s):**
  * `docs/product/01-PROJECT-OVERVIEW.md` Section 2
  * `docs/product/03-UI-UX-SPECIFICATION.md` Section 6.3–6.4 ("Forgot Password & Reset Password Screens")
  * `docs/specs/02-API-SPECIFICATION.md` Section 11 (`POST /auth/admin/forgot-password`, `POST /auth/admin/reset-password`)
  * `docs/ai/03-IMPLEMENTATION-STATUS.md` Section 2.2 ("Reset Flows — Planned")
* **Current Implementation Status:** Missing
* **Brief Description of Documentation Specification:** Admins can request a password reset (`POST /auth/admin/forgot-password`), which sends a 1-hour reset token via email. The admin navigates to `/admin/reset-password?token=...` and submits a new password (`POST /auth/admin/reset-password`).
* **Brief Description of Codebase Reality:** Neither endpoint exists in `server/src/modules/auth/auth.routes.js`. No reset UI forms exist in `web/src/app/(auth)/`.
* **The Exact Gap That Remains:** Missing `POST /auth/admin/forgot-password` and `POST /auth/admin/reset-password` backend APIs, email dispatch handler, and frontend reset request/confirm screens.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/auth/auth.routes.js`, `server/src/modules/auth/auth.service.js`
  * Frontend: `web/src/app/(auth)/`

---

#### Item 1.4: Admin Forced Password Change Flow
* **Source Documentation Reference(s):**
  * `docs/product/03-UI-UX-SPECIFICATION.md` Section 6.5 ("Force Password Change Screen")
  * `docs/specs/02-API-SPECIFICATION.md` Section 11 (`POST /auth/admin/change-password`)
  * `docs/product/04-FUTURE-WORK.md` Section 3
* **Current Implementation Status:** Missing
* **Brief Description of Documentation Specification:** When `next_step: "force_password_change"` is returned upon admin login, all admin routes redirect to `/admin/change-password`. The screen submits current password, new password, and confirmation to `POST /auth/admin/change-password`. On success, the flag is cleared and the admin is redirected to `/admin`.
* **Brief Description of Codebase Reality:** `POST /auth/admin/change-password` is not registered in `server/src/modules/auth/auth.routes.js`.
* **The Exact Gap That Remains:** Missing `POST /auth/admin/change-password` API endpoint and password change route guard/screen on the frontend.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/auth/auth.routes.js`, `server/src/modules/auth/auth.controller.js`
  * Frontend: `web/src/app/(admin)/`

---

### 2.2 Booking & Court Access Control

#### Item 2.1: Court Access PIN Generation & Display
* **Source Documentation Reference(s):**
  * `docs/product/02-BUSINESS-LOGIC.md` Section 5.2 (Step 6)
  * `docs/product/03-UI-UX-SPECIFICATION.md` Section 2.5 ("Booking Confirmation Screen")
  * `docs/specs/01-DATABASE-SCHEMA.md` Domain A (`access_pin` column)
  * `docs/audits/01-END-USER-GAP-ANALYSIS.md` Section 2 ("Court Access PIN Display")
* **Current Implementation Status:** Partial
* **Brief Description of Documentation Specification:** The system generates a random 4-digit PIN upon booking payment confirmation and stores it in `bookings.access_pin`. The booking confirmation card and booking detail screens display the court access PIN.
* **Brief Description of Codebase Reality:** The database schema in `server/prisma/schema.prisma` includes `accessPin String? @map("access_pin") @db.Char(4)`. However, `server/src/modules/bookings/bookings.service.js` does not generate a 4-digit PIN during booking confirmation, and `web/src/components/features/booking/BookingDetailView.js` does not render the PIN field.
* **The Exact Gap That Remains:** Random 4-digit PIN generation in `bookings.service.js` upon confirmation and display rendering in `BookingDetailView.js`.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/bookings/bookings.service.js`
  * Frontend: `web/src/components/features/booking/BookingDetailView.js`

---

#### Item 2.2: Admin Booking Slots & Schedule Management (Operating Hours, Exceptions, Walk-Ins, Admin Blocks)
* **Source Documentation Reference(s):**
  * `docs/product/02-BUSINESS-LOGIC.md` Section 3.3 ("Schedule Overrides / Daily Exceptions") & Section 4 ("Admin Block & Walk-in Entries")
  * `docs/product/03-UI-UX-SPECIFICATION.md` Section 7 ("Schedule Manager & Bookings Operational Screens")
  * `docs/specs/02-API-SPECIFICATION.md` Section 11 (`POST/PATCH /admin/schedules`, `POST/DELETE /admin/exceptions`, `POST /admin/bookings/walk-in`, `POST /admin/bookings/block`)
* **Current Implementation Status:** Partial
* **Brief Description of Documentation Specification:** Admins can manage standard operating hours templates (`VenueSchedule`), configure daily schedule exception overlays/closures (`ScheduleException`), create immediate walk-in bookings (`walk_in`), and trigger administrative court slot maintenance blocks (`admin_block`).
* **Brief Description of Codebase Reality:** Customer-side availability generation (`GET /venues/:venueId/availability`) and slot lock concurrency engine (`booking_slots_no_double_book`) are **fully implemented** in `server/src/modules/venues/` and `server/src/modules/bookings/`. Furthermore, Prisma schema tables support `VenueSchedule`, `ScheduleException`, and `BookingSlot` statuses (`walk_in`, `admin_block`). However, no backend REST endpoints exist in `server/src/routes/index.js`, `venues.routes.js`, or `bookings.routes.js` for admins to create/edit operating hours, manage schedule exceptions, create walk-in slot entries, or apply admin blocks. On the frontend (`web/src/app/(admin)/admin/schedule/page.js` & `ScheduleManager.js`), the UI component explicitly renders `"No schedule exceptions are available from the current backend APIs."`
* **The Exact Gap That Remains:** Missing admin HTTP endpoints (`POST/PATCH /admin/schedules`, `POST/DELETE /admin/exceptions`, `POST /admin/bookings/walk-in`, `POST /admin/bookings/block`) and missing interactive form controls in `/admin/schedule` and `/admin/bookings`.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/routes/index.js`, `server/src/modules/venues/`, `server/src/modules/bookings/`
  * Frontend: `web/src/app/(admin)/admin/schedule/`, `web/src/app/(admin)/admin/bookings/`

---

### 2.3 Notifications & Messaging (WhatsApp)

#### Item 3.1: Scheduled WhatsApp Booking Reminders (T-24h / T-2h)
* **Source Documentation Reference(s):**
  * `docs/product/02-BUSINESS-LOGIC.md` Section 8 ("Automated Notification Matrix")
  * `docs/integrations/01-WHATSAPP-INTEGRATION.md` Sections 1–3
  * `docs/audits/01-END-USER-GAP-ANALYSIS.md` Section 3 ("Scheduled WhatsApp Reminders")
* **Current Implementation Status:** Missing
* **Brief Description of Documentation Specification:** Automated WhatsApp utility reminders are scheduled to be sent 24 hours and 2 hours prior to the player's scheduled play time upon booking confirmation. An admin toggle enables/disables sending.
* **Brief Description of Codebase Reality:** `server/src/modules/auth/otp.provider.js` handles WhatsApp OTP sending, but no background task scheduler (e.g. BullMQ / pg-boss) or reminder dispatch service exists under `server/src/modules/notifications/` or `server/src/server.js`.
* **The Exact Gap That Remains:** Missing background job scheduler, T-24h/T-2h job queuing during booking confirmation, WhatsApp reminder template delivery handler, and admin toggle logic.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/notifications/`, `server/src/modules/bookings/`, `server/src/server.js`

---

#### Item 3.2: Post-Session WhatsApp Review Requests
* **Source Documentation Reference(s):**
  * `docs/product/02-BUSINESS-LOGIC.md` Section 8 ("Automated Notification Matrix")
  * `docs/integrations/01-WHATSAPP-INTEGRATION.md` Sections 1–3
  * `docs/audits/01-END-USER-GAP-ANALYSIS.md` Section 3 ("Post-Session WhatsApp Review Requests")
* **Current Implementation Status:** Missing
* **Brief Description of Documentation Specification:** After a booking session ends, the system automatically dispatches a WhatsApp notification requesting the player to review their session, containing a direct link (`/review/{bookingId}`).
* **Brief Description of Codebase Reality:** No post-session review request scheduler job or template dispatch handler exists in the codebase.
* **The Exact Gap That Remains:** Missing post-session scheduler job trigger, review request WhatsApp template delivery handler, and admin toggle.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/notifications/`, `server/src/modules/bookings/`

---

#### Item 3.3: WhatsApp Webhook Verification Handshake Endpoint
* **Source Documentation Reference(s):**
  * `docs/integrations/01-WHATSAPP-INTEGRATION.md` Section 2.4 (#6) & Section 5.3 ("Webhook Verification Handshake")
* **Current Implementation Status:** Missing
* **Brief Description of Documentation Specification:** Meta requires registering a Webhook Callback URL (`GET /api/v1/webhooks/whatsapp`) that verifies `hub.challenge` and `hub.verify_token` for initial integration activation.
* **Brief Description of Codebase Reality:** No WhatsApp webhook route (`GET` or `POST`) is registered in `server/src/routes/index.js`.
* **The Exact Gap That Remains:** Missing `GET /api/v1/webhooks/whatsapp` verification handshake handler and `WHATSAPP_WEBHOOK_VERIFY_TOKEN` validation.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/routes/index.js`, `server/src/modules/notifications/`

---

#### Item 3.4: Production WhatsApp Cloud API Credentials & Template Setup
* **Source Documentation Reference(s):**
  * `docs/product/04-FUTURE-WORK.md` Section 2 ("Pending External Setup — WhatsApp Business API")
  * `docs/integrations/01-WHATSAPP-INTEGRATION.md` Section 2.1–2.2
  * `docs/ai/03-IMPLEMENTATION-STATUS.md` Section 2.1
* **Current Implementation Status:** Unclear / Pending External Credentials
* **Brief Description of Documentation Specification:** Requires Meta Business Account verification, WABA ID, Phone Number ID, Permanent Access Token, and approved Meta templates (`otp_verification`, `booking_confirmation`, `booking_reminder`, `review_request`).
* **Brief Description of Codebase Reality:** `server/src/modules/auth/otp.provider.js` contains a basic Meta Graph API fetch for OTP in `production` mode. However, non-OTP template dispatchers do not exist in `server/src/modules/notifications/`. Whether Meta production credentials have been provisioned in the live deployment environment cannot be verified from the codebase alone.
* **The Exact Gap That Remains:** Environment variable population in production deploy environment and creation of template dispatch services for booking confirmation, reminders, and review requests.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/auth/otp.provider.js`, `server/src/modules/notifications/`

---

### 2.4 Promotions, Coupons & Dynamic Pricing

#### Item 4.1: Admin Coupon Management REST API & Frontend UI
* **Source Documentation Reference(s):**
  * `docs/product/02-BUSINESS-LOGIC.md` Section 6 ("Coupons & Dynamic Pricing")
  * `docs/product/03-UI-UX-SPECIFICATION.md` Section 7 ("Pricing Manager — Manage coupons")
  * `docs/specs/02-API-SPECIFICATION.md` Section 11 (`POST /venues/:id/coupons`, `GET /venues/:id/coupons`, `PATCH /coupons/:id`)
  * `docs/ai/03-IMPLEMENTATION-STATUS.md` Section 2.8 ("Admin Coupon Management API — Planned")
* **Current Implementation Status:** Partial
* **Brief Description of Documentation Specification:** Full HTTP REST endpoints allow admins with `edit_pricing` permission to create, list, edit, and deactivate coupons. The admin pricing panel (`/admin/pricing`) provides UI controls to manage promo codes.
* **Brief Description of Codebase Reality:** Discount evaluation logic exists (`booking-pricing.service.js`), and a CLI script exists (`server/scripts/create-promo-code.mjs`). However, no REST API endpoints for coupon CRUD exist in `server/src/modules/venues/` or elsewhere, and no coupon management interface exists in `web/src/app/(admin)/admin/pricing/`.
* **The Exact Gap That Remains:** Missing HTTP REST endpoints (`POST/GET /venues/:id/coupons`, `PATCH /coupons/:id`) and missing frontend coupon management panel in `/admin/pricing`.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/venues/`
  * Frontend: `web/src/app/(admin)/admin/pricing/`

---

#### Item 4.2: Admin Dynamic Pricing Rules REST API & Frontend UI
* **Source Documentation Reference(s):**
  * `docs/product/02-BUSINESS-LOGIC.md` Section 6.1 ("Dynamic Pricing Rules")
  * `docs/product/03-UI-UX-SPECIFICATION.md` Section 7 ("Pricing Manager — Dynamic pricing rules")
  * `docs/specs/02-API-SPECIFICATION.md` Section 11 (`GET/POST /admin/venues/:id/pricing-rules`, `PATCH /admin/pricing-rules/:id`)
* **Current Implementation Status:** Missing
* **Brief Description of Documentation Specification:** Admins can configure peak/off-peak hourly pricing rules, day-of-week multipliers, and court-specific surcharges via REST APIs (`/admin/venues/:id/pricing-rules`) and the Pricing Manager UI.
* **Brief Description of Codebase Reality:** Pricing calculation functions exist in `booking-pricing.service.js`, but no REST APIs exist for admins to create, edit, or deactivate dynamic pricing rules. In `web/src/app/(admin)/admin/pricing/page.js` (`PricingManager.js`), the UI component explicitly renders `"No pricing rules are available from the current backend APIs."`
* **The Exact Gap That Remains:** Missing REST endpoints (`GET/POST /admin/venues/:id/pricing-rules`, `PATCH /admin/pricing-rules/:id`) and missing interactive pricing rule controls in `/admin/pricing`.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/venues/`
  * Frontend: `web/src/app/(admin)/admin/pricing/`

---

#### Item 4.3: Coupon Usage Tracking & Limit Enforcement (`coupon_usages`)
* **Source Documentation Reference(s):**
  * `docs/product/02-BUSINESS-LOGIC.md` Section 6.2 ("Usage Limits")
  * `docs/specs/01-DATABASE-SCHEMA.md` Domain C (`coupon_usages` table)
  * `docs/ai/03-IMPLEMENTATION-STATUS.md` Section 2.8 ("Usage Enforcement — Planned")
* **Current Implementation Status:** Partial
* **Brief Description of Documentation Specification:** System records every coupon redemption in `coupon_usages` (`coupon_id, phone, booking_id, used_at`) upon booking confirmation, and enforces `max_uses_total` and `max_uses_per_phone` caps.
* **Brief Description of Codebase Reality:** The `coupon_usages` table is defined in `server/prisma/schema.prisma`. However, `booking-pricing.service.js` only checks active status and date validity windows. It does NOT record entries in `coupon_usages` during booking confirmation, nor does it check `coupon_usages` counts against `max_uses_total` or `max_uses_per_phone`.
* **The Exact Gap That Remains:** Recording rows in `coupon_usages` inside booking confirmation transactions and checking usage counts during quote calculation.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/bookings/`, `server/src/modules/venues/`

---

### 2.5 Customer Profile & Support Infrastructure

#### Item 5.1: Customer Self-Service Profile Update API (`PATCH /users/me`)
* **Source Documentation Reference(s):**
  * `docs/specs/02-API-SPECIFICATION.md` Section 4 (`PATCH /users/me`)
* **Current Implementation Status:** Missing
* **Brief Description of Documentation Specification:** Authenticated customers can update their name and profile information via `PATCH /users/me`.
* **Brief Description of Codebase Reality:** `server/src/modules/users/users.routes.js` exposes `GET /users/me` (read profile) and `POST /onboarding` (first-time name setup), but does not implement `PATCH /users/me`.
* **The Exact Gap That Remains:** Missing `PATCH /users/me` backend route, controller, and service logic for updating customer profile details after onboarding.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/users/users.routes.js`, `server/src/modules/users/users.controller.js`, `server/src/modules/users/users.service.js`

---

#### Item 5.2: Support Form Submission Delivery Endpoint
* **Source Documentation Reference(s):**
  * `docs/product/03-UI-UX-SPECIFICATION.md` Section 2.8 ("Contact Form")
  * `docs/audits/01-END-USER-GAP-ANALYSIS.md` Section 4 ("Support Form Submission Delivery")
* **Current Implementation Status:** Partial / Mock Only
* **Brief Description of Documentation Specification:** The support page `/support` provides a contact form for name, email, and message. Submitting transmits data to a backend endpoint or email delivery service.
* **Brief Description of Codebase Reality:** `web/src/components/features/support/SupportClient.js` exists, but line 66 invokes a mock handler returning `"Support form delivery is not configured yet. Please use the listed phone or email contact."` No support ticket endpoint or mailer integration exists in `server/`.
* **The Exact Gap That Remains:** Missing backend support ticket endpoint (or mailer integration) and frontend wiring to submit to the backend API.
* **Dependent Files / Modules / Areas:**
  * Frontend: `web/src/components/features/support/SupportClient.js`
  * Backend: `server/src/modules/`

---

### 2.6 Admin Dashboard & Operational Screens

#### Item 6.1: Admin Overview Dashboard Real Data API
* **Source Documentation Reference(s):**
  * `docs/product/03-UI-UX-SPECIFICATION.md` Section 7 ("Overview / Home")
  * `docs/plans/web-modernization/03-issues-register.md` ME-3 ("`getAdminOverview` is hardcoded mock data")
  * `docs/plans/web-modernization/04-api-server-action-service-review.md` Section 6
* **Current Implementation Status:** Partial / Mock
* **Brief Description of Documentation Specification:** Displays live court slot grid for today, pending bookings count, today's revenue, and operational metrics.
* **Brief Description of Codebase Reality:** `web/src/app/(admin)/admin/overview/page.js` exists, but imports from `lib/api.js:48-65`, which returns hardcoded mock stats behind a `// TODO`.
* **The Exact Gap That Remains:** Real backend dashboard overview API endpoint (`GET /admin/overview` or `GET /venues/:id/dashboard`) and wiring frontend to consume real data.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/venues/` (or new admin dashboard service)
  * Frontend: `web/src/app/(admin)/admin/overview/`

---

#### Item 6.2: Admin User Lookup & Customer Booking History API
* **Source Documentation Reference(s):**
  * `docs/product/03-UI-UX-SPECIFICATION.md` Section 7 ("Users")
  * `docs/specs/02-API-SPECIFICATION.md` Section 11 (`GET /admin/users`)
* **Current Implementation Status:** Partial / Missing
* **Brief Description of Documentation Specification:** Admins can look up customers by phone number, view their booking history, wallet balance, and reward instance history.
* **Brief Description of Codebase Reality:** `server/src/modules/users/` implements `GET /users/me` for the caller, but no `GET /admin/users` search endpoint exists. The `/admin/users` frontend route lacks backend data integration.
* **The Exact Gap That Remains:** Backend admin customer search/detail API and frontend admin customer lookup page.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/users/`
  * Frontend: `web/src/app/(admin)/admin/users/`

---

#### Item 6.3: Admin Venue Settings Manager
* **Source Documentation Reference(s):**
  * `docs/product/03-UI-UX-SPECIFICATION.md` Section 7 ("Settings")
  * `docs/specs/02-API-SPECIFICATION.md` Section 11 (`PATCH /venues/:id`)
* **Current Implementation Status:** Partial / Missing
* **Brief Description of Documentation Specification:** Manage facility settings including rollover time, advance booking window, tax rate, and facility contact info via `PATCH /venues/:id` guarded by `manage_venues` permission.
* **Brief Description of Codebase Reality:** `venues` table schema contains these fields, but `server/src/modules/venues/venues.routes.js` only exposes GET routes. The frontend `/admin/settings` page cannot persist updates.
* **The Exact Gap That Remains:** Missing `PATCH /venues/:id` backend route and frontend form update handler.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/venues/`
  * Frontend: `web/src/app/(admin)/admin/settings/`

---

#### Item 6.4: Admin Court Details & Status Management API
* **Source Documentation Reference(s):**
  * `docs/product/03-UI-UX-SPECIFICATION.md` Section 7 ("Courts — Edit court details, status (active/maintenance/offline), cover images")
* **Current Implementation Status:** Missing
* **Brief Description of Documentation Specification:** Admins can update court names, surface types, cover images, and operational status (`active`, `maintenance`, `offline`).
* **Brief Description of Codebase Reality:** `server/src/modules/venues/venues.routes.js` provides read-only court data. No REST API endpoint exists for editing court details or status. On the frontend (`web/src/app/(admin)/admin/courts/page.js` & `CourtsManager.js`), court status editing is not connected to a backend persistence endpoint.
* **The Exact Gap That Remains:** Missing backend API (`PATCH /venues/:id/courts/:courtId` or `PATCH /courts/:id`) and frontend form update wiring.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/venues/`
  * Frontend: `web/src/app/(admin)/admin/courts/`

---

#### Item 6.5: Admin Force-Cancellation & Credit Issuance Endpoint
* **Source Documentation Reference(s):**
  * `docs/product/02-BUSINESS-LOGIC.md` Section 7 ("Cancellations & Wallet Credits")
  * `docs/product/03-UI-UX-SPECIFICATION.md` Section 7 ("Bookings — initiate force-cancellation + credit issuance")
  * `docs/specs/02-API-SPECIFICATION.md` Section 11 (`POST /bookings/:id/cancel`)
* **Current Implementation Status:** Partial / Missing
* **Brief Description of Documentation Specification:** Admins with `issue_credits` or `manage_bookings` permission can force-cancel a booking and issue full or partial wallet credits to the user's account.
* **Brief Description of Codebase Reality:** `users.service.js` has low-level wallet credit adjustment logic, but no `POST /bookings/:id/cancel` admin cancellation endpoint exists in `server/src/modules/bookings/bookings.routes.js`.
* **The Exact Gap That Remains:** Missing `POST /bookings/:id/cancel` endpoint and admin UI cancellation action button.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/bookings/`
  * Frontend: `web/src/app/(admin)/admin/bookings/`

---

### 2.7 Payments & Settlement Operations

#### Item 7.1: Nightly Settlement Reconciliation Job
* **Source Documentation Reference(s):**
  * `docs/integrations/02-PAYMENT-INTEGRATION.md` Section 11.2 ("Daily Reconciliation")
* **Current Implementation Status:** Missing
* **Brief Description of Documentation Specification:** A daily background job running after midnight downloads/ingests PhonePe settlement reports, cross-references transaction IDs against successful payments, and flags settlement discrepancies to admins.
* **Brief Description of Codebase Reality:** `server/src/modules/payments/reconciliation.service.js` implements the 15-minute missing webhook recovery sweep (`reconcileStalePayments`). However, no nightly settlement report ingestion or transaction matching job exists.
* **The Exact Gap That Remains:** Missing nightly settlement report fetch/parsing job, transaction matching service, and admin discrepancy notification/flagging mechanism.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/modules/payments/reconciliation.service.js`, `server/src/core/scheduler.js`

---

### 2.8 Media Storage & Photo Uploads

#### Item 8.1: Cloudflare R2 Integration for Court & Review Photos
* **Source Documentation Reference(s):**
  * `docs/product/01-PROJECT-OVERVIEW.md` Section 4.4
  * `docs/product/04-FUTURE-WORK.md` Section 2 ("Cloudflare R2 credentials and storage provider implementation")
  * `docs/ai/03-IMPLEMENTATION-STATUS.md` Section 2.6 ("Photo Uploads — Deferred")
* **Current Implementation Status:** Missing / Deferred
* **Brief Description of Documentation Specification:** Integration with Cloudflare R2 object storage to upload and serve court cover images and review attachment photos (`photo_url`).
* **Brief Description of Codebase Reality:** The `photo_url` column exists in PostgreSQL schema tables (`reviews` and `courts`). However, no R2 storage client or file upload endpoint exists in `server/`.
* **The Exact Gap That Remains:** Cloudflare R2 client module in `server/src/lib/` and file upload/presigned URL endpoints.
* **Dependent Files / Modules / Areas:**
  * Backend: `server/src/lib/`, `server/src/modules/reviews/`, `server/src/modules/venues/`

---

### 2.9 Rewards & Gamification (Spinner Wheel)

#### Item 9.1: Spinner Wheel Frontend Component
* **Source Documentation Reference(s):**
  * `docs/product/02-BUSINESS-LOGIC.md` Section 12.7 ("Switch to spinner")
  * `docs/adrs/ADR-010-rewards-module.md`
  * `docs/ai/03-IMPLEMENTATION-STATUS.md` Section 2.7 ("Spinner Wheel UI — Deferred")
* **Current Implementation Status:** Missing / Deferred
* **Brief Description of Documentation Specification:** Backend fully supports `type: "spinner"` mechanisms end-to-end; UI specification allows spinner wheel experiences.
* **Brief Description of Codebase Reality:** `server/src/modules/rewards/` supports both `scratch_card` and `spinner` mechanism types. However, `web/src/components/features/rewards/` exclusively implements `scratch_card` (`RewardExperience.js`, `RewardReveal.js`). No spinner wheel canvas/animation component exists.
* **The Exact Gap That Remains:** Missing frontend interactive Spinner Wheel UI component in `web/src/components/features/rewards/`.
* **Dependent Files / Modules / Areas:**
  * Frontend: `web/src/components/features/rewards/`

---

### 2.10 Developer & Testing Infrastructure

#### Item 10.1: Web Modernization Tooling & Testing Scaffolding (Phases 6–7)
* **Source Documentation Reference(s):**
  * `docs/plans/web-modernization/README.md` Section Status ("Phases 6–7 deferred")
  * `docs/plans/web-modernization/06-implementation-plan.md` Phases 6–7
* **Current Implementation Status:** Partial / Deferred
* **Brief Description of Documentation Specification:** Phases 6–7 of the web modernization plan specify setting up Prettier, Husky, lint-staged, a `tsc --noEmit` type-check gate script, Playwright E2E test suite, and GitHub Actions CI workflow files.
* **Brief Description of Codebase Reality:** `web/package.json` includes ESLint and native `node:test` unit test scripts. However, no `.prettierrc`, no Husky hooks, no `playwright.config.js`, and no GitHub Actions `.github/workflows/` files exist in the repository.
* **The Exact Gap That Remains:** Missing Prettier/Husky/lint-staged configuration, Playwright E2E suite, `tsc` typecheck script, and CI pipeline definition.
* **Dependent Files / Modules / Areas:**
  * Workspace Root & Web: `web/package.json`, `.github/workflows/`

---

## 3. Final Verification

A final, independent, multi-directional verification pass was conducted across the entire codebase (`server/` and `web/`) and all 47 documentation files in `docs/`:

* **Number of previously reported items re-verified:** 24 items (Items 1.1 through 10.1).
* **Number of new findings discovered during this pass:** 0 new findings. The inventory of 24 items represents the complete, exhaustive set of missing, partially implemented, deferred, or unclear requirements documented in the repository.
* **Number of corrected or removed findings:** 0 false positives. Every single reported item has been verified against backend route handlers (`server/src/routes/index.js`, controllers, services, repositories) and frontend page components (`web/src/app/`, `components/`, `lib/dal/`).
* **Confirmation of Complete Verification:** We confirm that every documented requirement across all product specifications (`01-PROJECT-OVERVIEW`, `02-BUSINESS-LOGIC`, `03-UI-UX-SPECIFICATION`, `04-FUTURE-WORK`), technical specifications (`01-DATABASE-SCHEMA`, `02-API-SPECIFICATION`), integrations (`01-WHATSAPP`, `02-PAYMENT`, `03-WEBHOOK-LOCAL-DEV`), operations, ADRs (ADR-001 through ADR-010), AI context files, web modernization plans, prompts, and READMEs has been exhaustively checked against the live implementation. No undocumented features, assumptions, recommendations, or best-practice suggestions have been introduced.
