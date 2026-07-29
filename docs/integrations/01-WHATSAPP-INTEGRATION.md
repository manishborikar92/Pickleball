# Pickleball Platform — WhatsApp Cloud API Integration

The platform integrates **directly** with the Meta WhatsApp Cloud API — no Business Solution Provider (BSP) intermediary such as Twilio, MSG91, or similar. This eliminates per-message BSP markup and gives full control over the WABA, templates, and billing.

> **Pricing model note:** Meta replaced conversation-based pricing with **per-message pricing on July 1, 2025**. Any documentation referencing "conversations" or "24-hour conversation fees" reflects the deprecated model. All information in this document is based on the current per-message model.

---

## 1. Architecture Overview

```
Express.js Backend
  │
  └── POST https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/messages
        ↳ Send OTP (auth) and scheduled notifications (dry_run / live transport)
```

All outbound messages are fired from the backend (`otp.provider.js` for OTP; `notifications.transport.js` for scheduled notifications). The frontend never calls the Meta Graph API directly. Inbound WhatsApp webhooks and support messaging are deferred (not registered in Express router).

---

## 2. Account & Setup Requirements

### 2.1 What You Need

| Entity | Description |
|---|---|
| **Meta Business Portfolio** | Verified business entity in Meta Business Manager. Required to lift sandbox limits and unlock production sending. |
| **WhatsApp Business Account (WABA)** | Belongs to the Business Portfolio. Contains your phone number, templates, and billing settings. |
| **Phone Number ID** | The specific registered number used for API calls. |
| **System User Access Token** | A permanent token generated from a System User in Meta Business Settings. Used in all API requests. |

### 2.2 Registration Constraints

- New business portfolios are initially capped at **2 registered phone numbers**. Meta auto-increases this to 20 after business verification or upon reaching a messaging limit of 2,000.
- The phone number used for the WABA **cannot simultaneously be active on the WhatsApp consumer or Business App**. It must be migrated or use a new number.
- The WABA display name must comply with Meta's naming rules (no "official", no Meta-affiliated words). It goes through an approval process before the account can send messages.

### 2.3 India-Specific Requirements

- **Register the WABA in India** with INR as the billing currency. This is critical: if the WABA is registered outside India but sends OTPs to Indian users (+91 numbers), Meta applies **authentication-international rates**, which can be significantly higher than domestic rates.
- **INR local billing** is available for new WABAs created from January 2026. INR-billed WABAs cannot be converted from existing USD-billed accounts.
- **18% GST** is applied on top of all Meta charges. Meta provides GST-compliant invoices for Indian businesses.
- WhatsApp Business API in India does **not** require TRAI DLT registration (that applies to SMS only). Compliance is governed by Meta's WhatsApp Business Policy and India's **DPDP Act 2023** (see Section 6).

### 2.4 Setup Checklist

1. Go to `developers.facebook.com` → Create a **Business App** → Add the **WhatsApp** product.
2. In Meta Business Manager → Business Settings → Security Center → **Start Verification**. Submit legal documents. Admin access required. Allow 1–3 business days.
3. In WhatsApp Manager (Business Suite) → Add your phone number → verify via SMS/voice call → receive the **Phone Number ID**. Note both your **WABA ID** and **Phone Number ID** — used in every API call.
4. Submit the WABA **display name** for approval before attempting to send.
5. Business Settings → Users → **System Users** → Create a system user → assign it to the app with WhatsApp permissions → **Generate Token**. This is your permanent production token. Store it in your `.env` file. Never embed it in client-side code.
6. When activating inbound webhooks in the future: configure the HTTPS Callback URL + Verify Token in App Dashboard → WhatsApp → Configuration.
7. Subscribe to `messages` and `message_status` webhook events (future).
8. Create and submit all required templates for approval (see Section 4).

> **Do not use the temporary 24-hour token** from the testing panel in production. It expires and will silently break all outbound messaging.

---

## 3. Pricing — Per-Message Model (Effective July 1, 2025)

### 3.1 How Billing Works

You are charged **per delivered template message**. Undelivered messages are not charged. Charges are based on the **recipient's country code**, not the sender's location.

There are four message categories, each with its own rate:

| Category | Use Case | India Rate (Tier 1) | Free Windows |
|---|---|---|---|
| **Authentication** | OTPs, verification codes | ~₹0.115–0.145 / message | None |
| **Utility** | Booking confirmations, reminders, cancellations | ~₹0.16 / message | **Free** if sent within an open Customer Service Window (CSW) |
| **Marketing** | Promotional campaigns, flash sales, loyalty rewards | ~₹0.8631 / message | None |
| **Service** | Replies to user-initiated messages (support) | **Free** (no monthly cap) | Always free |

> India rates as of January 2026. 18% GST applies on top. Verify current rates at Meta's official rate card before budgeting.

### 3.2 Free Messaging Windows

**Customer Service Window (CSW):** Every time a user sends your WhatsApp number a message, a 24-hour timer opens. Within this window:
- All **service** replies (free-form text, images, etc.) are free.
- **Utility** templates sent within this window are also free.
- Authentication and Marketing templates are always charged regardless of CSW.

**72-hour free entry point window:** If a user clicks a Click-to-WhatsApp Ad or a Facebook/Instagram Page CTA button, all messages (including templates) are free for 72 hours. Not immediately relevant but worth planning for future marketing.

### 3.3 Volume Tiers

For **Utility** and **Authentication** messages, Meta offers automatic incremental volume discounts as your monthly message count increases within a market-category pair (e.g., India–authentication). Discounts apply only to messages above each tier threshold, not retroactively. Tiers reset at the start of each month. Marketing messages are excluded from volume tiering.

### 3.4 Authentication-International Rate

India is one of nine markets with a separate authentication-international rate, which applies when a WABA registered **outside India** sends OTPs to Indian (+91) users. The platform's WABA must be Indian-registered to avoid this premium. This is enforced at the WABA creation step, not in code.

### 3.5 Practical Cost Estimates (Besa Nagpur, at current scale)

| Message Type | Volume Estimate | Estimated Monthly Cost (incl. GST) |
|---|---|---|
| OTP (Authentication) | ~500/month (2 courts, ~250 bookings) | ~₹100–120 |
| Utility (confirmations, reminders) | ~750/month (3 per booking) | ~₹140 (most may be free within CSW) |
| Marketing (campaigns) | Opt-in only; as needed | ~₹0.86/message |
| Service (support replies) | Any volume | ₹0 |

---

## 4. Template Categories & Our Templates

All business-initiated messages (outbound) must use **pre-approved templates**. Templates are submitted in Meta Business Manager → WhatsApp Manager → Templates.

### 4.1 Template Category Reference

**Built and submitted for approval at launch:**

| Template | Category | Reason |
|---|---|---|
| OTP (booking verification) | **Authentication** | One-time passcode for identity verification |
| Booking confirmation + receipt | **Utility** | Post-purchase transactional notification |
| Force majeure cancellation + credit notice | **Utility** | Account status update for an existing transaction |
| Phantom booking apology + refund notice | **Utility** | Account status update for an existing transaction |
| Wallet credit issued | **Utility** | Account balance update |

**Deferred — not submitted for approval at launch:**

| Template | Category | Depends On | Status |
|---|---|---|---|
| T−24h reminder ("playing tomorrow") | **Utility** | Outbox scheduler | ✅ Outbox scheduler built (ADR-011) — submit for approval at Meta setup |
| T−2h reminder (final + rules) | **Utility** | Outbox scheduler | ✅ Outbox scheduler built (ADR-011) — submit for approval at Meta setup |
| Review request (post-session) | **Utility** | Outbox scheduler | ✅ Outbox scheduler built (ADR-011) — submit for approval at Meta setup |
| Flash sale announcement | **Marketing** | Reward engine + marketing activation | Deferred |
| Loyalty reward / scratch card notification | **Marketing** | Reward engine | Deferred |

> **Scheduled notification infrastructure is built.** The T−24h, T−2h, and review-request workflows are fully implemented (scheduling, dispatch, admin toggles, dry-run transport) via the notifications module — see `docs/adrs/ADR-011-notifications-module.md`. They run in dry-run mode until Meta is configured. Submitting + approving these three **Utility** templates in Meta Business Manager is the only remaining template work.

> Meta's template category guidelines are strict. Utility templates must be clearly transactional. If a template contains promotional language (discounts, offers, upsells) unrelated to an existing transaction, Meta will recategorize it as Marketing, which charges at the higher rate. Do not add promotional copy to utility or authentication templates.

### 4.2 Authentication Template Format

Meta enforces a specific format for authentication templates to qualify for the cheaper authentication rate. They must:
- Contain only the OTP/code and minimal instructional text.
- Not include links (except the code itself).
- Not include emojis.
- Use the standardized button format (optional "Copy Code" button).

Example approved format:
```
Your {{1}} verification code is: {{2}}
This code expires in 5 minutes. Do not share it with anyone.
```

### 4.3 Template Approval

- Templates typically receive approval within minutes to a few hours.
- Rejected templates can be resubmitted with edits.
- Approved templates can be paused by Meta if user feedback (blocks, reports) is poor.
- Template category can be appealed if Meta auto-recategorizes it.

---

## 5. Backend Integration — Node.js / Express.js

### 5.1 Outbound WhatsApp Modules

Outbound WhatsApp delivery is handled across two dedicated modules:

1. **OTP Provider (`server/src/modules/auth/otp.provider.js`)**: Encapsulates OTP template sending via Meta Graph API in production, with fallback to console logging in sandbox/test environments.
2. **Scheduled Notifications Transport (`server/src/modules/notifications/notifications.transport.js`)**: Encapsulates outbox notification delivery (reminders, review requests). Runs in `dry_run` mode by default until `NOTIFICATIONS_TRANSPORT_MODE=live` and Meta template names are configured.

> **Deferred / Planned for Future Scope:**
> - Inbound WhatsApp support webhook handler (no inbound route registered in Express server).
> - Marketing campaign template dispatchers.

### 5.2 Outbound API Call Structure

**Endpoint:** `POST https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/messages`

Replace `{API_VERSION}` with the **current stable Meta Graph API version** at time of development. Do not hardcode a specific version — pin to the latest stable version and update during regular dependency reviews.

**Headers:**
```
Authorization: Bearer {SYSTEM_USER_ACCESS_TOKEN}
Content-Type: application/json
```

**Authentication Template Payload:**
```json
{
  "messaging_product": "whatsapp",
  "to": "919876543210",
  "type": "template",
  "template": {
    "name": "booking_otp",
    "language": { "code": "en" },
    "components": [
      {
        "type": "body",
        "parameters": [{ "type": "text", "text": "482931" }]
      },
      {
        "type": "button",
        "sub_type": "url",
        "index": "0",
        "parameters": [{ "type": "text", "text": "482931" }]
      }
    ]
  }
}
```

**Utility Template Payload (Booking Confirmation):**
```json
{
  "messaging_product": "whatsapp",
  "to": "919876543210",
  "type": "template",
  "template": {
    "name": "booking_confirmed",
    "language": { "code": "en" },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Court 1" },
          { "type": "text", "text": "Sunday, 11 May 2025" },
          { "type": "text", "text": "09:00 AM – 10:00 AM" },
          { "type": "text", "text": "₹689.50" }
        ]
      }
    ]
  }
}
```

### 5.3 Inbound Webhook Handler — Deferred

> **Deferred / Not Implemented in Codebase.** Inbound WhatsApp webhook processing and support inbox routing are not implemented in the current repository (no inbound WhatsApp webhook route exists in Express). When customer support volume justifies an inbound messaging flow, a dedicated webhook handler router can be added.

### 5.4 Environment Variables

```
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WABA_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
GRAPH_API_VERSION=
```

**Scheduled notification templates (built — dry-run until set):**

```
NOTIFICATIONS_TRANSPORT_MODE=live            # default 'dry_run'; set 'live' at Meta activation
WHATSAPP_REMINDER_T24_TEMPLATE_NAME=
WHATSAPP_REMINDER_T2H_TEMPLATE_NAME=
WHATSAPP_REVIEW_TEMPLATE_NAME=
WHATSAPP_REMINDER_T24_TEMPLATE_LANGUAGE=en_US
WHATSAPP_REMINDER_T2H_TEMPLATE_LANGUAGE=en_US
WHATSAPP_REVIEW_TEMPLATE_LANGUAGE=en_US
NOTIFICATIONS_MAX_ATTEMPTS=5                 # dispatch retry/dead-letter tuning
NOTIFICATIONS_DISPATCH_LIMIT=100             # per-cycle dispatch cap
```

> **Meta activation checklist (the only remaining work):** (1) configure the Meta credentials above; (2) submit + approve the three **Utility** templates; (3) set the three `WHATSAPP_*_TEMPLATE_NAME` vars + `NOTIFICATIONS_TRANSPORT_MODE=live` (production config validation enforces all of these before boot); (4) admin enables the reminder/review toggles at `/admin/settings`. New booking confirmations from that point send live. See `docs/adrs/ADR-011-notifications-module.md`.

### 5.5 SMS Fallback — Deferred

> **Deferred Implementation.** WhatsApp penetration is very high among Indian smartphone users, and OTP delivery failures are expected to be rare. SMS fallback via a TRAI DLT-registered route is added if OTP delivery failures are reported in production. No architectural changes are required — the OTP service is extended with a secondary delivery attempt triggered on a WhatsApp delivery failure webhook.

---

## 6. Compliance

### 6.1 Meta WhatsApp Business Policy

- **Opt-in required for Marketing templates.** Users must have explicitly opted in to receive promotional messages from the business before a Marketing template can be sent. Opt-in must be collected outside WhatsApp (e.g., on the booking page or landing page). The platform must record the opt-in timestamp and source.
- **Opt-in not required for Utility and Authentication templates**, as long as the user has shared their phone number with the business in a relevant context (i.e., during the booking flow).
- Businesses cannot send messages to users who have blocked the number or opted out.

### 6.2 Digital Personal Data Protection Act 2023 (India — DPDP Act)

The DPDP Act governs the collection and processing of personal data of Indian residents, including phone numbers used for WhatsApp messaging.

| Requirement | Implementation |
|---|---|
| Informed consent | Booking flow must clearly state that the phone number will be used for booking confirmations and (if applicable) marketing messages |
| Purpose limitation | Phone numbers collected during checkout may only be used for booking-related communications and explicitly opted-in marketing |
| Opt-out mechanism | Users must be able to opt out of marketing messages at any time. Honor opt-outs before the next campaign send |
| Data principal rights | Users can request deletion of their data; `users` table entries and associated messages must be removable |

### 6.3 Message Quality Rating

Meta monitors user feedback (blocks, reports) on your phone number. A low quality rating moves the number to "Flagged" status and can restrict sending limits. To maintain a good quality rating:
- Send only relevant messages.
- Respect opt-outs immediately.
- Keep utility and authentication template text clean and non-promotional.

---

## 7. Throughput & Limits

| Limit | Value |
|---|---|
| Cloud API throughput | Up to 500 messages/second (Meta-managed infrastructure; no self-hosting required) |
| Initial phone number cap | 2 numbers per new business portfolio |
| Cap after business verification | Automatically increased to 20 |
| Daily messaging limit | Starts at 1,000 unique users/day; scales automatically based on quality rating and usage |
| Template submission | Unlimited; approval typically within minutes to hours |

At Besa Nagpur's current scale, none of these limits are a practical concern.
