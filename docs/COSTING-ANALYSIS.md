# Baseline Arena — Costing Analysis

**Prepared by:** Manish Borikar
**Platform:** Baseline Arena — Pickleball Booking & Management
**Max Capacity:** 900 bookings / month
**Last Updated:** May 2026
**Note:** Hetzner revised its pricing on 1 April 2026. All figures below reflect the updated rates. EUR/INR rate used: ₹112 per €1.

---

## At a Glance

| Cost Type | Monthly Cost |
|---|---|
| One-time Setup | ₹2,617 – ₹3,117 *(paid at launch)* |
| VM Hosting (CX23 + backup) | ~₹536/month |
| WhatsApp API (base) | ~₹305/month |
| WhatsApp API (with marketing) | ~₹407/month |
| **Total (without marketing)** | **~₹841/month** |
| **Total (with marketing, 100 users)** | **~₹943/month** |

---

## Part A — Infrastructure & Hosting Costs

### A1. One-time Setup Costs

| Item | Cost | Notes |
|---|---|---|
| Domain Name | ₹117 | GoDaddy — ₹99 + 18% GST (Year 1 rate) |
| Development Fee | ₹2,500 – ₹3,000 | Agentic AI |
| Meta Business Verification | ₹0 | Requires GST / Udyam documents |
| Payment Gateway (PhonePe) | ₹0 | UPI-only promotional offer |
| SSL Certificate | ₹0 | Free via Let's Encrypt + Certbot |
| **Total** | **₹2,617 – ₹3,117** | Paid once at launch |

---

### A2. Monthly Hosting Costs

**Recommended server:** Hetzner Cloud **CX23** (Germany/Finland region)

| Spec | Value |
|---|---|
| vCPUs | 2 (x86 — Intel/AMD) |
| RAM | 4 GB |
| Storage | 40 GB NVMe SSD |
| Included Traffic | 20 TB/month |
| Price (post April 2026) | €3.99/month ≈ **₹447/month** |
| Automated Backups (+20%) | €0.80/month ≈ **₹90/month** |
| **Total Hosting** | **~₹537/month** |

> Backend (Node.js) and PostgreSQL database run on the **same VM**. No separate database cost.
> x86 architecture ensures full compatibility with all Node.js packages, PostgreSQL, PM2, and Nginx.

**All other infrastructure services are free:**

| Service | Provider | Cost |
|---|---|---|
| Frontend Hosting | Vercel (free tier) | ₹0 |
| File & Image Storage | Cloudflare R2 (free: 10 GB / 10M reads) | ₹0 |
| DNS + CDN + DDoS Protection | Cloudflare (free tier) | ₹0 |
| Analytics & Error Monitoring | PostHog / Sentry (free tier) | ₹0 |
| SSL Certificate | Let's Encrypt via Certbot | ₹0 |
| Process Manager | PM2 | ₹0 |
| Reverse Proxy | Nginx | ₹0 |

---

## Part B — WhatsApp API Costs (Meta Cloud API)

All rates include **18% GST**. Estimates based on **900 bookings/month (maximum capacity)**.

### B1. Per-Message Rates

| Message Type | Rate (incl. GST) | Pre-GST Rate | Used For |
|---|---|---|---|
| Authentication | ₹0.1357 / msg | ₹0.1150 | OTP / login verification |
| Utility | ₹0.1357 / msg | ₹0.1150 | Booking confirmations, reminders |
| Marketing / Promotional | ₹1.0185 / msg | ₹0.8631 | Offers, broadcasts, re-engagement |
| Service (Inbound) | **Free** | — | User-initiated replies |

> **Cost tip:** Utility messages sent within a **24-hour Customer Service Window (CSW)** — when the user messages first — are charged at **₹0**.

---

### B2. Monthly Base Cost (Auth + Utility only)

| Message Type | Volume / Month | Rate | Cost |
|---|---|---|---|
| Authentication (OTP) | ~1,350 | ₹0.1357 | ~₹183 |
| Utility (Confirmations) | ~900 | ₹0.1357 | ~₹122 |
| **Monthly Base Total** | **2,250 messages** | | **~₹305/month** |

---

### B3. Marketing / Promotional Costs *(Optional, per campaign)*

| Audience Size | Cost per Campaign |
|---|---|
| 100 users | ~₹102 |
| 250 users | ~₹255 |
| 500 users | ~₹509 |
| 1,000 users | ~₹1,019 |

- Template creation and storage is **free** — unlimited templates at no cost
- Templates are typically approved by Meta within a few minutes
- This is not a fixed monthly cost — only charged when a campaign is sent

**Recommended template types:**
- Festival offers (Diwali, Holi, etc.)
- Weekend or seasonal discounts
- Re-engagement for inactive players
- New court / facility announcements
- Membership renewal reminders

---

## Part C — Combined Total Cost

### C1. Monthly Cost Breakdown

| Component | Cost |
|---|---|
| **A — VM Hosting (CX23)** | ~₹447 |
| **A — Automated Backups** | ~₹90 |
| **B — WhatsApp (base)** | ~₹305 |
| **Total (without marketing)** | **~₹842/month** |
| **B — WhatsApp (with marketing, 100 users)** | +₹102 |
| **Total (with marketing)** | **~₹944/month** |

---

### C2. Year 1 Projection

| Component | Cost |
|---|---|
| One-time Setup | ₹3,117 |
| Hosting + Backups — 12 months (~₹537 × 12) | ~₹6,444 |
| WhatsApp Base — 12 months (~₹305 × 12) | ~₹3,660 |
| **Year 1 Total (without marketing)** | **~₹13,221** |
| Marketing (100 users/month × 12) | +~₹1,224 |
| **Year 1 Total (with marketing)** | **~₹14,445** |

---

### C3. Year 2 Onwards

| Component | Cost |
|---|---|
| Domain Renewal (GoDaddy) | ~₹1,061 |
| Hosting + Backups — 12 months (~₹537 × 12) | ~₹6,444 |
| WhatsApp Base — 12 months (~₹305 × 12) | ~₹3,660 |
| **Year 2 Total (without marketing)** | **~₹11,165** |
| Marketing (100 users/month × 12) | +~₹1,224 |
| **Year 2 Total (with marketing)** | **~₹12,389** |

---

## Key Assumptions

| Parameter | Value |
|---|---|
| Max bookings per month | 900 |
| OTP messages per booking | ~1.5 (includes re-sends) |
| Confirmation messages per booking | 1 |
| Server | Hetzner CX23 — 2 vCPU, 4 GB RAM, 40 GB SSD |
| Hosting cost | €3.99/month (post April 2026 pricing) |
| EUR to INR rate | ₹112 per €1 (May 2026) |
| Backups | Hetzner automated backups (+20% = ~₹90/month) |
| Backend + Database | Hosted on the same VM |
| Payment gateway fee | ₹0 (PhonePe UPI promo) |
| Domain renewal (Year 2+) | ~₹1,061/year |
