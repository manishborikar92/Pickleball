# Pickleball Frontend Architecture

## Final Decision

The frontend is a single unified Next.js App Router application. Role-specific modules are isolated with route groups and centralized permission checks rather than split into separate apps. This keeps deployment, shared UI, authentication, API clients, and design tokens consistent while preserving clean boundaries for customer, staff, manager, and super-admin workflows.

## Folder Structure

```text
web/src/
  app/                         # App Router routes, layouts, metadata, errors
    (public)/                  # Landing, booking, review, login
    (app)/                     # Authenticated customer account
    (staff)/                   # Staff, manager, admin operations
    actions/                   # Server Actions
  components/
    features/                  # Feature-owned UI slices
    layout/                    # Shells and navigation
    shared/                    # Reusable primitives
  data/                        # Mockable seed data while API is incomplete
  lib/                         # RBAC, session, validation, API, booking engine
  proxy.js                     # Optimistic route redirects
```

## Route Strategy

Public routes live in `(public)` and include `/`, `/venues/[slug]/book`, `/review/[bookingId]`, `/login`, and `/booking/confirmed`. Customer routes live in `(app)` under `/dashboard`. Operations routes live in `(staff)` under `/admin`. Route groups do not affect URLs, but they keep ownership and layouts separate.

## RBAC

Permissions are centralized in `src/lib/rbac.js`. Routes map to permission keys, not hardcoded role checks. Roles inherit permissions in this order: `customer -> staff -> manager -> super_admin`. Secure checks are repeated in server-rendered pages through `requireRouteAccess`, while `src/proxy.js` performs only fast optimistic redirects.

## Authentication

The current frontend uses a demo HTTP-only role cookie set by a Server Action. Production integration should replace this with the backend OTP/JWT flow: WhatsApp OTP, short-lived access token, refresh token handling, Redis denylist checks, and secure server-side session verification. The client booking flow already mirrors the intended deferred auth gate.

## State Management

Server data is fetched through `src/lib/api.js`, which is intentionally replaceable with REST calls to `/api/v1`. Local UI state remains inside focused client components such as booking, review, and admin forms. Shared business rules live in pure modules with Node tests.

## Middleware / Proxy

Next.js 16 uses `proxy.js`. Because this app uses the `src/` directory, the proxy entry lives at `web/src/proxy.js` beside `app/`. Proxy handles broad redirects for `/dashboard` and `/admin`, but it is not the sole security boundary. Server pages re-check authorization before rendering protected content.

## Validation And Errors

Validation utilities live in `src/lib/validation.js`. Expected UI errors are returned as visible inline state. Route-level `error.js`, `loading.js`, and `not-found.js` provide resilient App Router states.

## Scalability Notes

The single-app modular monolith is preferred for launch because shared booking, auth, RBAC, and design system logic would otherwise be duplicated across multiple apps. If future team size, compliance, or release cadence demands isolation, `/admin` can move into a separate app because its route group and feature modules already form a natural boundary.

## Deployment Recommendations

Deploy the Next.js app on Vercel or any Node-compatible host supporting Next.js 16. Configure production secrets for backend API base URL, session signing, analytics, and payment callback URLs. Keep frontend route protection as defense-in-depth and enforce venue scoping in backend APIs.
