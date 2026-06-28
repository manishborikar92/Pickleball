# Next.js App Router Frontend

The Next.js 16 App Router frontend provides the user interface, booking dashboard, and administrative console for the Pickleball booking platform.

---

## 1. Responsibilities

- **User Journeys**: Renders booking timelines, consecutive slot grids, onboarding wizards, and dashboards.
- **Thin Proxy Routing**: The Next.js custom `proxy.js` performs lightweight cookie-presence checks and redirects — no data fetching or token refresh.
- **Server-Side Auth**: Authentication is verified once in server layouts via `getSession()`, passed as props to components.
- **Cache Components & PPR**: Uses Next.js 16 Cache Components (`"use cache"`) for static content and Partial Prerendering for dynamic pages.
- **Access Control (RBAC)**: Enforces page routing permissions via server-side `requireRouteAccess()` and proxy cookie checks.
- **Design Tokens**: Renders layouts matching design specifications using a dark theme sports aesthetic with Tailwind CSS 4.

---

## 2. Architecture

### Route Groups
- `(marketing)/` — Static/cached public pages (landing, about, terms, privacy, support)
- `(booking)/` — Dynamic booking flow (venue selection, checkout, confirmation, pending, failed)
- `(auth)/` — Authentication pages (login, onboarding, admin login)
- `(dashboard)/` — Customer authenticated area (overview, bookings, wallet)
- `(admin)/` — Admin authenticated area (overview, bookings, schedule, pricing, courts, users, settings)

### Auth Architecture
- **Single check**: Server layout calls `getSession()` (memoized via React `cache()`)
- **No client-side auth context**: Session passed as props from server layouts
- **Token refresh**: Handled exclusively in `lib/apiClient.js` on 401 responses

### Codebase Structure
All frontend source files reside in `web/src/`:
- `app/` — Next.js App Router pages organized by route groups
- `components/` — Reusable React components (features, layout, shared, seo)
- `hooks/` — Client-side hooks (`useOverlay`, `useTable`)
- `lib/` — Server utilities (apiClient, session, cookies, rbac, normalizers, bookingEngine, validation)
- `config/` — Application configuration (venue, metadata, map)
- `proxy.js` — Thin redirect-only request interceptor

---

## 3. Local Development Quick Start

### 3.1 Initial Setup
1. Enter the web directory:
   ```bash
   cd web/
   npm install
   ```
2. Copy environment keys:
   ```bash
   cp .env.example .env.local
   ```

### 3.2 Running Development Server
Start the dev server (runs on `http://localhost:3000`):
```bash
npm run dev
```

### 3.3 Building for Production
To verify page compilation and create the optimized build:
```bash
npm run build
```
Start the production build server locally:
```bash
npm run start
```

---

## 4. Testing & Linting

- **Tests** (16 tests covering RBAC, validation, normalizers, booking engine):
  ```bash
  npm run test
  ```
- **Lint Verification**:
  ```bash
  npm run lint
  ```

---

## 5. Deeper Documentation References

- **UI Screen layouts & Designs**: [docs/product/03-UI-UX-SPECIFICATION.md](../docs/product/03-UI-UX-SPECIFICATION.md)
- **Role Permissions & Rules**: [docs/product/02-BUSINESS-LOGIC.md](../docs/product/02-BUSINESS-LOGIC.md)
- **API Spec Route parameters**: [docs/specs/02-API-SPECIFICATION.md](../docs/specs/02-API-SPECIFICATION.md)
- **Codebase Mappings**: [docs/ai/02-CODEBASE-MAP.md](../docs/ai/02-CODEBASE-MAP.md)
