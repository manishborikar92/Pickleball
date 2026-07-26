# Webhook Local Development Guide — PhonePe + Hookdeck

> **Status**: Reference guide  
> **Last Updated**: 2026-06-24  
> **Audience**: Developers running the Pickleball platform locally  

---

## Overview

PhonePe PG v2 sends Server-to-Server (S2S) callbacks (webhooks) for payment and
refund events. In local development, `localhost` is not reachable from PhonePe's
servers. **Hookdeck** provides a secure tunnel that proxies PhonePe webhooks to
your local Express server.

```
PhonePe  ──S2S callback──▶  Hookdeck  ──tunnel──▶  localhost:5000
                             (cloud)                  (your machine)
```

---

## Prerequisites

| Requirement | Details |
|---|---|
| Node.js ≥ 20 | `node --version` |
| Running server | `npm run dev` in `/server` (default port 5000) |
| Hookdeck CLI | [hookdeck.com/docs/cli](https://hookdeck.com/docs/cli) |
| PhonePe sandbox | `PHONEPE_ENV=SANDBOX` in `.env` |

---

## 1. Install Hookdeck CLI

```bash
# macOS / Linux
brew install hookdeck/hookdeck/hookdeck

# Windows (scoop)
scoop bucket add hookdeck https://github.com/hookdeck/scoop-hookdeck-cli.git
scoop install hookdeck

# npm (any OS)
npm install hookdeck-cli -g
```

Verify: `hookdeck version`

---

## 2. Authenticate

```bash
hookdeck login
```

Follow the browser prompt to link your Hookdeck account.

---

## 3. Start the Webhook Tunnel

```bash
hookdeck listen 5000 phonepe-source --path /api/v1/payments/webhooks/phonepe
```

| Parameter | Value |
|---|---|
| `5000` | Your local Express server port |
| `phonepe-source` | A logical name for the webhook source in Hookdeck dashboard |
| `--path` | Routes only to your webhook endpoint |

Hookdeck will print a public URL, e.g.:  
`https://hkdk.events/xxxxxxxx`

---

## 4. Configure PhonePe Sandbox

1. Go to [business.phonepe.com](https://business.phonepe.com) → Developer Settings → Webhooks
2. Set the **Webhook URL** to the Hookdeck URL:  
   `https://hkdk.events/xxxxxxxx`
3. Set **Username** and **Password** — these must match:
   - `PHONEPE_WEBHOOK_USERNAME` in your `.env`
   - `PHONEPE_WEBHOOK_PASSWORD` in your `.env`
4. Select event types:
   - `checkout.order.completed`
   - `checkout.order.failed`
   - `pg.refund.completed`
   - `pg.refund.failed`

---

## 5. Verify End-to-End

1. Start your server: `npm run dev`
2. Start the tunnel: `hookdeck listen 5000 phonepe-source --path /api/v1/payments/webhooks/phonepe`
3. Trigger a test payment through the frontend checkout flow
4. Observe:
   - Hookdeck dashboard: incoming webhook event and delivery status
   - Server logs: `[PhonePe Webhook] Event received` and processing logs
   - Database: payment status transitions from `initiated` → `success`

---

## 6. Hookdeck Dashboard Features

| Feature | Use |
|---|---|
| **Events** | See all incoming webhook payloads |
| **Deliveries** | Track delivery status and retry failures |
| **Replay** | Re-deliver any webhook for testing |
| **Filters** | Route specific event types to different endpoints |

Access at: [dashboard.hookdeck.com](https://dashboard.hookdeck.com)

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Webhook shows 401 | Auth hash mismatch | Verify `PHONEPE_WEBHOOK_USERNAME` and `PHONEPE_WEBHOOK_PASSWORD` match PhonePe dashboard config |
| No webhooks arriving | Tunnel not running | Ensure `hookdeck listen` is active and URL matches PhonePe config |
| Payment stuck in `initiated` | Webhook processing error | Check server logs for `[PhonePe Webhook]` errors |
| Hookdeck shows 404 | Wrong path | Ensure `--path /api/v1/payments/webhooks/phonepe` matches route mount |

---

## 8. Environment Variable Reference

```bash
# Required for webhook verification (must match PhonePe dashboard)
PHONEPE_WEBHOOK_USERNAME=your-webhook-username
PHONEPE_WEBHOOK_PASSWORD=your-webhook-password

# PhonePe environment (SANDBOX for local dev)
PHONEPE_ENV=SANDBOX

# PhonePe browser return target
FRONTEND_BASE_URL=http://localhost:3000
```

---

## 9. Production Notes

In production, Hookdeck is **not needed** — PhonePe webhooks are sent directly
to your server's public URL. The webhook endpoint is:

```
POST https://your-domain.com/api/v1/payments/webhooks/phonepe
```

Configure this URL in the PhonePe production dashboard with the same username/password
credentials stored in your production environment variables.
