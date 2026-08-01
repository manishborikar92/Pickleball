# ADR-012: Booking State Persistence and Refresh Recovery Architecture

## Status
Approved (2026-07-31)

## Context
When customers navigate the booking flow (`/venues/[slug]/book`), selecting a date, court(s), slot time range, or applying a coupon, refreshing the browser (F5), returning from a payment gateway redirect, or experiencing a browser crash previously reset all transient selections.

We evaluated several state persistence mechanisms:
1. **Pure URL Search Parameters**: Storing all state (`?date=...&courts=...&start=...&end=...&coupon=...`) in the URL. While highly shareable, this clutters the URL, exposes promotional coupon codes in shared links, and risks slot contention if a shared link contains stale slot selections.
2. **Pure `localStorage`**: Persisting draft selections in `localStorage`. This lacks tab isolation and risks lingering stale slot selections across browser sessions days or weeks later.
3. **Cookies**: Adding draft selections to HTTP cookies. This bloats HTTP header size on every request and lacks tab isolation.
4. **Hybrid Architecture (URL Date + `sessionStorage` Draft & Hold)**: Combining URL search parameters for navigation with `sessionStorage` for transient selection and active holds.

## Decision
We adopted the **Hybrid Persistence Architecture**:

1. **Date via URL (`?date=YYYY-MM-DD`)**:
   - Date is a core navigation parameter.
   - Synchronizing `?date=YYYY-MM-DD` enables **deep-linking and bookmarking**.
   - Allows Next.js 16 Server Components (`BookPage`) to await `searchParams` during SSR and pre-fetch initial availability on the server with **zero client waterfalls**.

2. **Draft Selection via `sessionStorage` (`pb:draft:${venueId}`)**:
   - Draft selections (`selectedCourts`, `selectedSlots`, `appliedCouponCode`) are stored in `sessionStorage` under venue-scoped keys.
   - **Schema Versioning**: `version: 1`. Incompatible or older schema versions are automatically purged.
   - **TTL & Expiration**: Drafts carry an `updatedAt` timestamp and lapse after 2 hours or when `date < today`.
   - **Live Availability Intersect**: On client mount, restored slot ranges are intersected with live server availability data. If any slot became taken or past while the user was away, it is deselected gracefully with a user notice.

3. **Active Payment Hold via `sessionStorage` (`pb:hold:${venueId}`)**:
   - Active 10-minute slot holds persist under `pb:hold:${venueId}`.
   - Restores the 10-minute `useCountdown` timer and gateway resume snapshot across page reloads and payment gateway returns.
   - Re-verifies hold status asynchronously with the backend (`getBookingStatusAction`) on client mount.

4. **Transient UI State (In-Memory Only)**:
   - Modals, dialogs, toast alerts, loading spinners, and error messages remain strictly in React component state.

## Consequences
- **User Experience**: Users can refresh the page, return from payment gateways, or bookmark specific dates without losing their selection or facing broken state.
- **Privacy & Security**: Promotional coupon codes and payment hold UUIDs remain private in `sessionStorage` and are not leaked into shareable URLs.
- **Multi-Tab Isolation**: `sessionStorage` guarantees that separate tabs browsing different dates or venues operate independently without state collisions.
- **Server Component Compatibility**: Next.js 16 App Router Server Components pre-fetch availability for requested URL dates cleanly during SSR.
