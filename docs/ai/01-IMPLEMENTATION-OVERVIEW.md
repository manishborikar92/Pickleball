# 01-IMPLEMENTATION-OVERVIEW

This document provides a concise implementation snapshot of the Pickleball booking platform.

## 1. Major Domains & Modules
The platform is split into two primary applications:

### A. Next.js Frontend (`web/`)
- Implements route-group routing to isolate customer dashboards, authentication views, public landing/booking pages, and staff admin portals.
- Requests are intercepted by an edge `proxy.js` mapping session cookies to backend headers.

### B. Express Backend (`server/`)
- Implements a modular domain structure under `src/modules/`.
- Each module groups route registries, validator schemas, service engines, and repositories.
- Database access is abstracted via the Prisma client mapping to PostgreSQL.

---

## 2. Major Integrations
- **WhatsApp Cloud API**: Direct HTTP integration. Used to deliver customer OTP messages and transaction confirmations.
- **PhonePe Payment Gateway**: Integrated via direct API checkouts. Redirects users to hosted checkout views and validates webhook notifications.
- **Cloudflare R2**: Used to store and serve court layout assets.

---

## 3. High-Level Implementation Summary
- **Booking Flow**: The frontend interfaces with the backend to retrieve real-time slot availability, allowing users to select slots, authenticate via modal popup if required, and initiate checkout.
- **Onboarding Flow**: Handled at the edge. Authenticated users without completed profiles are redirected to onboarding before accessing dashboards.

