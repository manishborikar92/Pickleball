# Pickleball Platform — API Specification

All endpoints are served under `/api/v1`. The backend is the single authority on pricing, availability, and booking state. The frontend never bypasses or replicates this logic.

> **Implementation status:** the live backend currently implements Root, Authentication, Onboarding, User Profile, Booking, Venue/Availability, Payment/Refund, and Review (Section 9) routes. Admin operations (Section 11) and Reward operations (Section 12) in this document remain target product contracts to be implemented on top of the completed schema.

---

## 1. Authentication & Headers

### Auth Scheme

| Header | Required On | Value |
|---|---|---|
| `Authorization` | Protected routes | `Bearer <access_token>` |
| `Content-Type` | POST/PATCH/PUT | `application/json` |

### Token Lifecycle

- Access tokens are short-lived JWTs sent as `Authorization: Bearer <access_token>` on protected API calls.
- Refresh tokens are opaque, rotating values stored in HTTP-only cookies under `pb_refresh_token`.
- Refresh tokens are stored only as hashes in PostgreSQL.
- `POST /auth/refresh` rotates the refresh token and returns a new access token.
- `POST /auth/logout` revokes the current browser/device session.
- `POST /auth/logout-all` revokes all active sessions for the authenticated user.

> PostgreSQL-backed sessions supersede the earlier 24-hour access-token-only approach. Redis remains a future scaling option, not the primary launch revocation mechanism.

### Permission Guards

All protected routes use a `requirePermission('capability_key')` middleware that resolves the requesting user's role at the current venue via `venue_user_roles`, then checks `role_permissions` for the required capability.

### Permission Errors

| Status | Meaning |
|---|---|
| `401 Unauthorized` | Missing or invalid token |
| `403 Forbidden` | Valid token but the user's role does not have the required permission |

---

## 2. Auth Endpoints

### `POST /auth/otp/send`

Sends an OTP to the provided phone number via WhatsApp. Rate-limited per phone.

**Body:**
```json
{ "phone": "+919876543210" }
```

**Response `200`:**
```json
{
  "success": true,
  "message": "OTP sent",
  "data": {
    "phone": "+919876543210",
    "expires_in_seconds": 300,
    "sandbox_otp": "123456"
  }
}
```
*Note: `sandbox_otp` is only returned in sandbox/development mode.*

**Errors:** `429 Too Many Requests` if rate limit exceeded.

---

### `POST /auth/otp/verify`

Verifies the OTP, creates an auth session, sets the refresh-token cookie, and returns an access token. Creates the `users` record if this phone has never been verified before. Returns a `next_step` field that tells the frontend exactly where to navigate — the frontend should not compute this routing logic independently.

**Body:**
```json
{ "phone": "+919876543210", "otp": "482931" }
```

**Response `200`:**
```json
{
  "success": true,
  "message": "OTP verified",
  "data": {
    "access_token": "<jwt>",
    "expires_in": 3600,
    "user": {
      "id": "<uuid>",
      "phone": "+919876543210",
      "name": null,
      "is_new_user": true,
      "onboarding_complete": false
    },
    "next_step": "complete_onboarding"
  }
}
```

**Cookie:** `Set-Cookie: pb_refresh_token=<opaque-token>; HttpOnly; SameSite=Lax; Path=/api/v1/auth`

**`next_step` values:**

| Value | Meaning | Frontend action |
|---|---|---|
| `complete_onboarding` | New user; `name` is null | Show name collection screen |
| `resume_booking` | Returning user; name is set | Proceed to `POST /bookings/hold` |
| `admin_dashboard` | User has a non-customer role | Redirect to `/admin` |

> `admin_dashboard` takes priority over `complete_onboarding`. If an admin account somehow has no name set, `next_step` is `complete_onboarding` — name collection is required before admin dashboard access.

**Errors:** `400` invalid OTP, `410` OTP expired, `429` too many attempts.

---

### `POST /auth/onboarding`

*Protected (requires JWT; does NOT require onboarding to be complete).* Collects the user's name and marks onboarding as done. Idempotent — calling it again updates the name.

**Body:**
```json
{ "name": "Arjun Mehta" }
```

**Validation:** Name must be 2–100 characters, non-empty after trimming.

**Response `200`:**
```json
{
  "success": true,
  "message": "Onboarding complete",
  "data": {
    "user": {
      "id": "<uuid>",
      "phone": "+919876543210",
      "name": "Arjun Mehta",
      "onboarding_complete": true
    },
    "next_step": "resume_booking"
  }
}
```

**Errors:** `400 INVALID_NAME` if name fails validation.

---

## 3. Admin Auth Endpoints

These endpoints serve non-customer roles (`super_admin`, `manager`, `staff`) only. They use email + password credentials managed in the `admin_credentials` table. WhatsApp OTP is never involved.

### `POST /auth/admin/login`

*Public.* Authenticates an admin user with email and password.

**Body:**
```json
{ "email": "manager@besanagpur.com", "password": "SecurePass123!" }
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Admin login successful",
  "data": {
    "access_token": "<jwt>",
    "expires_in": 3600,
    "user": {
      "id": "<uuid>",
      "email": "manager@besanagpur.com",
      "name": "Ravi Kumar",
      "roles": ["manager"],
      "permissions": ["edit_schedule", "edit_pricing", "manage_bookings", "issue_credits"]
    },
    "next_step": "admin_dashboard"
  }
}
```

**`next_step` values:** `admin_dashboard` (normal) or `force_password_change` (admin forced a reset).

**Errors:**

| Code | HTTP Status | Description |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Email not found or password incorrect (intentionally vague) |
| `ACCOUNT_SUSPENDED` | 403 | Account is suspended by an admin |
| `ACCOUNT_LOCKED` | 423 | Too many failed attempts; includes `locked_until` in response body |
| `ACCOUNT_NOT_ACTIVATED` | 403 | Activation email not yet completed |

**Security:** Failed attempts are tracked per `admin_credentials` row. After 10 failures the account is locked for 30 minutes. Rate limiting (5 attempts per IP per 15 minutes) is applied at the middleware layer.

---

### `POST /auth/admin/activate`

> [!WARNING]
> **Implementation Status: Planned API Contract / Not Yet Implemented**
> This endpoint is a planned future contract for the administrator onboarding lifecycle. It is not currently implemented in the live backend.
> **Dependency:** Requires configuration of the production email provider and integration with the admin-management/invitation slice before it can be exposed.

*Public (activation token acts as credential).* Sets the initial password for a newly provisioned admin account.

**Body:**
```json
{
  "token": "<raw-activation-token-from-email>",
  "password": "MyNewSecurePass1!",
  "password_confirm": "MyNewSecurePass1!"
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "access_token": "<jwt>",
    "user": { "id": "<uuid>", "name": "Ravi Kumar", "email": "manager@besanagpur.com" },
    "next_step": "admin_dashboard"
  }
}
```

**Errors:** `400 INVALID_ACTIVATION_TOKEN` (token wrong or expired), `400 PASSWORD_MISMATCH`, `400 PASSWORD_TOO_WEAK`.

---

### `POST /auth/admin/reset-password/request`

> [!WARNING]
> **Implementation Status: Planned API Contract / Not Yet Implemented**
> This endpoint is a planned future contract for admin self-service password recovery. It is not currently implemented in the live backend.
> **Dependency:** Requires configuration of the production email provider to dispatch password reset tokens.

*Public.* Requests a password reset email. Always returns `200` regardless of whether the email is found (prevents account enumeration).

**Body:**
```json
{ "email": "manager@besanagpur.com" }
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "message": "If that email is associated with an admin account, a reset link has been sent."
  }
}
```

---

### `POST /auth/admin/reset-password/confirm`

> [!WARNING]
> **Implementation Status: Planned API Contract / Not Yet Implemented**
> This endpoint is a planned future contract for completing admin self-service password recovery. It is not currently implemented in the live backend.
> **Dependency:** Requires configuration of the production email provider to generate and verify password reset tokens.

*Public (reset token acts as credential).* Sets a new password using a valid reset token.

**Body:**
```json
{
  "token": "<raw-reset-token-from-email>",
  "password": "NewSecurePass1!",
  "password_confirm": "NewSecurePass1!"
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "access_token": "<jwt>",
    "user": { "id": "<uuid>", "name": "Ravi Kumar" },
    "next_step": "admin_dashboard"
  }
}
```

**Errors:** `400 INVALID_RESET_TOKEN` (token wrong or expired after 1 hour), `400 PASSWORD_MISMATCH`, `400 PASSWORD_TOO_WEAK`.

---

### `POST /auth/admin/change-password`

> [!WARNING]
> **Implementation Status: Planned API Contract / Not Yet Implemented**
> This endpoint is a planned future contract for admin credential updates (including forced password changes). It is not currently implemented in the live backend.
> **Dependency:** Bypassed in the current phase as seed administrators are set directly to `active` status. Will be implemented when self-serve admin settings are introduced.

*Protected (JWT + admin session).* Allows a logged-in admin user to change their own password. Required when `next_step = "force_password_change"`.

**Body:**
```json
{
  "current_password": "OldPass123!",
  "new_password": "NewPass456!",
  "new_password_confirm": "NewPass456!"
}
```

**Response `200`:** Updated user object inside success envelope. Clears `force_password_change` flag.

**Errors:** `400 INVALID_CURRENT_PASSWORD`, `400 PASSWORD_MISMATCH`, `400 PASSWORD_TOO_WEAK`.

---

### `POST /auth/logout`

*Refresh-cookie authenticated.* Revokes the current auth session and active refresh token. The response clears the refresh cookie. Missing or already-revoked refresh tokens are treated idempotently.

**Response `200`:**
```json
{
  "success": true,
  "message": "Logged out",
  "data": { "logged_out": true }
}
```

---

### `POST /auth/refresh`

*Refresh-cookie authenticated.* Rotates the current refresh token, returns a new access token, and sets the next refresh-token cookie. Reuse of a revoked refresh token revokes the session and returns `401`. Concurrent requests inside a grace window (10 seconds) of a normally rotated token return a new access token without rotating the refresh token or writing cookies.

**Response `200`:**
```json
{
  "success": true,
  "message": "Session refreshed",
  "data": {
    "access_token": "<jwt>",
    "expires_in": 3600,
    "user": {
      "id": "<uuid>",
      "phone": "+919876543210",
      "name": "Arjun Mehta",
      "is_new_user": false,
      "onboarding_complete": true
    }
  }
}
```

---

### `POST /auth/logout-all`

*Protected.* Revokes every active session for the authenticated user.

**Response `200`:**
```json
{
  "success": true,
  "message": "All sessions logged out",
  "data": { "logged_out_all": true }
}
```

---

## 4. User Endpoints

### `GET /users/me`

*Protected (JWT only; does NOT require onboarding complete).* Returns the authenticated user's full profile. The frontend calls this on app load to determine auth state and onboarding state without re-running OTP.

**Response `200`:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "<uuid>",
    "phone": "+919876543210",
    "name": "Arjun Mehta",
    "onboarding_complete": true,
    "roles": [
      { "venue_id": "<uuid>", "venue_name": "Besa, Nagpur", "role": "customer" }
    ],
    "permissions": ["view_own_bookings"]
  }
}
```

`onboarding_complete` is computed as `name IS NOT NULL`. `roles` shows the user's venue assignments — an empty array means customer-only access.

**If `name` is `null`** (OTP verified but onboarding not finished):
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "<uuid>",
    "phone": "+919876543210",
    "name": null,
    "onboarding_complete": false,
    "roles": [],
    "permissions": ["view_own_bookings"]
  }
}
```

The frontend uses this response on app load to decide whether to show the name collection screen before any booking action.

---

### `PATCH /users/me`

> [!WARNING]
> **Implementation Status: Planned API Contract / Not Yet Implemented**
> This endpoint is a planned future contract for self-service customer profile updates (e.g. updating the user's name). It is not currently implemented in the live backend.
> **Dependency:** Currently, name submission is handled once during registration/onboarding via `POST /auth/onboarding`. Full self-service profile modification is deferred until a profile/settings page is added to the customer web application.

*Protected (JWT + onboarding complete).* Update name after onboarding is done. For initial name collection during onboarding, use `POST /auth/onboarding` instead.

**Body:**
```json
{ "name": "Arjun Mehta" }
```

**Response `200`:** Updated user object.

---

### `GET /users/me/bookings`

*Protected.* Returns all bookings for the authenticated user.

**Query params:** `status` (confirmed, completed, expired, cancelled), `page`, `limit`.

**Response `200`:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "data": [
      {
        "id": "<uuid>",
        "court_names": ["Court 1", "Court 2"],
        "venue": { "id": "<uuid>", "name": "Besa, Nagpur", "slug": "besa-nagpur" },
        "slot_date": "2025-05-17",
        "slot_start_time": "09:00",
        "slot_end_time": "10:00",
        "status": "confirmed",
        "total_amount": 590.00,
        "has_review": false
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 5 }
  }
}
```

---

### `GET /users/me/wallet`

*Protected.* Returns wallet balance and transaction history.

**Response `200`:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "balance": 500.00,
    "transactions": [
      {
        "id": "<uuid>",
        "type": "credit_issued",
        "amount": 500.00,
        "balance_after": 500.00,
        "reason": "Force majeure cancellation — Court 1",
        "created_at": "2025-05-10T14:30:00Z"
      }
    ]
  }
}
```

---

## 5. Venue & Court Endpoints

### `GET /venues/slug/:slug`

*Public.* Returns venue details by its URL-friendly slug.

**Response `200`:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "<uuid>",
    "name": "Besa, Nagpur",
    "slug": "besa-nagpur",
    "address": "Baseline Arena, Plot No. 78, Sanskriti Society, Behind Puma Outlet, Besa–Manish Nagar Road, Nagpur",
    "city": "Nagpur",
    "timezone": "Asia/Kolkata",
    "advance_booking_days": 7,
    "rollover_time": "08:00",
    "phone": "+91 99704 09410",
    "courts": [
      { "id": "<uuid>", "name": "Court 1", "environment": "Indoor", "status": "active" },
      { "id": "<uuid>", "name": "Court 2", "environment": "Indoor", "status": "active" }
    ]
  }
}
```

---

### `GET /venues/:venueId`

*Public.* Returns venue details.

**Response `200`:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "<uuid>",
    "name": "Besa, Nagpur",
    "address": "Baseline Arena, Plot No. 78, Sanskriti Society, Behind Puma Outlet, Besa–Manish Nagar Road, Nagpur",
    "city": "Nagpur",
    "timezone": "Asia/Kolkata",
    "advance_booking_days": 7,
    "rollover_time": "08:00",
    "phone": "+91 99704 09410",
    "courts": [
      { "id": "<uuid>", "name": "Court 1", "environment": "Indoor", "status": "active" },
      { "id": "<uuid>", "name": "Court 2", "environment": "Indoor", "status": "active" }
    ]
  }
}
```

---

## 6. Scheduling & Availability Endpoints

### `GET /venues/:venueId/availability`

*Public.* Returns available slot arrays for all courts on a given date. The frontend uses this to render the per-court slot grids. Users can select multiple courts and multiple consecutive slots from this response — the selection is accumulated client-side and submitted as a batch to `/bookings/hold`.

**Query params:** `date` (YYYY-MM-DD, required).

**Response `200`:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "date": "2025-05-17",
    "slot_duration_mins": 60,
    "courts": [
      {
        "court_id": "<uuid>",
        "court_name": "Court 1",
        "environment": "Indoor",
        "slots": [
          { "start_time": "08:00", "end_time": "09:00", "status": "available", "unit_price": 500.00 },
          { "start_time": "09:00", "end_time": "10:00", "status": "booked" },
          { "start_time": "10:00", "end_time": "11:00", "status": "available", "unit_price": 600.00 },
          { "start_time": "11:00", "end_time": "12:00", "status": "available", "unit_price": 600.00 }
        ]
      },
      {
        "court_id": "<uuid>",
        "court_name": "Court 2",
        "environment": "Indoor",
        "slots": [
          { "start_time": "08:00", "end_time": "09:00", "status": "available", "unit_price": 550.00 },
          { "start_time": "09:00", "end_time": "10:00", "status": "available", "unit_price": 660.00 },
          { "start_time": "10:00", "end_time": "11:00", "status": "pending" },
          { "start_time": "11:00", "end_time": "12:00", "status": "available", "unit_price": 660.00 }
        ]
      }
    ]
  }
}
```

**`unit_price`** is the per-slot price for that specific court at that time (base + modifiers), pre-calculated. Only present when `status = 'available'`. The frontend uses these to show live price totals as selections are made, while `/bookings/price-preview` provides the authoritative server-side total before holding.

**`status` values:** `available`, `booked` (confirmed/walk-in), `pending` (locked by another user's 10-minute hold), `blocked` (admin block), `past` (slots whose start time has already passed for the same day).

**Notes:**
- Only dates within the advance booking window are returned with slot data.
- `slot_duration_mins` is included so the frontend can enforce the consecutive-slots-only selection rule.

---

## 7. Booking Endpoints

### `POST /bookings/price-preview`

*Public (session-based).* Returns a full price breakdown for a given selection without creating any database record or lock. Called by the frontend as the user adjusts court and slot selections to show live pricing.

**Body:**
```json
{
  "venue_id": "<uuid>",
  "court_ids": ["<uuid1>", "<uuid2>"],
  "slot_date": "2025-05-17",
  "slot_start_times": ["09:00", "10:00", "11:00"],
  "coupon_code": "FIRST10"
}
```
*Note: `coupon_code` is optional.*

**Response `200`:**
```json
{
  "success": true,
  "message": "Price preview calculated",
  "data": {
    "court_count": 2,
    "slot_count": 3,
    "slot_unit_count": 6,
    "session_start_time": "09:00",
    "session_end_time": "12:00",
    "session_duration_mins": 180,
    "price_breakdown": {
      "units": [
        { "court_id": "<uuid1>", "court_name": "Court 1", "slot_start_time": "09:00", "slot_end_time": "10:00", "unit_price": 600.00 },
        { "court_id": "<uuid1>", "court_name": "Court 1", "slot_start_time": "10:00", "slot_end_time": "11:00", "unit_price": 600.00 },
        { "court_id": "<uuid1>", "court_name": "Court 1", "slot_start_time": "11:00", "slot_end_time": "12:00", "unit_price": 600.00 },
        { "court_id": "<uuid2>", "court_name": "Court 2", "slot_start_time": "09:00", "slot_end_time": "10:00", "unit_price": 660.00 },
        { "court_id": "<uuid2>", "court_name": "Court 2", "slot_start_time": "10:00", "slot_end_time": "11:00", "unit_price": 660.00 },
        { "court_id": "<uuid2>", "court_name": "Court 2", "slot_start_time": "11:00", "slot_end_time": "12:00", "unit_price": 660.00 }
      ],
      "subtotal": 3780.00,
      "coupon_discount": 0.00,
      "tax": 0.00,
      "total": 3780.00
    }
  }
}
```

**Errors:** `400` if slots are non-consecutive, court_ids are invalid, or the date is outside the booking window.

---

### `POST /bookings/hold`

*Protected (requires JWT + onboarding complete via `requireOnboarding` middleware).* Validates the full selection and attempts to lock all N×M slot units atomically. All-or-nothing — if any single slot unit is taken the entire request fails. The `user_id` is taken from the JWT; no `session_id` is required.

**Body:**
```json
{
  "venue_id": "<uuid>",
  "court_ids": ["<uuid1>", "<uuid2>"],
  "slot_date": "2025-05-17",
  "slot_start_times": ["09:00", "10:00", "11:00"],
  "coupon_code": "FIRST10"
}
```
*Note: `coupon_code` is optional.*

**Pre-lock validation (before any database write):**
- All `court_ids` belong to the venue and are `status = 'active'`.
- `slot_start_times` are consecutive with no gaps (validated against venue `slot_duration_mins`).
- Each slot exists in the generated slot array for that date.
- Velocity check: session/phone holds fewer than 2 pending bookings.

**Response `201` — All units successfully locked:**
```json
{
  "success": true,
  "message": "Booking hold created",
  "data": {
    "booking_id": "<uuid>",
    "status": "pending_payment",
    "expires_at": "2025-05-17T04:19:00Z",
    "court_count": 2,
    "slot_unit_count": 6,
    "session_start_time": "09:00",
    "session_end_time": "12:00",
    "session_duration_mins": 180,
    "price_quote": {
      "units": [
        { "court_id": "<uuid1>", "court_name": "Court 1", "slot_start_time": "09:00", "slot_end_time": "10:00", "unit_price": 600.00 },
        { "court_id": "<uuid2>", "court_name": "Court 2", "slot_start_time": "09:00", "slot_end_time": "10:00", "unit_price": 660.00 }
      ],
      "subtotal": 3780.00,
      "coupon_discount": 0.00,
      "tax": 0.00,
      "total": 3780.00
    }
  }
}
```

**Response `409` — One or more units unavailable:**
```json
{
  "error": {
    "code": "SLOTS_UNAVAILABLE",
    "message": "Some of your selected slots were just taken.",
    "details": [
      { "court_id": "<uuid>", "court_name": "Court 2", "slot_start_time": "10:00" },
      { "court_id": "<uuid>", "court_name": "Court 2", "slot_start_time": "11:00" }
    ]
  }
}
```

**Errors:**
- `400 Bad Request` — non-consecutive slots, invalid court_ids, slot outside the booking window, or slot in the past (code `SLOT_IN_PAST`).
- `409 Conflict` — one or more slot units are taken (see above).
- `429 Too Many Requests` — velocity check: 2 pending bookings already held (code `HOLD_LIMIT_EXCEEDED`).

---

### `GET /bookings/:bookingId`

*Protected.* Returns full booking details. User can only access their own bookings.

**Response `200`:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "<uuid>",
    "user_id": "<uuid>",
    "status": "pending_payment",
    "court_names": ["Court 1", "Court 2"],
    "venue": {
      "id": "<uuid>",
      "name": "Besa, Nagpur",
      "slug": "besa-nagpur",
      "address": "Baseline Arena, Plot No. 78, Sanskriti Society, Behind Puma Outlet, Besa–Manish Nagar Road, Nagpur",
      "city": "Nagpur",
      "timezone": "Asia/Kolkata",
      "currency": "INR",
      "phone": "+91 99704 09410",
      "secondary_phone": null,
      "email": "manager@besanagpur.com"
    },
    "slot_date": "2025-05-17",
    "session_start_time": "09:00",
    "session_end_time": "12:00",
    "session_duration_mins": 180,
    "court_count": 2,
    "slot_unit_count": 6,
    "total_amount": 3780.00,
    "credits_applied": 0.00,
    "expires_at": "2025-05-17T04:29:00Z",
    "waiver_accepted": false,
    "waiver_accepted_at": null,
    "slots": [
      {
        "id": "<uuid>",
        "court": { "id": "<uuid1>", "name": "Court 1" },
        "slot_date": "2025-05-17",
        "slot_start_time": "09:00",
        "slot_end_time": "10:00",
        "status": "pending_payment",
        "unit_price": 600.00
      }
    ],
    "payments": []
  }
}
```

---

### `POST /bookings/:bookingId/waiver`

*Protected.* Records waiver acceptance. Both fields must be true to proceed to payment.

**Body:**
```json
{
  "time_acknowledged": true,
  "policy_accepted": true
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Waiver accepted",
  "data": {
    "waiver_accepted": true,
    "waiver_accepted_at": "2025-05-17T04:12:44Z"
  }
}
```

---

### `POST /bookings/:bookingId/initiate-payment`

*Protected.* Computes the final price quote, applies wallet credits, creates a PhonePe order, and returns the PhonePe-hosted pay page URL. The frontend uses this URL with PhonePe's JS bundle to open the pay page (iFrame or redirect mode).

**Body:**
```json
{ "use_wallet_credits": true }
```

**Response `200` — Wallet-only (no PhonePe involved):**
```json
{
  "success": true,
  "message": "Payment initiated",
  "data": {
    "type": "wallet_only",
    "booking_id": "<uuid>",
    "credits_applied": 689.50,
    "total_amount": 689.50,
    "phonepe_amount": 0,
    "booking_status": "confirmed"
  }
}
```

**Response `200` — PhonePe UPI payment required:**
```json
{
  "success": true,
  "message": "Payment initiated",
  "data": {
    "type": "phonepe",
    "merchant_order_id": "PP-abc123",
    "redirect_url": "https://mercury-uat.phonepe.com/transact/uat_v2?token=...",
    "credits_applied": 200.00,
    "phonepe_amount": 489.50,
    "total_amount": 689.50,
    "expires_at": "2025-05-17T04:29:00Z",
    "payment_id": "<uuid>"
  }
}
```

**Response `200` — Booking already confirmed:**
```json
{
  "success": true,
  "message": "Payment initiated",
  "data": {
    "type": "already_confirmed",
    "booking_id": "<uuid>",
    "booking_status": "confirmed"
  }
}
```

**Errors:**
- `422 Unprocessable Entity` — waiver not yet accepted (code `WAIVER_REQUIRED`).
- `410 Gone` — booking hold has expired (code `BOOKING_EXPIRED`).
- `402 Payment Required` — PhonePe order creation failed.

---

## 8. Payment & Refund Endpoints

These endpoints support payment verification, status checks, and manager-initiated refunds.

### `GET /payments/verify`

*Public.* PhonePe's "Verify Payment Response" step, backing the frontend `/booking/redirect` page (the target of `merchantUrls.redirectUrl`). PhonePe shares no transaction status client-side, so the frontend calls this endpoint **server-side** (Next.js server → Express, no CORS) to fetch the authoritative state via the Order Status API and reconcile the payment, then routes the customer to the unified booking page. Public because the gateway redirect carries no auth context; it reveals nothing beyond the booking reference — `/booking/:bookingId` itself enforces session + ownership.

**Query params:** `orderId` (the gateway `merchantOrderId`) — required, 6–255 chars.

**Behaviour:**
1. Resolve the payment from the database — `404` for unknown `orderId` (no provider call is spent on garbage input).
2. Call PhonePe Order Status API with `orderId`.
3. `COMPLETED` / `FAILED` → process the event idempotently (same pipeline as the webhook).
4. `PENDING` / `CREATED` → return the booking reference without processing.
5. Provider unreachable → return `state: "UNKNOWN"` with the booking reference (webhook remains the primary confirmation).

**Response `200`:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "merchant_order_id": "PP-abc123",
    "booking_id": "<uuid>",
    "booking_status": "confirmed",
    "payment_status": "success",
    "state": "COMPLETED"
  }
}
```

**`state` values:** `COMPLETED`, `FAILED`, `PENDING`, `CREATED`, `UNKNOWN`. For `PENDING`/`CREATED`/`UNKNOWN`, `booking_status` and `payment_status` are omitted.

**Errors:**
- `400 Bad Request` — missing or malformed `orderId`.
- `404 Not Found` — no payment exists for the given `orderId`.

---

### `GET /payments/status/:merchantOrderId`

*Protected.* Polls the backend for the current payment state. Available to the frontend for PENDING polling; the iFrame `CONCLUDED` callback itself navigates to `/booking/redirect`, which verifies via `GET /payments/verify`.

**Response `200`:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "merchant_order_id": "PP-abc123",
    "booking_id": "<uuid>",
    "booking_status": "confirmed",
    "payment_status": "success"
  }
}
```

**`payment_status` values:** `initiated`, `success`, `failed`, `refund_pending`, `refunded`, `refund_failed`

---

### `POST /payments/webhooks/phonepe`

*Public (verified by PhonePe SHA256 auth header).* Receives server-to-server payment event callbacks (webhooks). This is the **primary** confirmation mechanism — the `GET /payments/verify` endpoint (run on the post-payment redirect) is the secondary. Both are idempotent.

**Headers:** `Authorization: SHA256(username:password)` — verified against `PHONEPE_WEBHOOK_USERNAME:PHONEPE_WEBHOOK_PASSWORD` before any processing.

**Events handled:**

| Event | `payload.state` | Action |
|---|---|---|
| `checkout.order.completed` | `COMPLETED` | Confirm booking; finalize wallet deduction; send WhatsApp |
| `checkout.order.failed` | `FAILED` | Rollback wallet credits; update payment to failed |
| `pg.refund.accepted` | — | Update payment to `refund_pending` |
| `pg.refund.completed` | — | Update payment to `refunded`; notify user via WhatsApp |
| `pg.refund.failed` | — | Alert admin; consider wallet credit fallback |

**Critical rules:**
- Always respond `200 OK` **before** async processing — never let processing errors prevent the 200 response.
- Use `payload.state` for the terminal state, not solely the event name.
- Check `payments.idempotency_key` before processing — skip silently if already in `success` state.
- `expireAt` and `timestamp` are epoch **milliseconds**.

**Response:** Always `200 OK`.

---

### `POST /payments/:paymentId/refund`

*Protected (Requires `issue_credits` permission for the associated venue).* Initiates a refund for a payment.

**Body (`application/json`):**
| Field | Type | Required | Description |
|---|---|---|---|
| `amount` | Number | No | Optional amount to refund. If omitted, full refund may be issued. |

**Response `200`:**
```json
{
  "success": true,
  "message": "Refund initiated",
  "data": {
    "status": "refunded",
    "merchantRefundId": "REFUND-abc123xyz"
  }
}
```

---

### `POST /payments/:paymentId/refund/retry`

*Protected (Requires `issue_credits` permission for the associated venue).* Retries a previously failed refund attempt.

**Response `200`:**
```json
{
  "success": true,
  "message": "Refund retry initiated",
  "data": {
    "status": "refunded",
    "merchantRefundId": "REFUND-abc123xyz"
  }
}
```

---

## 9. Review Endpoints

Reviews are a first-class, self-contained domain. Every endpoint is namespaced under `/reviews`; the booking and admin domains do not own or expose review routes. A review is anchored 1:1 to a **completed** booking (`bookings.status = 'completed'`) via a unique `booking_id`, while its public value (ratings, summaries) is aggregated at the venue level.

### `POST /reviews`

*Protected (onboarded user).* Submits a review for one of the caller's completed bookings.

Rejected when the booking is not found or not owned by the caller (`404`), is not yet completed (`400`, `BOOKING_NOT_COMPLETED`), or already has a review (`409`, `DUPLICATE_REVIEW`).

**Body (`application/json`):**

| Field | Type | Required |
|---|---|---|
| `booking_id` | UUID | Yes |
| `rating` | Integer (1–5) | Yes |
| `comment` | String (≤ 1000) | No |

> Photo uploads (`photo_url`) are reserved in the schema and will be enabled when Cloudflare R2 integration lands.

**Response `201`:**
```json
{
  "success": true,
  "message": "Review submitted",
  "data": {
    "id": "<uuid>",
    "booking_id": "<uuid>",
    "venue_id": "<uuid>",
    "rating": 4,
    "comment": "Great court, fast surface.",
    "photo_url": null,
    "is_published": true,
    "created_at": "<timestamp>"
  }
}
```

---

### `GET /reviews?venue_id=<uuid>`

*Public.* Returns published reviews for a venue, newest first, with an aggregate rating summary. Used by venue-facing pages.

**Query params:** `venue_id` (UUID, required), `limit` (default 10, max 50), `page` (default 1).

**Response `200`:**
```json
{
  "success": true,
  "message": "Reviews retrieved",
  "data": [
    {
      "id": "<uuid>",
      "booking_id": "<uuid>",
      "venue_id": "<uuid>",
      "rating": 4,
      "comment": "Great court, fast surface.",
      "photo_url": null,
      "is_published": true,
      "created_at": "<timestamp>",
      "user": {
        "id": "<uuid>",
        "name": "Arjun Mehta"
      }
    }
  ],
  "meta": {
    "pagination": { "page": 1, "limit": 10, "total": 24, "total_pages": 3 },
    "summary": { "average_rating": 4.6, "total_reviews": 24 }
  }
}
```

---

### `GET /reviews/me?booking_id=<uuid>`

*Protected (onboarded user).* Returns the authenticated user's own review for a booking, or `404` if none exists. Lets the booking owner check whether they have already reviewed a session.

**Response `200`:**
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": "<uuid>",
    "booking_id": "<uuid>",
    "venue_id": "<uuid>",
    "rating": 4,
    "comment": "Great court, fast surface.",
    "photo_url": null,
    "is_published": true,
    "created_at": "<timestamp>"
  }
}
```

---

### `GET /reviews/moderation?venue_id=<uuid>`

*Protected.* Requires the `manage_bookings` permission on the target venue. Returns **all** reviews for the venue (published and unpublished), enriched with the reviewer's phone and booking session details for moderation.

**Query params:** `venue_id` (UUID, required), `limit` (default 20, max 50), `page` (default 1), `is_published` (boolean, optional filter).

**Response `200`:**
```json
{
  "success": true,
  "message": "Reviews retrieved",
  "data": [
    {
      "id": "<uuid>",
      "booking_id": "<uuid>",
      "venue_id": "<uuid>",
      "rating": 4,
      "comment": "Great court, fast surface.",
      "photo_url": null,
      "is_published": true,
      "created_at": "<timestamp>",
      "user": {
        "id": "<uuid>",
        "name": "Arjun Mehta",
        "phone": "+919876543210"
      },
      "booking": {
        "id": "<uuid>",
        "slot_date": "2025-05-17T00:00:00.000Z",
        "session_start_time": "2025-05-17T09:00:00.000Z",
        "session_end_time": "2025-05-17T12:00:00.000Z"
      }
    }
  ],
  "meta": {
    "pagination": { "page": 1, "limit": 20, "total": 24, "total_pages": 2 }
  }
}
```

---

### `PATCH /reviews/:reviewId`

*Protected.* Publishes or unpublishes a review. Authorization is enforced in the service layer against the review's own `venue_id` (the caller must hold `manage_bookings` for that venue); callers without access receive `404` to avoid leaking review existence.

**Body (`application/json`):** `{ "is_published": false }`

**Response `200`:**
```json
{
  "success": true,
  "message": "Review updated",
  "data": {
    "id": "<uuid>",
    "booking_id": "<uuid>",
    "venue_id": "<uuid>",
    "rating": 4,
    "comment": "Great court, fast surface.",
    "photo_url": null,
    "is_published": false,
    "created_at": "<timestamp>"
  }
}
```

---

## 10. Admin Endpoints

> [!WARNING]
> **Implementation Status:** Target Product Contracts / Not Implemented in the live backend.

All admin endpoints require a valid JWT. The `Permission` column specifies the exact capability checked by `requirePermission()` middleware, which resolves through `venue_user_roles` → `roles` → `role_permissions` at request time.

### Schedule Management

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/admin/venues/:id/schedules` | `edit_schedule` | List all schedules for venue |
| `POST` | `/admin/venues/:id/schedules` | `edit_schedule` | Create a new standard schedule |
| `PATCH` | `/admin/schedules/:id` | `edit_schedule` | Update slot duration or hours |
| `POST` | `/admin/venues/:id/exceptions` | `edit_schedule` | Create a date exception (close, modify, block) |
| `DELETE` | `/admin/exceptions/:id` | `edit_schedule` | Remove an exception |

### Pricing Management

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/admin/venues/:id/pricing-rules` | `edit_pricing` | List all rules |
| `POST` | `/admin/venues/:id/pricing-rules` | `edit_pricing` | Create a new rule |
| `PATCH` | `/admin/pricing-rules/:id` | `edit_pricing` | Update or deactivate a rule |
| `GET` | `/admin/venues/:id/coupons` | `edit_pricing` | List all coupons |
| `POST` | `/admin/venues/:id/coupons` | `edit_pricing` | Create a coupon |
| `PATCH` | `/admin/coupons/:id` | `edit_pricing` | Activate/deactivate a coupon |

### Booking Management

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/admin/venues/:id/bookings` | `manage_bookings` | List bookings with filters (date, status, court) |
| `POST` | `/admin/venues/:id/bookings/walk-in` | `walk_in_entry` | Create a walk-in booking |
| `POST` | `/admin/venues/:id/bookings/block` | `manage_bookings` | Block slots without payment |
| `POST` | `/admin/bookings/:id/cancel` | `manage_bookings` | Force-cancel and issue wallet credits |

**Walk-in body:**
```json
{
  "court_ids": ["<uuid1>", "<uuid2>"],
  "slot_date": "2025-05-17",
  "slot_start_times": ["09:00", "10:00"],
  "player_name": "Raj Kumar",
  "player_phone": "+919876543210",
  "payment_method": "cash",
  "amount_paid": 2640.00
}
```

**Cancel body:**
```json
{
  "reason": "Flood — courts unusable",
  "credit_amount": 689.50
}
```

### User Management

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/admin/users` | `manage_bookings` | Search customers by phone |
| `GET` | `/admin/users/:id/bookings` | `manage_bookings` | View customer's full booking history |
| `GET` | `/admin/users/:id/wallet` | `issue_credits` | View monetary wallet balance and transactions |
| `POST` | `/admin/users/:id/credits` | `issue_credits` | Manually issue monetary wallet credits |
| `GET` | `/admin/users/:id/rewards` | `manage_bookings` | View a user's reward instance history |
| `PATCH` | `/admin/users/:id/phone` | `manage_courts` | Update a customer's phone number (validates uniqueness) |

### Admin Account Management

All endpoints require `super_admin` role (checked via `requirePermission('manage_courts')`).

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/admin/accounts` | `manage_courts` | List all admin accounts with status |
| `POST` | `/admin/accounts` | `manage_courts` | Provision a new admin account (triggers activation email) |
| `PATCH` | `/admin/accounts/:id` | `manage_courts` | Update name, email, or venue role assignment |
| `POST` | `/admin/accounts/:id/suspend` | `manage_courts` | Suspend account (blocks future logins immediately) |
| `POST` | `/admin/accounts/:id/activate` | `manage_courts` | Re-activate a suspended account |
| `POST` | `/admin/accounts/:id/resend-activation` | `manage_courts` | Resend activation email with a new token |
| `POST` | `/admin/accounts/:id/force-password-reset` | `manage_courts` | Sets `force_password_change = true`; sends reset email |
| `POST` | `/admin/accounts/:id/unlock` | `manage_courts` | Unlock a locked account before the 30-minute window expires |

**Provision admin body:**
```json
{
  "email": "manager@besanagpur.com",
  "name": "Ravi Kumar",
  "role": "manager",
  "venue_id": "<uuid>"
}
```

On success: creates `users` record (name pre-set), `admin_credentials` record (`status: pending_activation`), `venue_user_roles` record, sends activation email. Returns `201` with the created admin profile.

### Reward Engine Management

> [!NOTE]
> **Implementation Status: Built.** Management routes live under the `/rewards` prefix (owned by the rewards module, mirroring the reviews module's moderation surface) rather than an `/admin` namespace — see ADR-010 and the divergence note in `docs/ai/03-IMPLEMENTATION-STATUS.md`.

| Method | Endpoint | Permission | Description |
|---|---|---|---|
| `GET` | `/rewards/mechanisms?venue_id=<uuid>` | `edit_pricing` | List all mechanisms (active and inactive) for a venue |
| `POST` | `/rewards/mechanisms` | `edit_pricing` | Create a new mechanism (`venue_id` in body) |
| `PATCH` | `/rewards/mechanisms/:id` | `edit_pricing` (service-resolved venue) | Edit name, config (prize pool), active state, validity window |
| `GET` | `/rewards/instances/moderation?venue_id=<uuid>` | `manage_bookings` | List instances with filters (`status`, `mechanism_id`, `voucher_code`, `redeemed`, paginated) |
| `PATCH` | `/rewards/instances/:id/expire` | `manage_bookings` (service-resolved venue) | Manually expire an unrevealed instance |
| `PATCH` | `/rewards/instances/:id/redeem` | `manage_bookings` (service-resolved venue) | Mark a revealed voucher as redeemed at the venue stall (optional `note` in body) |

**Create mechanism body example (scratch card):**
```json
{
  "venue_id": "<uuid>",
  "name": "Post-Booking Scratch Card",
  "type": "scratch_card",
  "trigger_event": "booking_confirmed",
  "instance_expiry_days": 7,
  "is_active": true,
  "config": {
    "card_theme": "court_green",
    "prizes": [
      { "id": "p1", "label": "Better luck next time!",               "type": "no_prize", "probability": 0.70 },
      { "id": "p2", "label": "Free Iced Coffee at the Baseline Café", "type": "voucher",  "terms": "Show this voucher at the café counter. One per visit.", "validity_days": 14, "probability": 0.20 },
      { "id": "p3", "label": "20% Off Any Snack Combo",              "type": "voucher",  "terms": "Valid on snack combos at the venue stall.", "validity_days": 30, "probability": 0.10 }
    ]
  }
}
```

Prize `probability` values must sum to exactly 1.0 — validated server-side on save. Prize `type` is `no_prize` or `voucher` (external offers such as the venue's F&B stall — rewards never issue wallet credits). Voucher prizes may set `terms` (customer-facing smallprint, max 500 chars) and `validity_days` (redemption window after reveal, default 30).

**Voucher redemption (`PATCH /rewards/instances/:id/redeem`):** staff look up the instance by voucher code in the moderation list, then redeem it. First redemption wins; a second attempt returns `409 VOUCHER_ALREADY_REDEEMED`. A voucher past `voucher_valid_until` returns `410 VOUCHER_EXPIRED`.

**Response `200`:**
```json
{
  "instance_id": "<uuid>",
  "voucher_code": "RWD-K7MQ2XWP",
  "redeemed_at": "2026-07-16T12:30:00Z",
  "redemption_note": "Redeemed at café counter"
}
```



## 11. Reward Engine Endpoints

> [!NOTE]
> **Implementation Status: Built** (`server/src/modules/rewards/`). Reward prizes are external offer vouchers — see `docs/specs/01-DATABASE-SCHEMA.md` Domain F.

### `GET /rewards/instances`

*Protected (JWT + onboarding).* Returns all reward instances for the authenticated user. The `outcome` and `voucher` fields are **omitted** for `status = 'pending'` instances — only returned after reveal.

**Query params:** `status` (pending, revealed, expired)

**Response `200`:**
```json
{
  "success": true,
  "message": "Success",
  "data": [
    {
      "id": "<uuid>",
      "mechanism_type": "scratch_card",
      "mechanism_name": "Post-Booking Scratch Card",
      "status": "pending",
      "booking_id": "<uuid>",
      "booking_slot_date": "2026-07-13",
      "card_theme": "court_green",
      "expires_at": "2026-07-24T10:00:00Z",
      "created_at": "2026-07-17T10:00:00Z"
    },
    {
      "id": "<uuid>",
      "mechanism_type": "scratch_card",
      "mechanism_name": "Post-Booking Scratch Card",
      "status": "revealed",
      "booking_id": "<uuid>",
      "booking_slot_date": "2026-07-05",
      "card_theme": "court_green",
      "expires_at": "2026-07-17T09:00:00Z",
      "created_at": "2026-07-10T09:00:00Z",
      "revealed_at": "2026-07-16T15:30:00Z",
      "outcome": {
        "prize_id": "p2",
        "label": "Free Iced Coffee at the Baseline Café",
        "type": "voucher",
        "terms": "Show this voucher at the café counter. One per visit."
      },
      "voucher": {
        "code": "RWD-K7MQ2XWP",
        "valid_until": "2026-07-30T15:30:00Z",
        "redeemed": false
      }
    }
  ]
}
```

---

### `GET /rewards/instances/:instanceId`

*Protected (JWT + onboarding).* A single owned instance, same serialization rules as the list (outcome hidden while pending). A missing id and someone else's instance both return `404 REWARD_NOT_FOUND` — existence is never leaked.

---

### `POST /rewards/instances/:instanceId/reveal`

*Protected (JWT + onboarding).* Reveals a pending reward instance. Validates ownership, `pending` status, and non-expiry. For a `voucher` prize, a unique voucher code and its redemption window are issued atomically in the same transaction that marks the instance revealed. Returns the outcome for the first time. Concurrent reveals are safe: only one wins the status transition; the other receives `409`.

**Body:** *(none)*

**Response `200` — voucher prize:**
```json
{
  "success": true,
  "message": "Reward revealed",
  "data": {
    "instance_id": "<uuid>",
    "mechanism_type": "scratch_card",
    "status": "revealed",
    "revealed_at": "2026-07-16T11:22:00Z",
    "outcome": {
      "prize_id": "p2",
      "label": "Free Iced Coffee at the Baseline Café",
      "type": "voucher",
      "terms": "Show this voucher at the café counter. One per visit."
    },
    "voucher": {
      "code": "RWD-K7MQ2XWP",
      "valid_until": "2026-07-30T11:22:00Z",
      "redeemed": false
    }
  }
}
```

**Response `200` — no prize:**
```json
{
  "success": true,
  "message": "Reward revealed",
  "data": {
    "instance_id": "<uuid>",
    "mechanism_type": "scratch_card",
    "status": "revealed",
    "revealed_at": "2026-07-16T11:22:00Z",
    "outcome": { "prize_id": "p1", "label": "Better luck next time!", "type": "no_prize" }
  }
}
```

**Errors:**

| Code | HTTP Status | Description |
|---|---|---|
| `REWARD_ALREADY_REVEALED` | 409 | Instance is not in `pending` state (including losing a concurrent-reveal race) |
| `REWARD_EXPIRED` | 410 | Instance expiry has passed (lazily expired even if the sweeper hasn't run) |
| `REWARD_NOT_FOUND` | 404 | Instance does not exist or does not belong to the user |

---

## 12. Notifications API

All notification endpoints require authentication. Access control is enforced per route based on venue permissions (`manage_venues` for settings configuration, `manage_bookings` for outbox dispatch logs).

---

### `GET /notifications/settings`

Returns the notification toggle configuration for a specific venue.

*Requires authorization (`manage_venues`).*

**Query parameters:**
- `venue_id` (UUID, required)

**Response `200`:**
```json
{
  "success": true,
  "message": "Notification settings retrieved",
  "data": {
    "venue_id": "<uuid>",
    "reminders_enabled": false,
    "review_requests_enabled": false,
    "updated_at": "2026-07-28T10:00:00.000Z"
  }
}
```

---

### `PATCH /notifications/settings`

Upserts notification toggle configuration (`reminders_enabled`, `review_requests_enabled`) for a venue.

*Requires authorization (`manage_venues`).*

**Request body:**
```json
{
  "venue_id": "<uuid>",
  "reminders_enabled": true,
  "review_requests_enabled": true
}
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Notification settings updated",
  "data": {
    "venue_id": "<uuid>",
    "reminders_enabled": true,
    "review_requests_enabled": true,
    "updated_at": "2026-07-28T10:05:00.000Z"
  }
}
```

---

### `GET /notifications/log`

Returns a paginated list of notification outbox dispatch log records and per-status activity counts for a venue.

*Requires authorization (`manage_bookings`).*

**Query parameters:**
- `venue_id` (UUID, required)
- `status` (string, optional — `scheduled`, `sending`, `sent`, `failed`, `cancelled`, `skipped`)
- `type` (string, optional — `reminder_t24`, `reminder_t2h`, `review_request`)
- `page` (integer, default 1)
- `limit` (integer, default 20)

**Response `200`:**
```json
{
  "success": true,
  "message": "Notification log retrieved",
  "data": {
    "notifications": [
      {
        "id": "<uuid>",
        "booking_id": "<uuid>",
        "venue_id": "<uuid>",
        "user_id": "<uuid>",
        "type": "reminder_t24",
        "scheduled_for": "2026-07-29T10:00:00.000Z",
        "status": "sent",
        "attempts": 1,
        "next_retry_at": null,
        "sent_at": "2026-07-29T10:00:05.000Z",
        "provider": "dry_run",
        "last_error": null,
        "created_at": "2026-07-28T10:00:00.000Z",
        "updated_at": "2026-07-29T10:00:05.000Z",
        "booking": {
          "id": "<uuid>",
          "display_id": "BK-1001",
          "booking_type": "online",
          "status": "confirmed"
        },
        "user": {
          "id": "<uuid>",
          "name": "Alex Player",
          "phone": "+919876543210"
        }
      }
    ],
    "summary": {
      "scheduled": 0,
      "sending": 0,
      "sent": 1,
      "failed": 0,
      "cancelled": 0,
      "skipped": 0
    },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "total_pages": 1
    }
  }
}
```

---

## 13. Error Response Format

All errors follow a consistent structure:

```json
{
  "error": {
    "code": "SLOT_ALREADY_BOOKED",
    "message": "This slot was just taken. Please select another.",
    "details": {}
  }
}
```

### Standard Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `SLOT_ALREADY_BOOKED` | 409 | Single slot taken during lock attempt (legacy alias) |
| `SLOTS_UNAVAILABLE` | 409 | One or more slot units taken during multi-slot hold attempt; returns list of unavailable units |
| `SLOTS_NOT_CONSECUTIVE` | 400 | Selected slot_start_times are not consecutive |
| `HOLD_LIMIT_EXCEEDED` | 429 | Velocity check: 2 pending holds already active |
| `INVALID_CREDENTIALS` | 401 | Admin login: email not found or password incorrect |
| `ACCOUNT_SUSPENDED` | 403 | Admin account is suspended |
| `ACCOUNT_LOCKED` | 423 | Admin account locked after too many failed attempts |
| `ACCOUNT_NOT_ACTIVATED` | 403 | Admin activation email not yet completed |
| `FORCE_PASSWORD_CHANGE_REQUIRED` | 403 | Admin must change password before accessing protected routes |
| `INVALID_ACTIVATION_TOKEN` | 400 | Activation token is wrong or expired (72h window) |
| `INVALID_RESET_TOKEN` | 400 | Password reset token is wrong or expired (1h window) |
| `PASSWORD_TOO_WEAK` | 400 | Password does not meet minimum requirements |
| `PASSWORD_MISMATCH` | 400 | `password` and `password_confirm` do not match |
| `EMAIL_ALREADY_EXISTS` | 409 | Admin provision: email already in use |
| `OTP_INVALID` | 400 | Wrong OTP entered |
| `OTP_EXPIRED` | 410 | OTP TTL has passed |
| `OTP_RATE_LIMITED` | 429 | Too many OTP requests |
| `ONBOARDING_INCOMPLETE` | 403 | JWT is valid but `users.name` is NULL; user must complete `/auth/onboarding` before accessing this resource |
| `INVALID_NAME` | 400 | Name failed validation (too short, empty, or too long) |
| `INVALID_CREDENTIALS` | 401 | Email not found or password incorrect (intentionally vague to prevent account enumeration) |
| `ACCOUNT_SUSPENDED` | 403 | Admin account suspended by an admin |
| `ACCOUNT_LOCKED` | 423 | Too many failed login attempts; `locked_until` included in response body |
| `ACCOUNT_NOT_ACTIVATED` | 403 | Admin account activation email not yet completed |
| `FORCE_PASSWORD_CHANGE_REQUIRED` | 403 | Admin must change password before accessing any admin route |
| `INVALID_ACTIVATION_TOKEN` | 400 | Activation token is wrong or has expired (72-hour window) |
| `INVALID_RESET_TOKEN` | 400 | Password reset token is wrong or has expired (1-hour window) |
| `PASSWORD_MISMATCH` | 400 | `password` and `password_confirm` fields do not match |
| `PASSWORD_TOO_WEAK` | 400 | Password does not meet minimum requirements |
| `EMAIL_ALREADY_EXISTS` | 409 | Email is already registered to another admin account |
| `COUPON_INVALID` | 400 | Code not found, inactive, or wrong venue |
| `COUPON_LIMIT_REACHED` | 400 | Max uses exceeded globally or per phone |
| `BOOKING_EXPIRED` | 410 | 10-minute hold expired before payment |
| `WAIVER_REQUIRED` | 422 | Payment attempted without waiver acceptance |
| `DUPLICATE_REVIEW` | 409 | A review already exists for this booking |
| `REWARD_ALREADY_REVEALED` | 409 | Reward instance already revealed |
| `REWARD_EXPIRED` | 410 | Reward instance past its expiry date |
| `REWARD_NOT_FOUND` | 404 | Instance not found or not owned by user |
| `VOUCHER_NOT_REDEEMABLE` | 409 | Redemption attempted on an unrevealed instance or a no-prize outcome |
| `VOUCHER_ALREADY_REDEEMED` | 409 | Voucher was already marked redeemed (first redemption wins) |
| `VOUCHER_EXPIRED` | 410 | Voucher redemption window (`voucher_valid_until`) has passed |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `INTERNAL_ERROR` | 500 | Unexpected server error |


