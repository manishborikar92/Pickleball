# Baseline Arena — Costing Analysis

**Prepared by:** Manish Borikar
**Platform:** Baseline Arena — Pickleball Booking & Management
**Max Capacity:** 900 bookings / month

---

## At a Glance

| Period | Monthly Cost | What's Included |
|---|---|---|
| **Months 1 – 4** | ~₹305 – ₹407 | WhatsApp only (hosting is free) |
| **Month 5 onwards** | ~₹1,105 – ₹1,207 | Hosting (≤ ₹800) + WhatsApp |
| **Year 1 Total** | ~₹13,177 – ₹14,401 | Setup + 12 months of operations |
| **Year 2 Total** | ~₹14,321 – ₹15,545 | Domain renewal + 12 months |

> Marketing broadcast costs are **optional** and charged per campaign. The higher end of each range above assumes one marketing broadcast to ~100 users/month.

---

## 1. One-time Setup Costs

| Item | Cost | Notes |
|---|---|---|
| Domain Name | ₹117 | GoDaddy — ₹99 + 18% GST (Year 1 rate) |
| Development Fee | ₹2,500 – ₹3,000 | Agentic AI |
| Meta Business Verification | ₹0 | Requires GST / Udyam documents |
| Payment Gateway (PhonePe) | ₹0 | UPI-only promotional offer |
| SSL / Security | ₹0 | Free via Vercel / Cloudflare |
| **Total** | **₹2,617 – ₹3,117** | Paid once at launch |

---

## 2. Monthly Hosting Costs

- **Months 1 – 4:** ₹0 — Hosting provided **free** by Agentic AI
- **Month 5 onwards:** ≤ ₹800/month *(exact amount TBD; will not exceed ₹800)*

| Service | Cost | Provider |
|---|---|---|
| Backend Server | ₹0 → ≤ ₹800/month | TBD (likely Fly.io, Mumbai region) |
| Frontend Hosting | ₹0 | Vercel (Hobby tier) |
| Database (PostgreSQL) | ₹0 | Supabase / Neon (free up to 500 MB) |
| File & Image Storage | ₹0 | Cloudflare R2 (free up to 10 GB) |
| Analytics & Error Monitoring | ₹0 | PostHog / Sentry (free tier) |

---

## 3. WhatsApp API Costs (Meta Cloud API)

All rates include **18% GST**. Estimates based on **900 bookings/month (maximum capacity)**.

### 3.1 Per-Message Rates

| Message Type | Rate (incl. GST) | Pre-GST Rate |
|---|---|---|
| Authentication (OTP) | ₹0.1357 / message | ₹0.1150 |
| Utility (Confirmations, Reminders) | ₹0.1357 / message | ₹0.1150 |
| Marketing / Promotional | ₹1.0185 / message | ₹0.8631 |
| Service (User-initiated Replies) | **Free** | — |

> **Cost-saving tip:** Utility messages sent within a **24-hour Customer Service Window (CSW)** — when the user messages first — are charged at **₹0**. Using CSW where possible reduces costs significantly.

---

### 3.2 Monthly WhatsApp Cost Estimate (at 900 bookings/month)

| Message Type | Volume / Month | Rate | Estimated Cost |
|---|---|---|---|
| Authentication (OTP) | ~1,350 | ₹0.1357 | ~₹183 |
| Utility (Confirmations) | ~900 | ₹0.1357 | ~₹122 |
| **Subtotal (base)** | **2,250 messages** | | **~₹305 / month** |

---

### 3.3 Marketing / Promotional Message Costs

Charged separately, per campaign. Only sent when needed.

| Audience Size | Cost per Campaign |
|---|---|
| 100 users | ~₹102 |
| 250 users | ~₹255 |
| 500 users | ~₹509 |
| 1,000 users | ~₹1,019 |

**Template creation and storage is free** — no limit on the number of templates.

Common templates to maintain:
- Festival offers (Diwali, Holi, etc.)
- Weekend / seasonal discounts
- Re-engagement for inactive players
- New court or facility announcements
- Membership renewal reminders

> Templates are usually approved by Meta within a few minutes.

---

## 4. Monthly Cost Summary

| Component | Months 1–4 | Month 5+ |
|---|---|---|
| Hosting | ₹0 | ≤ ₹800 |
| WhatsApp (Auth + Utility) | ~₹305 | ~₹305 |
| **Total (without marketing)** | **~₹305** | **~₹1,105** |
| **Total (with marketing, 100 users)** | **~₹407** | **~₹1,207** |

---

## 5. Annual Cost Projections

### Year 1

| Component | Cost |
|---|---|
| One-time Setup | ₹3,117 |
| Months 1–4 (free hosting + WhatsApp only) | ~₹1,220 |
| Months 5–12 (hosting + WhatsApp) | ~₹8,840 |
| **Total (without marketing)** | **~₹13,177** |
| **Total (with monthly marketing, 100 users)** | **~₹14,401** |

### Year 2 Onwards

| Component | Cost |
|---|---|
| Domain Renewal | ~₹1,061 |
| Monthly Operations × 12 (without marketing) | ~₹13,260 |
| Monthly Operations × 12 (with marketing) | ~₹14,484 |
| **Total (without marketing)** | **~₹14,321** |
| **Total (with marketing)** | **~₹15,545** |

---

## 6. Key Assumptions

| Parameter | Value |
|---|---|
| Max bookings per month | 900 |
| OTP messages per booking | ~1.5 (includes re-sends) |
| Confirmation messages per booking | 1 |
| Hosting — Months 1 to 4 | ₹0 (free period) |
| Hosting — Month 5 onwards | ≤ ₹800/month (TBD) |
| Payment gateway fee | ₹0 (PhonePe UPI promo) |
| Domain renewal (Year 2+) | ~₹1,061/year |

---

## 7. Why Costs Are Low

| Decision | Saving |
|---|---|
| Direct Meta API (no BSP like Twilio/Interakt) | Saves ₹0.50–₹1.50 per message in third-party markup |
| PhonePe UPI-only (₹0 transaction fee) | Saves ~₹12,000+/year vs. standard 2% gateway fee |
| Free-tier services (Vercel, Supabase, Cloudflare, PostHog) | ₹0 for frontend, database, storage, and analytics |
| 4-month free hosting period | Saves up to ₹3,200 upfront |
| CSW (Customer Service Window) messaging | Reduces effective WhatsApp cost as user engagement grows |
