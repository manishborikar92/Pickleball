# AI Project Context — System & Technical Architecture

This document outlines the headless architectural boundaries, data flow routes, and deployment topology of the Pickleball Booking Platform.

---

## 1. System Topology (Headless Model)

The platform follows a strict **headless architecture**. The Next.js frontend communicates exclusively with the Express.js API backend via REST.

```
                  [ User Browser / Mobile Client ]
                                 │
                                 ├── (Serves static components & UI pages)
                                 ▼
                     [ Cloudflare Pages CDN ]
                                 │
                                 ├── (API Requests over HTTPS)
                                 ▼
                    [ Express.js REST API Server ]
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
   [ PostgreSQL ]        [ PhonePe SDK ]        [ WhatsApp Meta API ]
 (Primary database)     (Payment checkouts)      (OTP confirmations)
```

### 1.1 Separation of Concerns
* **Next.js Frontend (`/web`)**: Serves the public landing page, interactive court selection calendar, authentication forms, and booking receipts. The frontend is stateless; it never computes slot prices, holds, or status states.
* **Express.js API Backend (`/server`)**: Holds the database client, executes pricing waterfalls, verifies OTP validity, locks row-level slots, issues JWTs, handles PhonePe payment webhooks, and connects to Cloudflare R2 bucket storage.

---

## 2. Infrastructure & Deployment Model

The platform is designed to deploy across three cost-efficient, production-grade cloud tiers:

```
[ User India ] 
     │
     ├─► [ Cloudflare Pages ] (Frontend hosted on edge nodes)
     │
     └─► [ Cloudflare Proxy/CDN ] (IP protection and SSL termination)
               │
               ▼
         [ Hetzner Cloud VM ] (CX23 instance in Germany/Finland)
               ├── Dokploy (Container manager and reverse proxy)
               ├── Express Node.js Server (Port 5000)
               └── PostgreSQL Database (Port 5432)
```

### 2.1 Service Breakdown
* **Cloudflare Pages**: Static frontend hosting. Near-instant load times in India due to Cloudflare's regional edge network.
* **Hetzner CX23 VM**: Host VM running Ubuntu 24.04 LTS. Runs both the Express backend and PostgreSQL database inside Docker containers managed by **Dokploy**.
* **Cloudflare R2**: S3-compatible object storage used for uploads (e.g. court images and future review uploads).
* **Meta Cloud API**: External API communicating with Meta WhatsApp services to deliver customer OTP messages.
* **PhonePe Gateway**: External API handling UPI payment redirects and transaction status webhook updates.

---

## 3. Data Flow Boundaries

1. **Authentication Boundary**: Public users can query operating hours and court slot availability without authentication. A JWT is required only when holds are placed or when accessing booking histories and wallets.
2. **Transaction Boundary**: The pricing waterfall is triggered server-side. The price quoted is locked into the booking record before being signed and passed to the PhonePe API.
3. **Webhook Boundary**: The backend listens to PhonePe transaction updates at `/api/v1/payments/webhook`. Payment updates are verified using request header checksum signatures before mutating booking state.
