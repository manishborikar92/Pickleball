# Baseline Arena — Database Operations Guide

**Author:** Infrastructure & Backend Engineering  
**Scope:** PostgreSQL Architecture, Local Container Setup, Prisma ORM, Migrations, Operations, and Production Deployments (Coolify / Self-Managed VM / Deployka)  
**Database Target:** PostgreSQL 18.x (Alpine)  

---

## 1. Architecture Overview

PostgreSQL is treated strictly as **external runtime infrastructure**, not as repository-managed application code.

### Architectural Principles
- **Separation of Concerns**: The application codebase contains only the Prisma schema, canonical migrations, and data access logic. It does not manage container lifecycles or host orchestration.
- **External Runtime**: Local development uses a standalone Docker container (`pickleball_db`) bound to the loopback interface (`127.0.0.1:5432`) with persistent named volume storage (`pickleball_postgres_data`).
- **Standardized Connectivity**: All runtime environments connect via the canonical `DATABASE_URL` environment variable.
- **No Repository Infrastructure Artifacts**: No `docker-compose.yml`, root `.env`, or root `.env.example` files exist in the application root for the database.
- **Target Parity**: The local Docker container (`postgres:18.6-alpine`) directly mirrors the future production topology where PostgreSQL runs as an independent database resource alongside the API service.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Host Machine / Production VM                                            │
│                                                                         │
│   ┌───────────────────────────┐         ┌───────────────────────────┐   │
│   │ Node.js / Express API     │         │ PostgreSQL 18.x Container │   │
│   │ (Prisma Client + PG)      │────────►│ (postgres:18.x-alpine)    │   │
│   │                           │ DATABASE│                           │   │
│   └───────────────────────────┘   _URL  └─────────────┬─────────────┘   │
│                                                       │                 │
│                                                       ▼                 │
│                                         ┌───────────────────────────┐   │
│                                         │ Persistent Named Volume   │   │
│                                         │ (mount: /var/lib/postgres)│   │
│                                         └───────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Local Development Database

### Container Specifications
- **Image**: `postgres:18.6-alpine` (official PostgreSQL 18 Alpine image)
- **Container Name**: `pickleball_db`
- **Port Mapping**: `127.0.0.1:5432:5432` (strictly bound to localhost loopback; not exposed on LAN or public interfaces)
- **Volume Mount**: `pickleball_postgres_data:/var/lib/postgresql`
  *(Note: Official `postgres:18+` container entrypoints require mounts targeting `/var/lib/postgresql` rather than `/var/lib/postgresql/data` to prevent directory conflict warnings during cluster initialization).*
- **Restart Policy**: `--restart no` (prevents background auto-starts upon machine reboot or Docker Desktop launch)

### Provisioning Command (One-Time Setup)
```powershell
docker run -d `
  --name pickleball_db `
  -e POSTGRES_DB=pickleball `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=<STRONG_LOCAL_PASSWORD> `
  -p 127.0.0.1:5432:5432 `
  -v pickleball_postgres_data:/var/lib/postgresql `
  --restart no `
  --health-cmd "pg_isready -U postgres -d pickleball" `
  --health-interval 5s `
  --health-timeout 5s `
  --health-retries 5 `
  postgres:18.6-alpine
```

### Day-to-Day Lifecycle Management
```powershell
# Start local database container
docker start pickleball_db

# Stop local database container
docker stop pickleball_db

# Inspect health and running status
docker ps -f name=pickleball_db

# Tail database logs
docker logs -f pickleball_db
```

---

## 3. Prisma & Database Configuration

### Database URL Specification
The backend reads database connectivity from `server/.env`:
```ini
DATABASE_ENABLED=true
DATABASE_URL=postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@localhost:5432/pickleball?sslmode=disable
```

### Connection Adapter & SSL/TLS Architecture (`server/src/lib/prisma.js`)
The API uses Prisma ORM 7 with the `@prisma/adapter-pg` driver delegating to `pg` (node-postgres v8.21.0):

#### 1. Security Distinctions
- **Transport Encryption**: Ensures that network traffic between Node.js and PostgreSQL is encrypted via TLS. Eavesdroppers cannot read plaintext queries or payloads.
- **Certificate Validation**: Verifies that the server certificate is cryptographically valid and signed by a trusted Certificate Authority (CA). Protects against untrusted certificates and MITM attacks.
- **CA Trust**: Confirms that the issuing CA chains up to a recognized authority (either Node.js's built-in Mozilla CA trust store or an explicit CA file).
- **Hostname Verification**: Confirms that the host name in the connection string matches the Common Name (CN) or Subject Alternative Name (SAN) in the certificate.

#### 2. Supported PostgreSQL `sslmode` Values in Connection Strings
- `?sslmode=disable`: Disables TLS entirely. Standard for local development (`127.0.0.1:5432`) and private Coolify internal Docker bridge networks where traffic never leaves the host kernel.
- `?sslmode=verify-full`: **Recommended for public/cloud databases** (AWS RDS, Neon, Supabase, external VMs). Requires TLS, validates the server certificate against trusted CAs, and verifies that the hostname matches the certificate SAN/CN.
- `?sslmode=verify-ca`: Requires TLS and validates the server certificate against the trusted CA, but skips hostname matching (useful for internal container hostnames or IP addresses that do not match the certificate's SAN).
- `?sslmode=require`: In libpq C semantics, this requires TLS but does **NOT** verify CA or hostname unless a root cert is provided. In node-postgres v8.x, `require` was treated as an alias for `verify-full` (with a deprecation warning preparing for libpq alignment in v9.0). To ensure unambiguous security across all drivers, use `verify-full` or `verify-ca` rather than bare `require`.
- `?sslmode=no-verify`: Enables TLS encryption but explicitly disables certificate validation (`rejectUnauthorized: false`). **Only** used when connecting to private, self-signed databases where a CA cannot be distributed, and NEVER used as a global default in application code.

#### 3. Custom / Private CA Trust (e.g. Self-Signed or Internal CAs)
If a database uses a private or internal CA, trust is established without compromising security:
- **Option 1 (Connection String)**: `?sslmode=verify-full&sslrootcert=/path/to/ca.crt` (or `sslmode=verify-ca` if hostname does not match).
- **Option 2 (Runtime Environment)**: Pass `NODE_EXTRA_CA_CERTS=/path/to/ca.crt` to the Node.js process, which automatically injects the certificate into Node's root CA store.

#### 4. Clean Application Code
`server/src/lib/prisma.js` contains zero hardcoded `rejectUnauthorized: false` bypasses and zero brittle hostname heuristics (`localhost`, `db`, `postgres`). SSL policy is driven strictly by the environment's `DATABASE_URL`.

### Prisma Schema (`server/prisma/schema.prisma`)
- Datasource provider: `postgresql`
- Generator client: `prisma-client-js` targeting custom export `./src/generated` and default `@prisma/client`.
- Engine type: Driver adapter (`@prisma/adapter-pg`).

---

## 4. Database Migrations

### Canonical Migration Architecture
Canonical Prisma migrations reside in `server/prisma/migrations/`. These files represent the immutable historical record of database schema changes and must **never** be squashed, rebased, or deleted without explicit team alignment.

### Migration Commands
```bash
cd server

# Validate schema syntax
npm exec prisma -- validate

# Generate Prisma Client models
npm run prisma:generate

# Verify status of applied vs pending migrations
npm exec prisma -- migrate status

# Apply pending migrations in development
npm run prisma:migrate

# Apply migrations in production / CI (non-interactive)
npm run prisma:deploy
```

---

## 5. Backup and Restore

### Creating Backups
Always generate backups prior to major schema updates or production deployments:
```powershell
# Plain SQL format (portable DDL + COPY data)
docker exec pickleball_db pg_dump -U postgres -d pickleball --clean --if-exists --no-owner --no-acl > C:\path\to\backups\backup_$(Get-Date -Format "yyyyMMdd").sql

# PostgreSQL custom binary archive (compressed with table TOC)
docker exec pickleball_db pg_dump -U postgres -d pickleball -Fc > C:\path\to\backups\backup_$(Get-Date -Format "yyyyMMdd").dump
```

### Strict Restoration Procedure
When restoring into a target database, always enforce strict error handling (`ON_ERROR_STOP=1`):
```powershell
# Plain SQL restore with zero tolerance for errors
Get-Content C:\path\to\backups\backup.sql | docker exec -i pickleball_db psql -v ON_ERROR_STOP=1 -U postgres -d pickleball

# Custom binary restore using pg_restore
docker exec -i pickleball_db pg_restore -U postgres -d pickleball --clean --if-exists --no-owner --no-acl /path/inside/container/backup.dump
```

---

## 6. Supabase → Local Migration History

In September 2026, the application database was fully migrated from Supabase (`aws-1-ap-northeast-1.pooler.supabase.com:5432`) to the local PostgreSQL 18.6 standalone container:
1. **Source Export**: The public schema was extracted non-destructively via the IPv4 session pooler, bypassing IPv6 routing constraints on the host. Unused Supabase infrastructure schemas (`auth`, `storage`, `realtime`, `vault`) were omitted.
2. **Strict Ingestion**: Data was restored into PostgreSQL 18.6 with `ON_ERROR_STOP=1`.
3. **Parity Verification**: Complete parity was achieved across:
   - **27 Base Tables**: Exact row counts verified across all application entities.
   - **18 Enums**: All enum labels and sort orders validated.
   - **283 Total Constraints**: 27 Primary Keys, 43 Foreign Keys, 21 Check Constraints, and 192 Not Null constraints.
   - **83 Indexes**: Including 7 partial indexes (`booking_slots_no_double_book`, `payments_one_initiated_payment_per_booking`, `active_refresh_tokens_session_idx`, `admin_credentials_pending_activation_idx`, `payments_initiated_idx`, `reward_instances_pending_expiry_idx`, `users_onboarding_incomplete_idx`).
   - **11 Prisma Migrations**: Synchronized with `_prisma_migrations`.
4. **Backup Preservation**: Validated export archives (`supabase_public_backup.dump` and `supabase_public_backup.sql`) were relocated to safe long-term host storage (`C:\Users\manis\Backups\Pickleball\`).

---

## 7. Coolify Production Deployment

In production, the platform runs on a dedicated Linux VM managed via Coolify.

### Architecture
Coolify manages both the Node.js API application and the PostgreSQL database as distinct resources:
```
Coolify Host VM
  ├── Docker Network (Coolify Internal Bridge)
  │     ├── Pickleball API Container
  │     └── Standalone PostgreSQL 18 Container
  └── Host Volume Storage (/var/lib/docker/volumes/...)
```

### Setup Steps
1. **Create Database Resource**:
   - In Coolify, select **New Resource → Database → PostgreSQL**.
   - Select version: **PostgreSQL 18** (major line).
   - Coolify assigns an internal service hostname and generates strong random credentials.
2. **Persistent Storage**:
   - Coolify mounts host persistent storage to `/var/lib/postgresql`. Do not alter this to `/data`.
3. **Application Connection & SSL Configurations**:
   - **Configuration A (Standard & Recommended — Internal Docker Network)**:
     Because both the API and database containers reside on the same private Docker bridge network inside the VM, port 5432 is not exposed publicly. SSL is disabled internally:
     ```ini
     DATABASE_URL=postgresql://<COOLIFY_PG_USER>:<COOLIFY_PG_PASSWORD>@<COOLIFY_INTERNAL_HOST>:5432/<COOLIFY_PG_DB>?sslmode=disable
     ```
   - **Configuration B (SSL Enabled with Coolify-Generated Certificates)**:
     When SSL is toggled on in Coolify, Coolify generates a self-signed server certificate. Because the internal hostname is a container UUID or local alias rather than a public domain, `verify-full` will fail hostname verification. The correct approaches are:
     * **With CA Validation**: Mount or copy the Coolify CA certificate into the API container and configure:
       `DATABASE_URL=postgresql://...?sslmode=verify-ca&sslrootcert=/certs/coolify-ca.crt` (or set `NODE_EXTRA_CA_CERTS=/certs/coolify-ca.crt`).
     * **Without CA Validation (Internal Only)**: If CA distribution is not feasible on the private network, use `?sslmode=no-verify` in the connection string.
   - Do not expose PostgreSQL port 5432 to the public internet.
4. **Coolify Automated Backups**:
   - Enable Coolify's native PostgreSQL backup feature (under Database Settings → Backups).
   - Configure recurring snapshots (e.g., daily at 02:00 UTC) with S3 or local disk storage retention. Do not rely solely on Docker volume persistence.
5. **Initial Data Seeding**:
   - Restore the verified SQL backup into the Coolify PostgreSQL instance using the internal CLI or temporary SSH tunnel:
     ```bash
     cat backup.sql | docker exec -i <coolify-postgres-container-id> psql -v ON_ERROR_STOP=1 -U <COOLIFY_PG_USER> -d <COOLIFY_PG_DB>
     ```
6. **Deployment Command**:
   - Set the application pre-deploy command to run migrations automatically:
     ```bash
     npm run prisma:deploy
     ```

---

## 8. Deployka Deployment Architecture

### Platform Capabilities
Deployka is a Platform-as-a-Service (PaaS) designed for hosting web applications, APIs, and bots. It does **not** provide managed, stateful PostgreSQL database clusters.

### Supported Architecture
If Deployka is utilized for hosting the Pickleball application:
1. **API Hosting**: The Node.js Express server is deployed on Deployka.
2. **Database Hosting**: PostgreSQL 18 is hosted externally (e.g., on a dedicated Hetzner/Coolify VM or managed PostgreSQL provider like AWS RDS or Neon).
3. **Configuration**:
   - Configure `DATABASE_URL` in Deployka's environment variable dashboard.
   - Enforce full TLS encryption with certificate and hostname validation (`?sslmode=verify-full`) across the public internet between Deployka and the external database.
   - Restrict database firewall access to Deployka's outbound IP ranges where possible.

---

## 9. Self-Managed VM Deployment (Alternative)

For manual Linux VM deployment (Ubuntu 24.04 LTS / Debian 12):

### 1. Standalone Docker Setup
Run the official PostgreSQL 18 container with a restart policy suitable for production servers (`always` or `unless-stopped`):
```bash
docker run -d \
  --name pickleball_postgres \
  --restart unless-stopped \
  -e POSTGRES_DB=pickleball_prod \
  -e POSTGRES_USER=pickleball_admin \
  -e POSTGRES_PASSWORD=<STRONG_GENERATED_SECRET> \
  -v pickleball_prod_pgdata:/var/lib/postgresql \
  -p 127.0.0.1:5432:5432 \
  --health-cmd "pg_isready -U pickleball_admin -d pickleball_prod" \
  postgres:18.6-alpine
```

### 2. Security & Firewall
- Bind strictly to `127.0.0.1:5432` if the Node.js API runs on the same VM.
- If the database resides on a private VPC network, bind to the private network interface only.
- Configure UFW:
  ```bash
  sudo ufw default deny incoming
  sudo ufw allow 22/tcp
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable
  ```
  *(Never open port 5432 publicly).*

### 3. Automated Cron Backups
Set up a daily cron job (`/etc/cron.daily/postgres-backup`):
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/postgresql"
mkdir -p "$BACKUP_DIR"
docker exec pickleball_postgres pg_dump -U pickleball_admin -d pickleball_prod -Fc > "$BACKUP_DIR/backup_$(date +\%Y\%m\%d).dump"
find "$BACKUP_DIR" -type f -mtime +14 -delete
```

---

## 10. PostgreSQL 18 Major Line & Upgrade Procedure

### Baseline
- **Current Major**: PostgreSQL 18
- **Current Minor**: 18.6
- **Distribution**: Alpine Linux (`postgres:18.6-alpine`)

### Minor Upgrades (e.g., 18.6 → 18.7)
Minor PostgreSQL versions share binary data compatibility. No dump/restore is required:
```powershell
docker pull postgres:18-alpine
docker stop pickleball_db
docker rm pickleball_db
# Re-run docker run with updated image referencing existing pickleball_postgres_data volume
```

### Major Upgrades (e.g., 18.x → 19.x)
Major releases contain breaking storage catalog changes. Always perform a logical upgrade:
1. Stop API traffic.
2. Dump entire database: `pg_dump -Fc ... > pre_upgrade.dump`.
3. Provision new container with the next major version and a new volume.
4. Restore dump into new version using `pg_restore`.
5. Run test suite and verify row counts.
6. Decommission old container and archive old volume.

---

## 11. Disaster Recovery & Fallbacks

### Scenario A: Local Volume Corruption
If the local `pickleball_postgres_data` volume is damaged:
1. Remove corrupted volume: `docker volume rm pickleball_postgres_data`.
2. Re-create container: execute Section 2 provisioning command.
3. Ingest latest verified backup:
   ```powershell
   Get-Content C:\Users\manis\Backups\Pickleball\supabase_public_backup.sql | docker exec -i pickleball_db psql -v ON_ERROR_STOP=1 -U postgres -d pickleball
   ```

### Scenario B: Emergency Reversion to Cloud (Supabase)
If local development must temporarily route back to the cloud source:
1. Update `server/.env`:
   ```ini
   DATABASE_URL=postgresql://postgres.[REF]:[PASS]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require
   ```
2. Restart backend server (`node src/server.js`). The connection adapter will automatically negotiate TLS.

---

## 12. Troubleshooting Common Issues

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `EADDRINUSE 0.0.0.0:5432` | Another container or process owns port 5432 | Stop conflicting container (e.g., `docker stop trueconnect_db`) or check `Get-NetTCPConnection -LocalPort 5432`. |
| `Connection refused 127.0.0.1:5432` | Container is stopped | Run `docker start pickleball_db` and check `docker ps`. |
| `SSL connection has been closed unexpectedly` | SSL enforced against non-SSL local server | Ensure `?sslmode=disable` is present in `DATABASE_URL` for local development. |
| `directory "/var/lib/postgresql/data" exists but is not empty` | Mounting volume to deprecated subpath in PG 18+ | Mount persistent volume directly to `/var/lib/postgresql`. |
| `password authentication failed` | Password mismatch between `.env` and database user | Update PostgreSQL user password: `docker exec -i pickleball_db psql -U postgres -c "ALTER USER postgres WITH PASSWORD '<NEW_PASS>';"`. |

---

## 13. Security Rules

1. **Zero Secret Commits**: Passwords, API tokens, and credentials must never be committed to Git.
2. **Loopback Only**: Development databases must bind strictly to `127.0.0.1`. Never bind `0.0.0.0:5432` on public or shared machines.
3. **TLS Enforcement**: Production databases across external networks must always require TLS (`sslmode=require`).
4. **Least Privilege**: The application database user must not be a superuser in production. Create an application-specific user owning only the application database.
5. **Clean Repositories**: Infrastructure files, temporary scripts, and `.dump`/`.sql` exports belong outside version control.

---

## 14. Repository Tracking Guidelines

### What Should Be Committed
- `server/prisma/schema.prisma`
- `server/prisma/migrations/**/*.sql`
- `server/prisma/migrations/migration_lock.toml`
- `server/src/lib/prisma.js`
- `server/.env.example`
- `docs/operations/03-DATABASE-OPERATIONS.md`

### What Must NEVER Be Committed
- `server/.env` (contains active local secrets)
- `.env` or `.env.local` in any folder
- `/backups/` or any `.sql` / `.dump` data files
- Root `docker-compose.yml` or database infrastructure manifests
