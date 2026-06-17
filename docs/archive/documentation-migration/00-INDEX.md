# Product Specifications Index

This directory contains the business specifications, user journeys, setup guides, and operational details of the Pickleball Booking Platform.

---

## 1. Documentation Index

| File | Purpose | Cross-Reference Link |
|:---|:---|:---|
| **01-PROJECT-OVERVIEW.md** | Core business scope (Nagpur Besa facility, 2 courts), MVP vs. Deferred features lists. | [01-PROJECT-OVERVIEW.md](01-PROJECT-OVERVIEW.md) |
| **02-SETUP-GUIDE.md** | Step-by-step infrastructure provisioning checklist (GoDaddy, Hetzner VM, Dokploy setup). | [02-SETUP-GUIDE.md](02-SETUP-GUIDE.md) |
| **03-DATABASE-SCHEMA.md** | Database fields definition, data types, and logical requirements in prose. | [03-DATABASE-SCHEMA.md](03-DATABASE-SCHEMA.md) |
| **04-BUSINESS-LOGIC.md** | Deep business rules, OTP lifetime, slot lock duration (10 min), pricing logic waterfalls, and RBAC matrix. | [04-BUSINESS-LOGIC.md](04-BUSINESS-LOGIC.md) |
| **05-UI-UX-SPECIFICATION.md** | Frontend visual standards, font sizes, calendar grids layout, and styling parameters. | [05-UI-UX-SPECIFICATION.md](05-UI-UX-SPECIFICATION.md) |
| **06-API-SPECIFICATION.md** | Target API endpoint designs for booking, wallets, reviews, and admin overrides. | [06-API-SPECIFICATION.md](06-API-SPECIFICATION.md) |
| **07-WHATSAPP-INTEGRATION.md**| WhatsApp message template shapes, delivery hooks, and OTP providers setups. | [07-WHATSAPP-INTEGRATION.md](07-WHATSAPP-INTEGRATION.md) |
| **08-PAYMENT-INTEGRATION.md** | PhonePe UPI integration checkouts redirect flows and webhook checksum sign verification protocols. | [08-PAYMENT-INTEGRATION.md](08-PAYMENT-INTEGRATION.md) |
| **10-COSTING-ANALYSIS.md** | Monthly and yearly expense projections (Server VM, WhatsApp OTP deliveries, domains, SSL). | [10-COSTING-ANALYSIS.md](10-COSTING-ANALYSIS.md) |
| **11-FUTURE-WORK.md** | Specifications for deferred features (WebSockets sync, Redis limits, reward elements). | [11-FUTURE-WORK.md](11-FUTURE-WORK.md) |

---

## 2. Complementary Technical Index
For technical implementation specifications, code layouts, and current database models, refer to the technical index page at [ai/00-INDEX.md](ai/00-INDEX.md).
For historical architecture decisions, refer to [ai/13-DECISION-HISTORY.md](ai/13-DECISION-HISTORY.md).
