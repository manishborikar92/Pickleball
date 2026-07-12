# Next.js App Router Frontend

The Next.js 16 App Router frontend provides the user interface, booking dashboard, and administrative console for the Pickleball booking platform.

---

## 1. Responsibilities

- **User Journeys**: Renders booking timelines, consecutive slot grids, onboarding wizards, and dashboards.
- **Optimistic Proxy Routing**: The Next.js custom `proxy.js` performs optimistic cookie-presence checks, coarse redirects, and **proactive token refresh** at the network edge (it refreshes an expired access token before the Server Component render runs).
- **Server-Side Auth**: Authentication is verified in server layouts/pages via `getSession()`, passed as props to components.
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
- **Session check**: Server layouts/pages call `getSession()` (memoized via React `cache()`), which reads cookies and calls `/api/v1/users/me`
- **No client-side auth context**: Session passed as props from server components
- **Token refresh**: Proactive in `proxy.js` — an expired access token is refreshed at the edge before the render runs (it forwards the new cookies to the render and sets them on the browser response). As a fallback for client-invoked Server Actions, an expired token is also refreshed on a 401 inside the transport (`lib/dal/httpClient.js`).

### Data & Dependency Direction
The dependency direction is strictly one-way: `app/` (routing/composition) → inner reusable
layers. **Nothing under `components/`, `lib/`, or `hooks/` imports from `@/app/`** (ADR-W009,
enforced by an ESLint `no-restricted-imports` boundary).

- **Reads** flow through the Data Access Layer (`lib/dal/*`) — cacheable async functions that call
  the transport (`lib/dal/httpClient.js`) directly. Public reads (venue config) are cached and tagged
  (`"use cache"` + `cacheTag`); user/time-sensitive reads stay uncached behind `<Suspense>`.
- **Authorization** lives at the DAL boundary (`lib/dal/session.js` `verifySession()`), with
  role/permissions derived from `/users/me`. Pages call `requireRouteAccess()` with the real path.
- **Mutations** are Server Actions in route-independent `lib/actions/*` (auth, booking, review) — each
  validates with a shared Zod schema, authorizes, calls the backend, and revalidates cache tags.
- **Validation** is one shared schema per input (`lib/schemas/*`), reused for client UX and
  authoritative server enforcement.

### Codebase Structure
All frontend source files reside in `web/src/`:
- `app/` — Next.js App Router pages organized by route groups (routing/composition only)
- `components/` — Reusable React components (features, layout, shared, seo)
- `hooks/` — Client-side hooks (`useOverlay`, `useTable`, `useBookingSelection`, `useBookingStatusPoll`)
- `lib/dal/` — Data Access Layer: reads + `httpClient` (transport, refresh-on-401) + `session` (authz)
- `lib/actions/` — Server Actions (mutations only): auth, booking, review; `result.js` (shared typed `ok`/`fail` contract)
- `lib/services/` — Multi-step domain logic (checkout, bookingStatus)
- `lib/schemas/` — Shared Zod validation schemas
- `lib/` — Domain/utility modules (normalizers, bookingEngine, rbac, auth, cookies, csp, safeNext, mapLinks, utils)
- `config/` — Application configuration (venue, metadata, map)
- `proxy.js` — Optimistic proxy: cookie-presence redirects + proactive token refresh (+ security headers via `next.config`)

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

## 4. Quality Gates

- **Unit tests** (`node:test`, pure logic — RBAC, schemas, normalizers, booking engine, checkout service, booking-status resolver):
  ```bash
  npm run test
  ```
- **Lint** (ESLint, incl. the `@/app/*` module-boundary rule — ADR-W009):
  ```bash
  npm run lint
  ```
- **Build**:
  ```bash
  npm run build
  ```

---

## 5. Deeper Documentation References

- **UI Screen layouts & Designs**: [docs/product/03-UI-UX-SPECIFICATION.md](../docs/product/03-UI-UX-SPECIFICATION.md)
- **Role Permissions & Rules**: [docs/product/02-BUSINESS-LOGIC.md](../docs/product/02-BUSINESS-LOGIC.md)
- **API Spec Route parameters**: [docs/specs/02-API-SPECIFICATION.md](../docs/specs/02-API-SPECIFICATION.md)
- **Codebase Mappings**: [docs/ai/02-CODEBASE-MAP.md](../docs/ai/02-CODEBASE-MAP.md)
