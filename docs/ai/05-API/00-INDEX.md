# API Directory Index — Root Details

All API endpoints of the Pickleball Booking Platform are served under `/api/v1`.

---

## 1. Authentication & Headers

| Header Name | Value Format | Required On | Description |
|:---|:---|:---|:---|
| `Authorization` | `Bearer <access_token>` | Protected routes | Authenticates requests using a short-lived JWT. |
| `Content-Type` | `application/json` | POST / PATCH / PUT | Payload encoding format. |

### 1.1 Cookies
* **Opaque Refresh Token Cookie (`pb_refresh_token`)**:
  * Set on verification / login endpoints.
  * Attributes: `HttpOnly`, `Secure` (production), `SameSite=Lax`, `Path=/api/v1/auth`.
  * Used by `POST /auth/refresh` to rotate sessions.

---

## 2. Standardized JSON Response Shapes

Every endpoint returns a unified JSON format using the `ApiResponse.js` class:
* **Prisma Context**: See the API controller wrapper class [ApiResponse.js](../../../server/src/utils/api-response.js).

### 2.1 Success Response (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### 2.2 Error Response (`400`, `401`, `403`, `404`, `500`)
```json
{
  "success": false,
  "message": "Detailed error message",
  "errors": [ ... ]
}
```

---

## 3. Global HTTP Status Code Definitions

* **`400 Bad Request`**: Failed input validation (e.g. invalid phone number, overlapping slots).
* **`401 Unauthorized`**: JWT token is missing, expired, or signature is invalid.
* **`403 Forbidden`**: Valid JWT, but the user lacks the required permission key at the venue. Or `force_password_change=true` is blocking.
* **`404 Not Found`**: Request route does not exist, or target resource is missing.
* **`429 Too Many Requests`**: Rate limit exceeded (configured in rate-limit middleware).
* **`500 Internal Server Error`**: Unhandled exception in backend services.

---

## 4. API Endpoints Modules
* [01-AUTH.md](01-AUTH.md) — Customer OTP & Staff authentication endpoints.
* [02-USERS.md](02-USERS.md) — Customer profile onboarding endpoints.
* [03-BOOKINGS.md](03-BOOKINGS.md) — Target specifications for slot holdings and availability inquiries.
* [04-PAYMENTS.md](04-PAYMENTS.md) — Target webhook and status check payload details.
* [05-ADMIN.md](05-ADMIN.md) — Administrative court block and walk-in entry operations.
