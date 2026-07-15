# Baseline Arena — Infrastructure Setup Guide

**Prepared by:** Manish Borikar
**Purpose:** Step-by-step guide to purchase and configure all services for the Baseline Arena platform.
**Deployment tool:** Dokploy (server management) + Cloudflare Pages (frontend)
**Total estimated time:** 2–3 hours (first-time setup)

---

## Services Overview

| Service | Purpose | Cost | Official Link |
|---|---|---|---|
| GoDaddy | Domain name | ₹117/year | https://www.godaddy.com |
| Hetzner Cloud | VM — backend + database only | ~₹537/month | https://www.hetzner.com/cloud |
| Dokploy | Server deployment & management | Free | https://dokploy.com |
| Cloudflare | DNS, CDN, DDoS, R2 storage, frontend hosting | Free | https://www.cloudflare.com |
| Meta Cloud API | WhatsApp messaging | Pay-per-use | https://developers.facebook.com/docs/whatsapp/cloud-api |
| PhonePe PG | Payment gateway | Free (UPI promo) | https://developer.phonepe.com |

> **Frontend note:** The frontend is hosted on **Cloudflare Pages** — not on the Hetzner server. This serves assets from Cloudflare's Indian edge nodes (Mumbai, Chennai), making the frontend near-instant for Indian users, while keeping the server fully dedicated to the API and database.

---

## Architecture Overview

```
User (India)
    │
    ├──► Cloudflare Pages (Frontend — served from Indian edge)
    │
    └──► Cloudflare CDN/Proxy
              │
              └──► Hetzner CX23, Germany
                        ├── Dokploy
                        ├── Node.js API
                        └── PostgreSQL
```

---

## Step 1 — Buy a Domain on GoDaddy

**Link:** https://www.godaddy.com
**Cost:** ₹117 (₹99 + 18% GST) — Year 1 promotional rate

1. Go to https://www.godaddy.com
2. Search for your domain (e.g., `baselinearena.in` or `.com`)
3. Add to cart → checkout — **skip all extras** (email, privacy, etc.)
4. Complete payment
5. After purchase, go to **My Products → DNS** — you'll update nameservers in Step 3

> **Tip:** `.in` domains are cheaper and work well for an India-based platform.

---

## Step 2 — Create a Hetzner Account & Launch Your VM

**Link:** https://www.hetzner.com/cloud
**Docs:** https://docs.hetzner.com/cloud
**Cost:** €3.99/month ≈ ₹447/month (CX23, Germany/Finland)

### 2.1 Create Account
1. Go to https://www.hetzner.com/cloud and click **Get Started**
2. Sign up and verify your email
3. Add a payment method (international credit/debit card accepted)

### 2.2 Create a Project
1. In the Hetzner Cloud Console, click **+ New Project**
2. Name it `baseline-arena`

### 2.3 Create the Server (VM)
1. Inside the project, click **+ Add Server**
2. Configure as follows:

| Setting | Selection |
|---|---|
| **Location** | Nuremberg or Helsinki (Germany / Finland) |
| **Image** | Ubuntu 24.04 LTS |
| **Type** | Shared vCPU → x86 → **CX23** (€3.99/month) |
| **Networking** | Enable IPv4 and IPv6 |
| **SSH Keys** | Add your SSH public key |
| **Backups** | ✅ Enable Automated Backups (+20% ≈ ₹90/month) |
| **Name** | `baseline-arena-server` |

3. Click **Create & Buy Now**
4. Note down the server's **public IP address**

> **Docs:** https://docs.hetzner.com/cloud/servers/getting-started/creating-a-server

### 2.4 Set Up a Firewall
1. Go to **Firewalls → Create Firewall** in the left panel
2. Add the following inbound rules:

| Protocol | Port | Purpose |
|---|---|---|
| TCP | 22 | SSH |
| TCP | 80 | HTTP |
| TCP | 443 | HTTPS |
| TCP | 3000 | Dokploy dashboard (restrict after setup) |

3. Apply the firewall to your server

> **Docs:** https://docs.hetzner.com/cloud/firewalls/getting-started/creating-a-firewall

---

## Step 3 — Set Up Cloudflare (DNS, CDN, Storage & Frontend)

**Link:** https://www.cloudflare.com
**Cost:** Free

### 3.1 Create a Cloudflare Account
1. Go to https://www.cloudflare.com and click **Sign Up**
2. Enter your email and create a password

### 3.2 Add Your Domain to Cloudflare
1. In the Cloudflare dashboard, click **Add a Site**
2. Enter your domain and select the **Free plan**
3. Add the following DNS records:

| Type | Name | Content | Proxy | Purpose |
|---|---|---|---|---|
| A | `api` | `<your Hetzner IP>` | Proxied ☁️ | Backend API |

> The root domain (`@`) and `www` will be handled by Cloudflare Pages in Step 6 — do not add A records for them here.

4. Cloudflare will give you **two nameservers**
5. Go to GoDaddy → **My Products → DNS → Nameservers → Change** → enter Cloudflare's nameservers
6. DNS propagation takes 5–30 minutes

> **Docs:** https://developers.cloudflare.com/dns/zone-setups/full-setup/setup

### 3.3 Set Up Cloudflare R2 (File Storage)
1. In Cloudflare dashboard, go to **R2 Object Storage → Create bucket**
2. Name it `baseline-arena-uploads`
3. Go to **R2 → Manage R2 API Tokens → Create API Token**
4. Save the **Access Key ID** and **Secret Access Key** for environment variables

> **Docs:** https://developers.cloudflare.com/r2/get-started

---

## Step 4 — Install Dokploy on Your Server

**Docs:** https://docs.dokploy.com/docs/core
**Cost:** Free

### 4.1 SSH Into Your Server
```bash
ssh root@<your-hetzner-ip>
```

### 4.2 Run the Dokploy Installer
```bash
curl -sSL https://dokploy.com/install.sh | sh
```

This single command automatically:
- Installs Docker
- Sets up Traefik (reverse proxy + automatic SSL)
- Starts the Dokploy dashboard on port 3000

### 4.3 Access the Dashboard
1. Open: `http://<your-hetzner-ip>:3000`
2. Create your **admin account** (email + password)
3. Save these credentials securely

> **Docs:** https://docs.dokploy.com/docs/core/get-started/installation

---

## Step 5 — Deploy Backend & Database via Dokploy

### 5.1 Connect GitHub
1. In Dokploy, go to **Settings → Git Providers → Add GitHub**
2. Complete the OAuth flow to connect your GitHub account

> **Docs:** https://docs.dokploy.com/docs/core/git-providers/github

### 5.2 Create a Project
1. Go to **Projects → Create Project**
2. Name it `Baseline Arena`

### 5.3 Deploy the Backend (Node.js API)
1. Inside the project, click **Create Service → Application**
2. Select **GitHub** and pick your backend repository
3. Dokploy auto-detects Node.js — confirm build settings
4. Set the **port** your app listens on (e.g., `3000`)
5. Under **Environment Variables**, add all required variables (see checklist below)
6. Under **Domains**, add `api.baselinearena.in` — SSL is issued automatically
7. Click **Deploy**

> **Docs:** https://docs.dokploy.com/docs/core/applications/overview

### 5.4 Create the PostgreSQL Database
1. Inside the project, click **Create Service → Database → PostgreSQL**
2. Set a database name, username, and strong password
3. Click **Create**
4. Copy the **internal connection string** and add it as `DATABASE_URL` in your app's environment variables

> **Docs:** https://docs.dokploy.com/docs/core/databases/postgresql

### 5.5 Enable Database Backups
1. In the database service, go to **Backups**
2. Enable and schedule daily backups (e.g., 2 AM)
3. Optionally connect Cloudflare R2 as the backup destination

> **Docs:** https://docs.dokploy.com/docs/core/databases/backups

### 5.6 Set Up Auto-Deploy from GitHub
1. In your app service, go to **Deployments → Webhooks** and copy the webhook URL
2. In GitHub, go to your repo → **Settings → Webhooks → Add webhook** → paste the URL
3. Every push to your main branch now triggers an automatic deployment

---

## Step 6 — Deploy Frontend on Cloudflare Pages

**Link:** https://pages.cloudflare.com
**Docs:** https://developers.cloudflare.com/pages
**Cost:** Free (unlimited bandwidth, global CDN including Indian edge nodes)

### 6.1 Connect Your Repository
1. In Cloudflare dashboard, go to **Workers & Pages → Create → Pages**
2. Click **Connect to Git** and authorize Cloudflare to access your GitHub account
3. Select your **frontend repository**

### 6.2 Configure Build Settings
Set the build settings for the Next.js App Router frontend:

- **Framework preset**: `Next.js`
- **Build command**: `npm run build`
- **Output directory**: `.next` (or `.vercel/output/static` for static/adapter outputs)

### 6.3 Add Environment Variables
1. Under **Environment Variables**, add the API base URL and other required variables:
   - `NEXT_PUBLIC_API_BASE_URL=https://api.baselinearena.in`
   - `NEXT_PUBLIC_MAPTILER_KEY=<your_maptiler_api_key>`
   - `NEXT_PUBLIC_PHONEPE_ENV=PRODUCTION`
2. Click **Save and Deploy**

### 6.4 Connect Your Custom Domain
1. After deployment, go to **Custom Domains → Set up a custom domain**
2. Enter your domain (e.g., `baselinearena.in`)
3. Cloudflare Pages automatically configures the DNS — no manual records needed since your domain is already on Cloudflare
4. SSL is issued and managed automatically

> **Docs:** https://developers.cloudflare.com/pages/configuration/custom-domains

---

## Step 7 — Set Up WhatsApp Cloud API (Meta)

**Link:** https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
**Cost:** Pay-per-message (see Costing Analysis)

1. Go to https://developers.facebook.com → **My Apps → Create App → Business**
2. Add the **WhatsApp** product to your app
3. Use the free test number under **WhatsApp → Getting Started** for development
4. For production, complete **Meta Business Verification:**
   - Go to https://business.facebook.com → **Business Settings → Security Centre**
   - Submit GST certificate or Udyam registration document
5. Once verified, go to **WhatsApp → Phone Numbers → Add phone number**
6. Set up a **Meta billing account** with a prepaid balance
7. Note your **Phone Number ID** and **Access Token** — add to Dokploy environment variables

> **Pricing:** https://developers.facebook.com/docs/whatsapp/pricing

---

## Step 8 — Set Up PhonePe Payment Gateway

**Link:** https://developer.phonepe.com
**Cost:** ₹0 (UPI-only promotional offer)

1. Go to https://developer.phonepe.com and register as a merchant
2. Complete KYC with your GST / Udyam documents
3. Get your **Merchant ID** and **API Key** from the dashboard
4. Test in the sandbox environment before going live
5. Add live credentials to Dokploy environment variables

> **Docs:** https://developer.phonepe.com/v1/docs



---

## Environment Variables Checklist

**Backend — add in Dokploy → Application → Environment Variables:**
```
# Database (from Dokploy PostgreSQL service)
DATABASE_URL=postgresql://arena_user:your_password@localhost:5432/baseline_arena

# WhatsApp (Meta Cloud API)
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=

# Cloudflare R2 (File Storage)
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=baseline-arena-uploads
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com

# PhonePe
PHONEPE_MERCHANT_ID=
PHONEPE_API_KEY=

# App
NODE_ENV=production
PORT=3000
```

**Frontend — add in Cloudflare Pages → Settings → Environment Variables:**
```
NEXT_PUBLIC_API_BASE_URL=https://api.baselinearena.in
NEXT_PUBLIC_MAPTILER_KEY=your_maptiler_api_key_here
NEXT_PUBLIC_PHONEPE_ENV=PRODUCTION
```

---

## Full Setup Checklist

**Domain & DNS**
- [ ] Domain purchased on GoDaddy
- [ ] Cloudflare account created and domain added
- [ ] GoDaddy nameservers updated to Cloudflare
- [ ] DNS A record for `api` pointing to Hetzner IP (Cloudflare proxied)

**Server**
- [ ] Hetzner account created and CX23 server launched (Ubuntu 24.04)
- [ ] Hetzner firewall configured (ports 22, 80, 443, 3000)
- [ ] Automated backups enabled on Hetzner
- [ ] Dokploy installed via install script
- [ ] Dokploy admin account created

**Backend (via Dokploy)**
- [ ] GitHub connected in Dokploy
- [ ] Project created in Dokploy
- [ ] Node.js backend deployed and running
- [ ] `api.baselinearena.in` domain added with SSL auto-issued
- [ ] PostgreSQL database created
- [ ] Database backups scheduled
- [ ] GitHub webhook configured for auto-deploy
- [ ] All backend environment variables added

**Frontend (via Cloudflare Pages)**
- [ ] Frontend repository connected to Cloudflare Pages
- [ ] Build settings configured
- [ ] Frontend environment variables added
- [ ] Custom domain connected and SSL issued

**Storage**
- [ ] Cloudflare R2 bucket created
- [ ] R2 API token generated and saved

**Payments & Messaging**
- [ ] Meta Business Verification completed
- [ ] WhatsApp Cloud API phone number added and billing configured
- [ ] PhonePe merchant account approved (KYC done)


