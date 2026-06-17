# Next.js App Router Frontend

The Next.js App Router frontend provides the user interface, booking dashboard, and administrative console for the Pickleball booking platform.

---

## 1. Responsibilities

- **User Journeys**: Renders booking timelines, consecutive slot grids, onboarding wizards, and dashboards.
- **Edge Routing & Session Proxying**: The Next.js custom `proxy.js` middleware intercepts client requests and coordinates authorization headers.
- **Access Control (RBAC)**: Enforces page routing permissions via client guards and cookie checkers.
- **Design Tokens**: Renders layouts matching design specifications using a dark theme sports aesthetic.

---

## 2. Codebase Structure

All frontend source files reside in `web/src/`:
- `app/`: Next.js App Router pages (organized by route groups `(app)`, `(auth)`, `(public)`, and `(staff)`).
- `components/`: Reusable react layouts (UI, features, grids).
- `hooks/`: Custom state hooks (e.g. `useAuth` session checks).
- `lib/`: Edge proxy cores and client roles configurations.
- `providers/`: Context provider wrappers.
- `proxy.js`: Intercepts client fetch requests to forward auth tokens.

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
   *Configure backend API proxy addresses if they deviate from defaults.*

### 3.2 Running Development Server
Start the dev server (runs on `http://localhost:3000`):
```bash
npm run dev
```

### 3.3 Building for Production
To verify page compilation and create the static export build:
```bash
npm run build
```
Start the production build server locally:
```bash
npm run start
```

---

## 4. Testing & Linting

Verify lint and coding guidelines before committing changes:
- **Lint Verification**:
  ```bash
  npm run lint
  ```
- **Code Formatting**:
  ```bash
  npm run format
  ```

---

## 5. Deeper Documentation References

- **UI Screen layouts & Designs**: [docs/product/03-UI-UX-SPECIFICATION.md](../docs/product/03-UI-UX-SPECIFICATION.md)
- **Role Permissions & Rules**: [docs/product/02-BUSINESS-LOGIC.md](../docs/product/02-BUSINESS-LOGIC.md)
- **API Spec Route parameters**: [docs/specs/02-API-SPECIFICATION.md](../docs/specs/02-API-SPECIFICATION.md)
- **Codebase Mappings**: [docs/ai/02-CODEBASE-MAP.md](../docs/ai/02-CODEBASE-MAP.md)
