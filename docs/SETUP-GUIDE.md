# Baseline Arena — Infrastructure Setup Guide

**Prepared by:** Manish Borikar (Agentic AI)
**Purpose:** Step-by-step guide to purchase and configure all services for the Baseline Arena platform.
**Total estimated time:** 3–4 hours (first-time setup)

---

## Services Overview

| Service | Purpose | Cost | Official Link |
|---|---|---|---|
| GoDaddy | Domain name | ₹117/year | https://www.godaddy.com |
| Hetzner Cloud | VM (backend + database) | ~₹537/month | https://www.hetzner.com/cloud |
| Cloudflare | DNS, CDN, DDoS, R2 storage | Free | https://www.cloudflare.com |
| Vercel | Frontend hosting | Free | https://vercel.com |
| Meta Cloud API | WhatsApp messaging | Pay-per-use | https://developers.facebook.com/docs/whatsapp/cloud-api |
| PhonePe PG | Payment gateway | Free (UPI promo) | https://developer.phonepe.com |

---

## Step 1 — Buy a Domain on GoDaddy

**Link:** https://www.godaddy.com
**Cost:** ₹117 (₹99 + 18% GST) — Year 1 promotional rate

1. Go to https://www.godaddy.com
2. Search for your domain name (e.g., `baselinearena.in` or `.com`)
3. Add to cart and proceed to checkout
4. Create a GoDaddy account or log in
5. Complete payment — **do not purchase any extras** (email, privacy protection, etc. — not needed)
6. Once purchased, go to **My Products → DNS** — you will update DNS records here in Step 3

> **Tip:** `.in` domains are cheaper and work well for an India-based platform.

---

## Step 2 — Create a Hetzner Account & Launch Your VM

**Link:** https://www.hetzner.com/cloud
**Docs:** https://docs.hetzner.com/cloud
**Cost:** €3.99/month ≈ ₹447/month (CX23, Germany/Finland)

### 2.1 Create Account
1. Go to https://www.hetzner.com/cloud and click **Get Started**
2. Sign up with your email address
3. Verify your email
4. Add a payment method (credit/debit card — Hetzner accepts international cards)

### 2.2 Create a Project
1. In the Hetzner Cloud Console, click **+ New Project**
2. Name it `baseline-arena`

### 2.3 Create the Server (VM)
1. Inside the project, click **+ Add Server**
2. Configure as follows:

| Setting | Selection |
|---|---|
| **Location** | Nuremberg or Helsinki (Germany/Finland) |
| **Image** | Ubuntu 24.04 LTS |
| **Type** | Shared vCPU → **x86** → **CX23** (€3.99/month) |
| **Networking** | Enable both IPv4 and IPv6 |
| **SSH Keys** | Add your SSH public key (recommended) |
| **Backups** | ✅ Enable Automated Backups (+20% = ~₹90/month) |
| **Name** | `baseline-arena-server` |

3. Click **Create & Buy Now**
4. Note down the **server's public IP address** — you will need it in the next steps

> **Docs:** https://docs.hetzner.com/cloud/servers/getting-started/creating-a-server

### 2.4 Set Up a Firewall
1. In the left panel, go to **Firewalls → Create Firewall**
2. Allow the following inbound rules:

| Protocol | Port | Description |
|---|---|---|
| TCP | 22 | SSH |
| TCP | 80 | HTTP |
| TCP | 443 | HTTPS |

3. Apply the firewall to your server

> **Docs:** https://docs.hetzner.com/cloud/firewalls/getting-started/creating-a-firewall

---

## Step 3 — Set Up Cloudflare (DNS, CDN & Storage)

**Link:** https://www.cloudflare.com
**Cost:** Free

### 3.1 Create a Cloudflare Account
1. Go to https://www.cloudflare.com and click **Sign Up**
2. Enter your email and create a password

### 3.2 Add Your Domain to Cloudflare
1. In the Cloudflare dashboard, click **Add a Site**
2. Enter your domain name (e.g., `baselinearena.in`)
3. Select the **Free plan**
4. Cloudflare will scan existing DNS records automatically
5. Add an **A record** pointing to your Hetzner server IP:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | `<your Hetzner IP>` | Proxied (orange cloud) |
| A | `www` | `<your Hetzner IP>` | Proxied (orange cloud) |
| A | `api` | `<your Hetzner IP>` | Proxied (orange cloud) |

6. Cloudflare will give you **two nameservers** (e.g., `ns1.cloudflare.com`, `ns2.cloudflare.com`)
7. Go back to GoDaddy → **My Products → DNS → Nameservers → Change**
8. Enter Cloudflare's nameservers and save
9. DNS propagation takes **5–30 minutes**

> **Docs:** https://developers.cloudflare.com/dns/zone-setups/full-setup/setup

### 3.3 Set Up Cloudflare R2 (File Storage)
1. In Cloudflare dashboard, go to **R2 Object Storage → Create bucket**
2. Name the bucket `baseline-arena-uploads`
3. Go to **R2 → Manage R2 API Tokens → Create API Token**
4. Save the **Access Key ID** and **Secret Access Key** — you will add them to your app's environment variables

> **Docs:** https://developers.cloudflare.com/r2/get-started

---

## Step 4 — Configure the Server

SSH into your server:
```bash
ssh root@<your-hetzner-ip>
```

### 4.1 Install Node.js (via NodeSource)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v   # should show v20.x
```
> **Docs:** https://github.com/nodesource/distributions

### 4.2 Install PostgreSQL
```bash
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql
```

Create the database and user:
```bash
sudo -u postgres psql
CREATE DATABASE baseline_arena;
CREATE USER arena_user WITH PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE baseline_arena TO arena_user;
\q
```
> **Docs:** https://www.postgresql.org/docs/current/tutorial-install.html

### 4.3 Install Nginx (Reverse Proxy)
```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

Create a config file for your app:
```bash
nano /etc/nginx/sites-available/baseline-arena
```

Paste the following:
```nginx
server {
    listen 80;
    server_name api.baselinearena.in;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and reload:
```bash
ln -s /etc/nginx/sites-available/baseline-arena /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```
> **Docs:** https://nginx.org/en/docs/beginners_guide.html

### 4.4 Install SSL Certificate (Let's Encrypt)
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.baselinearena.in
```
Follow the prompts. Certbot auto-renews the certificate every 90 days.

> **Docs:** https://certbot.eff.org/instructions

### 4.5 Install PM2 (Process Manager)
```bash
npm install -g pm2
pm2 start app.js --name "baseline-arena"
pm2 save
pm2 startup   # follow the command it outputs to auto-start on reboot
```
> **Docs:** https://pm2.keymetrics.io/docs/usage/quick-start

---

## Step 5 — Deploy Frontend on Vercel

**Link:** https://vercel.com
**Cost:** Free

1. Go to https://vercel.com and sign up with your GitHub account
2. Click **Add New → Project**
3. Import your frontend repository from GitHub
4. Set your **Environment Variables** (API URL, etc.) under **Project Settings → Environment Variables**
5. Click **Deploy**
6. Go to **Project Settings → Domains** and add your custom domain (e.g., `baselinearena.in`)
7. Vercel will provide DNS records — add them in Cloudflare

> **Docs:** https://vercel.com/docs/getting-started-with-vercel

---

## Step 6 — Set Up WhatsApp Cloud API (Meta)

**Link:** https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
**Cost:** Pay-per-message (see Costing Analysis)

1. Go to https://developers.facebook.com and log in with your Facebook/Meta account
2. Click **My Apps → Create App → Business**
3. Add the **WhatsApp** product to your app
4. Go to **WhatsApp → Getting Started** — Meta provides a free test number to start
5. For production, complete **Meta Business Verification:**
   - Go to https://business.facebook.com → **Business Settings → Security Centre**
   - Submit GST certificate or Udyam registration document
6. Once verified, add a real phone number under **WhatsApp → Phone Numbers → Add phone number**
7. Set up a **Meta Pay / billing account** to add a prepaid balance for message charges
8. Note your **Phone Number ID** and **Access Token** — add these to your app's environment variables

> **Docs:** https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
> **Pricing:** https://developers.facebook.com/docs/whatsapp/pricing

---

## Step 7 — Set Up PhonePe Payment Gateway

**Link:** https://developer.phonepe.com
**Cost:** ₹0 (UPI-only promotional offer)

1. Go to https://developer.phonepe.com and register as a merchant
2. Complete KYC with your business documents (GST / Udyam)
3. Get your **Merchant ID** and **API Key** from the dashboard
4. Use the **sandbox environment** for testing before going live
5. Once approved for production, update your app's environment variables with live credentials

> **Docs:** https://developer.phonepe.com/v1/docs

---

## Step 8 — Set Up PostHog (Analytics)

**Link:** https://posthog.com
**Cost:** Free (up to 1M events/month)

1. Go to https://posthog.com and sign up
2. Create a new project — name it `Baseline Arena`
3. Copy your **Project API Key**
4. Add the PostHog SDK to your frontend and backend as per the docs

> **Docs:** https://posthog.com/docs

---

## Environment Variables Checklist

Once everything is set up, your app needs the following environment variables on the server:

```
# Database
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

# PostHog
POSTHOG_API_KEY=

# App
NODE_ENV=production
PORT=3000
```

---

## Setup Checklist

- [ ] Domain purchased on GoDaddy
- [ ] Hetzner account created and CX23 server launched
- [ ] Hetzner firewall configured (ports 22, 80, 443)
- [ ] Automated backups enabled on Hetzner
- [ ] Cloudflare account created and domain added
- [ ] DNS A records pointing to Hetzner server IP
- [ ] GoDaddy nameservers updated to Cloudflare
- [ ] Cloudflare R2 bucket created
- [ ] Node.js installed on server
- [ ] PostgreSQL installed and database created
- [ ] Nginx installed and configured as reverse proxy
- [ ] SSL certificate issued via Let's Encrypt
- [ ] PM2 installed and app running
- [ ] Frontend deployed on Vercel
- [ ] Custom domain connected on Vercel
- [ ] Meta Business Verification completed
- [ ] WhatsApp Cloud API phone number added
- [ ] PhonePe merchant account approved
- [ ] All environment variables set on server
- [ ] PostHog analytics connected
