# External Service Integrations

This document details the unified technical integration structures, credentials mapping, request/response protocols, signatures, and billing setups for external services used by the Pickleball Booking Platform:
1. **PhonePe Payment Gateway (v2 Standard Checkout & Webhooks)**
2. **Meta WhatsApp Cloud API (Direct Outbound Messaging)**
3. **Cloudflare R2 (Object Storage)**

---

## 1. PhonePe Payment Gateway (v2 Checkout & Webhooks)

PhonePe is integrated for India UPI checkouts using the Web Standard Checkout flow redirect. The system operates directly through PhonePe's HTTPS API endpoints.

### 1.1 Web Flow Architecture
The platform implements PhonePe's standard web redirect checkout flow:
1. The client selects slots and clicks "Pay".
2. The backend initiates the transaction, registers a database-locked slot hold (10-minute expiry), and requests a payment page URL from PhonePe.
3. The backend returns the `redirectUrl` to the client.
4. The client redirects to PhonePe's hosted payment page.
5. After payment, the user is redirected back to the backend `redirectUrl` (handled at `/api/v1/payments/redirect`), which verifies status and redirects to `/booking/success`.
6. PhonePe issues an asynchronous Server-to-Server (S2S) POST callback webhook to `/api/v1/payments/webhook` for final settlement confirmation.

### 1.2 Signature & Checksum Protocols
All API requests and webhooks are cryptographically signed using SHA-256 with the merchant's private Salt Key.

#### Outbound Request Signature
*   Request body payloads are JSON formatted, Base64 encoded, and sent to `/pg/v1/pay`.
*   **Signature Header (`X-VERIFY`)**:
    `SHA256(Base64_Payload + "/pg/v1/pay" + Salt_Key) + "###" + Salt_Index`

#### Webhook Verification Signature
Upon completion, PhonePe POSTs a JSON payload to `/api/v1/payments/webhook`. The webhook payload contains a Base64-encoded `response` string.
*   **Verify Header**: Read `x-verify` from headers.
*   **Checksum Verification**: Calculate signature:
    `SHA256(req.body.response + Salt_Key) + "###" + Salt_Index`
*   If calculated checksum does not match `x-verify`, reject with `401 Unauthorized`.

### 1.3 UPI Payment Modes
Only UPI payment modes are enabled, configured via `paymentModeConfig.enabledPaymentModes` in the payload:
*   `UPI_COLLECT` (Mobile number entry for UPI app collect request)
*   `UPI_QR` (Dynamic QR code display)
*   `UPI_INTENT` (App switching on mobile browsers)

### 1.4 Refund & Reconciliation Lifecycle
*   **Auto-Refunds**: In case of "phantom bookings" (e.g. slots booked concurrently before database locks), the backend triggers a direct refund request to the PhonePe Refund API.
*   **Manual Overrides**: Refund trigger via `/admin/bookings/:id/refund` issues credit back to User's Wallet or original payment instrument.
*   **Idempotency**: All payment and refund transactions require a unique `merchantTransactionId` generated as `TXN_<uuid>` to prevent duplicate checkouts.

---

## 2. Meta WhatsApp Cloud API (Direct Delivery)

The platform integrates directly with the Meta WhatsApp Cloud API without Business Solution Provider (BSP) intermediaries.

### 2.1 Outbound API Configuration
*   **Endpoint URL**: `https://graph.facebook.com/v20.0/<WHATSAPP_PHONE_NUMBER_ID>/messages`
*   **Authorization**: Header `Authorization: Bearer <WHATSAPP_ACCESS_TOKEN>`
*   **WABA setup**: Must be registered in India with INR as billing currency to prevent authentication-international rate premiums for domestic Indian (+91) recipients.
*   **GST Compliance**: 18% GST applies to all Meta Graph charges.

### 2.2 Template Messages & Pricing (Effective July 1, 2025)
Meta enforces per-message billing. All business-initiated outbound messages must use pre-approved templates categorised into three paid tiers plus a free support tier:

| Category | Use Case | India Rate (Tier 1) | Free Window |
|---|---|---|---|
| **Authentication** | Customer login OTPs | ~₹0.115–0.145 / message | None |
| **Utility** | Booking confirmations, receipts, credits | ~₹0.16 / message | Free if within 24h Customer Service Window (CSW) |
| **Marketing** | Promotions, flash campaigns | ~₹0.86 / message | None |
| **Service** | Replying to customer-initiated messages | Free | Free |

### 2.3 Outbound Payload Formats
OTPs and receipts are dispatched via JSON payloads.

#### OTP Template Payload Example
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "+919876543210",
  "type": "template",
  "template": {
    "name": "otp_verification",
    "language": { "code": "en_US" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "123456" }
        ]
      },
      {
        "type": "button",
        "sub_type": "url",
        "index": "0",
        "parameters": [
          { "type": "text", "text": "123456" }
        ]
      }
    ]
  }
}
```

#### Verification Handshake Webhook
Meta webhook verification is handled by responding to GET requests on the callback route with the received `hub.challenge` query parameter if the verification token matches.

---

## 3. Cloudflare R2 (Object Storage)

Cloudflare R2 is utilized for hosting static files such as court facility images, brand assets, and user review uploads.

### 3.1 S3 Compatibility Layer
R2 is accessed via the AWS SDK S3 Client wrapper configured with:
*   **Endpoint**: `https://<account_id>.r2.cloudflarestorage.com`
*   **Bucket**: `baseline-arena-uploads`
*   **Region**: `auto`
*   **Credentials**: R2 Access Key ID and Secret Access Key stored in `.env`.

### 3.2 Security Configuration
*   **Uploads Scope**: Signed URLs are generated on the server for frontend uploads to prevent exposing write keys.
*   **Public Access**: Public read access is routed through a custom subdomain/domain proxy with caching enabled at Cloudflare edge nodes.
