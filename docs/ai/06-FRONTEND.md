# AI Project Context — Frontend Structure & Guidelines

This document details the frontend architecture, page route groups, Next.js routing constraints, and styling system conventions of the Pickleball Booking Platform.

---

## 1. Directory Structure Map (`/web/src`)

The Next.js 16+ frontend is structured inside `/web/src`:

```
/web/src/
├── app/                             # Next.js App Router root
│   ├── (public)/                    # Publicly accessible routes (Landing, support, reviews)
│   ├── (auth)/                      # Customer login, OTP onboarding, staff login
│   ├── (app)/                       # Customer dashboards
│   ├── (staff)/                     # Administrator dashboard (/admin)
│   ├── actions/                     # Server Actions for SSR routes
│   ├── api/                         # Frontend API route handlers
│   ├── globals.css                  # Global CSS theme overrides (Tailwind CSS)
│   └── proxy.js                     # Middleware proxy replacing deprecated middleware.js
├── components/                      # Shared reusable UI elements
├── config/                          # Client-side configuration files
├── context/                         # React context providers (e.g. Session context)
├── data/                            # Static local JSON files
├── hooks/                           # Reusable React hooks
├── lib/                             # Core library utilities (e.g. API client)
├── providers/                       # Global providers (e.g. Theme, Query client)
└── services/                        # Service wrappers for external fetchers
```

---

## 2. Route Groups & Routing Path Map

The frontend routes are grouped contextually using Next.js route groups:

| Path Name | Route Group | Description | Access Protection |
|:---|:---|:---|:---|
| `/` | `(public)/page.js` | Main Landing Page. | Public |
| `/venues` | `(public)/venues/` | Venues locator. | Public |
| `/book` | `(public)/booking/` | Slot booking and calendar UI. | Public |
| `/login` | `(auth)/login/` | Customer OTP request / entry page. | Authenticated redirect (if logged in) |
| `/onboarding` | `(auth)/onboarding/`| Customer name submission page. | Auth session required |
| `/staff-login`| `(auth)/staff-login/`| Staff Email/Password entry page. | Authenticated redirect (if logged in) |
| `/dashboard` | `(app)/dashboard/` | Customer booking history & wallet credits. | Customer Auth & Onboarded required |
| `/admin` | `(staff)/admin/` | Admin dashboard (Courts, schedules, prices).| Staff Auth required |

---

## 3. Route Access Controller (`proxy.js`)

In Next.js v16.0.0+, `middleware.js|ts` is deprecated and replaced by **`proxy.js`**. 
The routing gate logic is handled in the codebase files [proxy.js](../../web/src/proxy.js) and [proxy-core.js](../../web/src/lib/proxy-core.js):
* **Matcher configuration**: `/login`, `/onboarding`, `/staff-login`, `/dashboard/:path*`, `/admin/:path*`.
* **Flow logic**:
  * Calls `handleRouteAccess(request)`.
  * Verifies JWT claims in cookies or auth headers.
  * If a customer attempts to hit `/dashboard` without completing onboarding (`name === null`), redirects them to `/onboarding`.
  * If an unauthenticated user attempts to hit `/admin/` or `/dashboard/`, redirects them to `/staff-login` or `/login` respectively.

---

## 4. Styling & Theme Specifications

The platform employs **Tailwind CSS v4** styling with custom theme definitions loaded in the codebase file [globals.css](../../web/src/app/globals.css).

### 4.1 Custom CSS Variables (Theme System)
* **Background**: `#0d0f04` (very dark olive-black)
* **Foreground**: `#f7f7ef` (off-white)
* **Surface Layouts**:
  * `--surface`: `#121508` (base card background)
  * `--surface-soft`: `#1a1d10`
  * `--surface-panel`: `#1f2315`
  * `--surface-high`: `#292d1e`
* **Accent**: `#caff00` (vibrant yellow-green)
* **Accent Dim**: `#a9d800`
* **Border Lines**: `rgba(197, 201, 172, 0.18)`
* **Danger**: `#ff6b5f`

### 4.2 UI/UX Conventions
* **San-Serif Font**: Primary font family is mapped dynamically to `Geist` (loaded in `RootLayout`).
* **Interactive Elements**: All buttons, links, inputs, and textareas must display a focus outline colored with `var(--accent)`.
* **Glassmorphism panels**: Glass UI panels use `.glass-panel` class:
  ```css
  background: rgba(31, 35, 21, 0.82);
  border: 1px solid var(--border);
  box-shadow: 0 20px 70px rgba(0, 0, 0, 0.22);
  ```
