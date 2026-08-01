# Web Application Modernization & Architecture Redesign Plan

**Target:** `web/` — Next.js 16.2.6 (App Router) + React 19.2.4, JavaScript, Tailwind CSS 4
**Date:** 2026-06-29 (implemented 2026-07-07)
**Status:** Implemented — the core modernization landed in `web/`: the critical hot-fixes (Phase 0), security headers/CSP/HSTS (Phase 1), the Data Access Layer + authorization boundary (Phase 2), caching/streaming/performance (Phase 3), Zod schemas + React 19 forms (Phase 4), and the SEO/error-UX polish (Phase 5). The ESLint module-boundary rule (ADR-W009) is in place. The broader **developer-tooling and automated-testing scaffolding (Phases 6–7)** — Prettier/Husky/lint-staged, a `tsc` type-check gate, Playwright/Vitest suites, and CI — is intentionally **deferred**; this document set remains the authoritative record for adopting it later.
**Scope:** Full engineering audit, technology evaluation, and phased modernization plan for the `web/` frontend only. The `server/` backend is out of scope except where the frontend's contract with it is relevant.

> **Historical plan record.** The linked documents retain the pre-implementation findings and proposed steps for traceability. Use `docs/ai/01-IMPLEMENTATION-OVERVIEW.md` and `docs/ai/02-CODEBASE-MAP.md` for the implemented architecture.

> **Implementation note (ADR-W006):** The security phase adopted a single static, SRI-backed CSP applied uniformly, rather than the originally-proposed nonce-CSP on dynamic surfaces. Under `cacheComponents` every route is PPR/static, and nonce-CSP is incompatible with PPR (per the official Next.js CSP guide). SRI — which the plan already names as the SSG/PPR-preserving mechanism — is used everywhere. See ADR-W006 for the full rationale.

---

## How to read this plan

This plan is split into focused documents. Read them in order, or jump to what you need:

| # | Document | What it covers |
|---|----------|----------------|
| — | [README.md](./README.md) (this file) | Executive summary, the headline findings, priorities, expected benefits |
| 01 | [01-research-and-technology-evaluation.md](./01-research-and-technology-evaluation.md) | Next.js 16 / React 19 official guidance, ecosystem library evaluation, what to adopt and what to reject (and why) |
| 02 | [02-current-architecture-assessment.md](./02-current-architecture-assessment.md) | How the app is built today, layer by layer, with an honest assessment of what is good and what is not |
| 03 | [03-issues-register.md](./03-issues-register.md) | The complete, severity-classified list of every issue found (bugs, security, performance, architecture, a11y, DX) |
| 04 | [04-api-server-action-service-review.md](./04-api-server-action-service-review.md) | The dedicated **API / Server Action / Service architecture review** required by the brief — current state, Next.js 16 guidance, recommendation |
| 05 | [05-proposed-architecture-and-adrs.md](./05-proposed-architecture-and-adrs.md) | The target architecture, with Architecture Decision Records (ADRs) for each major decision |
| 06 | [06-implementation-plan.md](./06-implementation-plan.md) | The phased, step-by-step migration plan, with per-phase checklists, validation gates, risks, and breaking changes |

---

## 1. Executive Summary

The `web/` application is, structurally, **above average** for a Next.js 16 codebase. The route-group organization (`(marketing)`, `(booking)`, `(auth)`, `(dashboard)`, `(admin)`), the `components/{features,layout,shared,seo}` split, the pure-utility `lib/` modules, the Tailwind 4 CSS-first token system, the SEO/JSON-LD coverage, and the lazy-loaded map are all genuinely good. **The folder structure should be kept essentially as-is.** This plan does **not** recommend reorganizing the project.

However, beneath that clean structure are **three systemic problems** that undermine the application's correctness, security, and performance, plus a long tail of smaller issues. The systemic problems are all fixable without restructuring folders, but they require deliberate, breaking changes to the data and auth layers. Because the project is greenfield (no external consumers, per ADR-005), backward compatibility is not a constraint and we should fix these properly rather than patch around them.

### The three systemic problems

**A. The authorization model is not actually enforced on the frontend (Critical, security).**
The RBAC permission table in `lib/rbac.js` is correct and unit-tested, but it is *called wrong*: both protected layouts call `requireRouteAccess("/admin")` / `requireRouteAccess("/dashboard")` with a **hard-coded group root**, not the real request path. Since `routeAccess` has no key for `/admin` or `/dashboard` (only `/admin/pricing`, `/admin/settings`, etc.), the permission check `canAccessRoute` **fail-opens** and the fine-grained permissions (`edit_pricing`, `manage_venues`, …) are never enforced. A `staff` user can load `/admin/settings` and `/admin/pricing`. Worse, the `(booking)` checkout routes (`/venues/[slug]/book`, `/review/[bookingId]`) have **no layout-level auth at all** and are not matched by `proxy.js`. The frontend's entire defense-in-depth for authorization rests on the backend rejecting calls — there is no Data Access Layer (DAL) enforcing it. The unit test that "proves" RBAC works passes only because it calls the function with the *real* path the app never passes.

**B. The data layer is architecturally inverted, and reads run through Server Actions (Critical, architecture).**
The intended dependency direction is *components → services/DAL → HTTP client*. The actual direction is *components → `lib/api.js` → **Server Actions** → `apiClient`*. `lib/api.js` (a plain library module) **imports Server Actions** from a route segment, and every **read** (`getVenue`, `getAvailability`, `getUserBookings`, `getWallet`, `getBookingById`) is modeled as a POST-only Server Action. This is explicitly against Next.js 16 guidance (Server Actions are for mutations; reads belong in cacheable async functions). It also forces three different error contracts to coexist (actions *return* `{success,error}`; `api.js` *re-throws*; `apiClient` throws with `.status`), causes the booking resolver to need a dynamic `import("./api.js")` hack, and makes the whole read path uncacheable. The same dependency-direction problem is broader than `api.js`: **10 files** in `components/` and `lib/` import Server Actions from `@/app/...` route segments, coupling reusable layers to the routing layer. The target architecture relocates all Server Actions to a route-independent `lib/actions/*` so that **nothing in `components/`, `lib/`, or `hooks/` imports from `@/app/`** (ADR-W009), enforced by a lint rule.

**C. Cache Components is enabled but actively defeated, so the app pays its cost and gets none of its benefit (High, performance).**
`next.config.mjs` sets `cacheComponents: true` (PPR + `"use cache"`), but `apiClient.js` hard-codes `cache: "no-store"` on **every** request, there are **zero** `cacheTag`/`revalidateTag`/`cacheLife` usages anywhere, and the only two `"use cache"` directives are on pages that fetch no data. The result: every page is fully dynamic, the venue endpoint is fetched twice per booking render with no dedupe, the booking route has no streaming and no `loading.js`, and the landing-page hero (the LCP element) is an unoptimized CSS `background-image` rather than `next/image`.

### The headline individual bugs

Beyond the systemic issues, these concrete defects were confirmed by reading the code:

- **`submitReview` is dead on arrival (Critical).** It gates on `session.accessToken`, but `getSession()` never returns a token field — so review submission *always* returns "You must be logged in," for everyone. `ReviewForm` also calls `<Button asChild variant="outline">`, but the `Button` component implements neither `asChild` nor an `outline` variant — so the success screen renders broken buttons too. Review is non-functional end to end.
- **Open redirect in `signInAdminAction` (Medium-High, security).** It validates `next.startsWith("/")` only — `//evil.com` passes and redirects an admin off-site after login.
- **No Content-Security-Policy on the app (High, security).** Only `/login`, `/onboarding`, `/admin/login` get a minimal `frame-ancestors` CSP; dashboard, admin, booking, and marketing have no `script-src`/`connect-src`/`default-src` and no nonce strategy. HSTS is missing entirely.
- **`signInAdminAction` has no error handling (High).** A wrong password throws raw into the error boundary instead of showing an inline "invalid credentials" message.
- **Validation is client-only (High, security).** Server Actions forward raw input to the backend; a direct action invocation bypasses every validator.
- **Token refresh has a coverage gap (High).** The proxy refreshes tokens only on its matched routes, which **exclude** `/venues/[slug]/book`. A user who idles past the 15-minute access-token TTL on the booking page hits a 401 mid-checkout with no recovery path.

### What is genuinely good (and should be preserved)

- Route-group structure and the `components`/`lib`/`hooks`/`config` separation.
- `lib/auth.js` as a pure, framework-free module; `auth.config.js` as pure constants; `apiClient.js` as a stateless transport.
- The `bookingResolver.js` domain state machine and the `normalizers.js` snake→camel boundary.
- Tailwind 4 `@theme` design tokens + the `cn()` (`clsx` + `tailwind-merge`) helper.
- SEO: metadata templates, `getPageMetadata` helper, JSON-LD, sitemap/robots, OG image route.
- The lazy, `ssr:false`, in-view-gated map (`MapWrapper` → `MapCore`) — the single heaviest dependency is correctly deferred.
- The `node:test` pure-logic suite (16 cases) and the team's deliberate minimal-dependency philosophy.

---

## 2. Priorities at a glance

Severity reflects impact on correctness, security, users, or the ability to scale the codebase. Effort is a rough order of magnitude.

### Critical (do first)

| ID | Problem | Fix summary | Effort |
|----|---------|-------------|--------|
| C1 | RBAC permissions never enforced (static path passed to `requireRouteAccess`) | Move authz into a DAL/page-level check using the real path; make `canAccessRoute` fail-closed for protected prefixes | M |
| C2 | `(booking)` checkout routes have zero frontend auth | Add per-page DAL guards (and/or a `(booking)` segment guard) for owned resources | M |
| C3 | `submitReview` permanently broken (wrong session contract + broken Button API) | Read token from cookies like other actions; fix `Button` usage; add server validation | S |
| C4 | Data layer inverted: reads run through Server Actions; `lib/api.js` imports actions | Introduce a real DAL (`lib/dal/*`); reads become cacheable async functions; actions = mutations only | L |

### High

| ID | Problem | Fix summary | Effort |
|----|---------|-------------|--------|
| H1 | No CSP / HSTS on the app | Add a nonce-based strict CSP via `proxy.js` + HSTS and security headers | M |
| H2 | Server-side validation missing (client-only) | Adopt one shared schema (Zod) validated at every action boundary and reused client-side | M |
| H3 | `cacheComponents` defeated by blanket `no-store` + no tags | Selective `"use cache"` + `cacheTag`/`revalidateTag`; per-call cache policy | L |
| H4 | Booking route: no streaming, no `loading.js`, client re-fetch waterfall | Add Suspense + `(booking)/venues/[slug]/book/loading.js`; drop the redundant initial-date client fetch | M |
| H5 | Hero LCP image is a CSS background | Render hero with `next/image` `fill priority` (AVIF/WebP) | S |
| H6 | `signInAdminAction` unhandled errors + open redirect | try/catch with inline errors; validate `next` against `//` and `/\` | S |
| H7 | Token-refresh gap on `/venues/*`; admin role spoofable via cookie | Refresh-on-401 in the DAL; derive role/permissions from `/users/me`, not the cookie | M |
| H8 | React 19 form primitives unused; forms are hand-rolled `useState` | Migrate forms to `useActionState`/`useFormStatus` + the shared schema | M |

### Medium / Low

See [03-issues-register.md](./03-issues-register.md) for the complete list (≈45 issues), each with file:line, impact, and a concrete fix.

---

## 3. Expected benefits after modernization

- **Security:** authorization actually enforced (defense-in-depth via a DAL), a real CSP+HSTS backstop against XSS, server-validated inputs, no open redirect, role derived from the authoritative source.
- **Correctness:** review flow works; checkout survives token expiry; one consistent error contract; no silent fail-open.
- **Performance:** real PPR — cached venue shells streaming dynamic availability; LCP image optimized; venue fetch deduped; `loading.js` everywhere; measurably better Core Web Vitals on the two hottest routes (landing, booking).
- **Maintainability:** one read path (DAL), one mutation path (actions), one validation source (schemas), one error contract. New engineers can follow the data flow in a straight line instead of through an inverted `api.js → actions` loop.
- **DX:** React 19-native forms remove hand-rolled loading/error plumbing; JSDoc-typed DAL + schemas give editor safety without a TypeScript migration; tighter lint/format/CI gates.

All of the above is achievable **without** changing the folder structure and **without** adopting heavy frameworks — in keeping with the project's established minimal-dependency philosophy. The only new runtime dependency this plan recommends is a schema-validation library (Zod), justified in [01-research-and-technology-evaluation.md](./01-research-and-technology-evaluation.md).
