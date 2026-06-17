# 03-IMPLEMENTATION-STATUS

This document tracks the actual implementation status of all features defined in the product specifications.

## 1. Feature Status Summary

| Feature Module | Status | Target Specification | Mapped Directory |
|---|---|---|---|
| Customer Auth (OTP) | **Built** | `02-BUSINESS-LOGIC.md` | `server/src/modules/auth` |
| Edge Route Proxy | **Built** | `03-UI-UX-SPECIFICATION.md` | `web/proxy.js` |
| Customer Profiles | **Built** | `02-BUSINESS-LOGIC.md` | `server/src/modules/users` |
| Staff Auth (Credentials) | **Built** | `02-BUSINESS-LOGIC.md` | `server/src/modules/auth` |
| Scheduling & Hours | **Planned** | `02-BUSINESS-LOGIC.md` | `server/src/modules/scheduling` |
| Slot Locking Engine | **Planned** | `02-BUSINESS-LOGIC.md` | `server/src/modules/bookings` |
| PhonePe Payments | **Planned** | `02-PAYMENT-INTEGRATION.md` | `server/src/modules/payments` |
| Wallet Transaction Logic | **Partial** | `02-BUSINESS-LOGIC.md` | `server/src/modules/users` |
| Reviews Submission | **Planned** | `01-PROJECT-OVERVIEW.md` | `server/src/modules/reviews` |
| Reward Scratch Cards | **Deferred** | `01-PROJECT-OVERVIEW.md` | `server/src/modules/rewards` |

---

## 2. Detailed Implementation Checklists

### 2.1 Customer Authentication & Onboarding (Built)
- [x] WhatsApp OTP Generation (`server/src/modules/auth`)
- [x] OTP Rate Limiting & Expiry (`server/src/modules/auth/otp.provider.js`)
- [x] Customer Profile Creation (`server/src/modules/users`)
- [x] In-Context Auth Modal Flow (`web/src/components/features/auth`)
- [x] Dedicated Login Page (`web/src/app/(auth)/login`)
- [x] Dedicated Onboarding Page (`web/src/app/(auth)/onboarding`)
- [x] Silent Session Refresh & Proxy (`web/src/proxy.js`, `web/src/lib/proxy-core.js`)

### 2.2 Staff Authentication & Management (Partial)
- [x] Email + Password Credentials (`server/src/modules/auth`)
- [x] Account Lockout (10 failed attempts) (`server/src/modules/auth/auth.service.js`)
- [ ] Staff Account Provisioning API & Email Activation (*Planned*)
- [ ] Password Reset Email Flow (*Planned*)
- [ ] Admin Portal Staff Management Panel (*Planned*)

### 2.3 Booking & Scheduling Engine (Planned)
- [ ] Operating Hours Schedule Manager (*Planned*)
- [ ] Schedule Overrides & Overlaps Exception Handler (*Planned*)
- [ ] Active Availability Slot Grid API (*Planned*)
- [ ] Atomic Lock Hold API (`/bookings/hold` via `SELECT ... FOR UPDATE`) (*Planned*)
- [ ] Background Slot Expiry Sweeper Job (*Planned*)
- [ ] Frontend Booking Slot Selection Interface (*Planned*)

### 2.4 Payments & Webhooks (Planned)
- [ ] PhonePe Gateway API Integration (*Planned*)
- [ ] Redirection and Status Polling Hooks (*Planned*)
- [ ] Webhook Deduplication & Signature verification (*Planned*)

### 2.5 Wallet & Cancellations (Partial)
- [x] Wallet Balance database mappings (`User.walletCredits`)
- [ ] Cancellation Credit Issuance workflow (*Planned*)

### 2.6 Review & Rewards (Planned / Deferred)
- [ ] Star Review rating API and UI submission (*Planned*)
- [ ] Reward Mechanism config & pre-calculated Reward Instances (*Planned*)
- [ ] Scratch Card Canvas interaction and Reveal API (*Planned*)
- [ ] Spinner Wheel interface (*Deferred*)
