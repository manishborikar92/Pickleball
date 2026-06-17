# AI Project Context — Active Issues

This document tracks active runtime bugs, test failures, or integration errors in the Pickleball Booking Platform codebase.

---

## 1. Active Issues Log

### 1.1 OTP Sandbox Limitation
* **Description**: The customer auth endpoints `/auth/otp/send` and `/auth/otp/verify` operate strictly in `sandbox` mode because WhatsApp template approvals are pending.
* **Symptom**: Mobile verification does not dispatch WhatsApp messages. Verification succeeds only by entering the hardcoded sandbox OTP code `123456`.
* **Resolution Path**: Shift `OTP_MODE=production` once Meta developers templates are verified on the live merchant portal.

### 1.2 Onboarding Database Persistence Gaps
* **Description**: User onboarding endpoint `/auth/onboarding` successfully updates the user's name but does not auto-assign role mappings (`VenueUserRole`) due to the absence of an operational venue selector on the onboarding screen.
* **Symptom**: User rows are created without associated roles in `venue_user_roles`.
* **Resolution Path**: Extend onboarding to resolve the active `venue_id` context and assign the default `customer` role to the user.
