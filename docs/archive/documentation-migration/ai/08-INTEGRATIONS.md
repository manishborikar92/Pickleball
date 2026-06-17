# AI Project Context — External Service Integrations

This document details integration structures, APIs, and credentials mapping for third-party services utilized by the Pickleball Booking Platform.

---

## 1. PhonePe Payment Gateway (v2 Checkout & Webhooks)

PhonePe is integrated for India UPI checkouts using the Web Standard Checkout flow redirect.
* **SDK Module**: Express uses custom PhonePe Client wrapper modules.
* **Payload encryption**: Request bodies sent to PhonePe are Base64 encoded and signed using SHA256 hashing.
* **Signature Header (`X-VERIFY`)**:
  `SHA256(Base64_Payload + "/pg/v1/pay" + Salt_Key) + "###" + Salt_Index`

### 1.1 Webhook Verification Protocol
Upon completing payment, PhonePe issues a POST callback to `/api/v1/payments/webhook`.
The webhook request body must be verified using the header checksum signature:
* Verify header: `req.headers['x-verify']`.
* Calculate validation checksum: `SHA256(req.body.response + Salt_Key) + "###" + Salt_Index`.
* Gaps: If the calculated checksum does not match `x-verify`, reject with `401 Unauthorized`.

---

## 2. Meta WhatsApp Cloud API (Direct Delivery)

OTP codes and booking receipts are dispatched directly via Meta's Graph Cloud API.
* **Endpoint URL**: `https://graph.facebook.com/v20.0/<WHATSAPP_PHONE_NUMBER_ID>/messages`
* **Authorization**: Header `Authorization: Bearer <WHATSAPP_ACCESS_TOKEN>`

### 2.1 OTP Template Parameters
* **Template Name**: Configured by `WHATSAPP_OTP_TEMPLATE_NAME` (default language `en_US`).
* **Message Payload**:
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

---

## 3. Cloudflare R2 (Object Storage)

Used for uploading and hosting static files (e.g. court images and future review photos).
* **API Wrapper**: AWS SDK S3 Client configured with custom Cloudflare endpoints.
* **Key parameters**:
  * `Endpoint`: `https://<account_id>.r2.cloudflarestorage.com`
  * `Bucket`: `baseline-arena-uploads`
  * `Region`: `auto`
