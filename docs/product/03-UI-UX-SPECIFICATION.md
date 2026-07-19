# Pickleball Platform — UI/UX Specification

This document covers all screens, user flows, and design conventions for the customer-facing frontend. Admin dashboard UI is addressed separately in its own section.

---

## 1. Design System

### 1.1 Visual Language

The platform uses a **dark sports aesthetic**: near-black backgrounds with a sharp yellow-green accent. All screens shown in the designs follow this palette consistently.

| Token | Value | Usage |
|---|---|---|
| Background (primary) | `#0D0D0D` / `#111111` | Page and card backgrounds |
| Background (surface) | `#1A1A1A` / `#1E2020` | Cards, modals, input fields |
| Accent (brand) | `#CBFF00` (yellow-green) | CTAs, selected states, highlights, labels |
| Text (primary) | `#FFFFFF` | Headings, body |
| Text (secondary) | `#888888` / `#AAAAAA` | Subtext, placeholders, metadata |
| Text (disabled) | `#555555` | Booked/unavailable slots |
| Destructive | `#FF4444` | Errors |
| Border | `rgba(255,255,255,0.08)` | Card and input borders |

### 1.2 Typography

- **Headings:** Bold, large. Landing page hero uses a very large weight.
- **Body:** Regular weight, 14–16px.
- **Labels:** Uppercase, small, letter-spaced (e.g., "FULL NAME", "PREMIUM COURT").
- Font family: Yet to be decided (current designs suggest a geometric sans-serif).

### 1.3 Components

- **Primary CTA:** Full-width pill button, `#CBFF00` background, black text, uppercase label with an icon (arrow or play). Example: "CONFIRM & PAY", "SEND OTP →", "▶ SUBMIT REVIEW".
- **Slot Chip:** Rounded rectangle showing start and end time. States: Available (dark surface, white text), Selected (accent yellow-green background, black text), Booked/Unavailable (dark, strikethrough text, disabled).
- **Bottom Sheet Modal:** Slides up over a blurred/dimmed background. Used for all auth steps and confirmations. Has a drag handle pill at the top.
- **Input Field:** Dark background, subtle border, left-aligned icon, placeholder text in secondary color.
- **Star Rating:** Tap-to-select, filled stars in accent yellow-green, empty star in outline.
- **Badge/Tag:** Small pill with label. Examples: "INDOOR", "PREMIUM COURT", "LIVE NOW" (with pulsing dot).

---

## 2. Customer-Facing Pages

### 2.1 Landing Page

**Purpose:** Marketing and trust-building. Drives users to book.

**Sections (top to bottom):**

1. **Hero** — Full-bleed dark court background image. "LIVE NOW" badge (pulsing green dot). Large headline: "The Future of Pickleball." Subheadline describing the value proposition. Single primary CTA: "Book Court".

2. **Elite Facility Standards** — Three feature pillars: Pro Surface, Climate Control, Pro Shop. Each has an icon and a two-line description.

3. **Our Facilities** — "Twin Premium Courts" card with a court image. Tags: "Indoor", "Premium". Feature list (Singles/Doubles, Accessible, Climate Controlled). "Indoor Premium" label.

4. **Seamless Experience** — Three-step process numbered 1–2–3: Book → Pay → Play. Each step has a short descriptor.

5. **Player Reviews** — Star rating display and quoted review cards (sourced from the reviews table, `is_published = true`).

6. **Find Us** — Map embed or static map image. Address, hours, contact details.

7. **Common Questions (FAQ)** — Accordion-style: bring equipment, advance booking window, cancellation policy.

8. **Footer** — Logo, tagline, Privacy Policy, Terms, social links (Instagram, Facebook).

---

### 2.2 Booking / Checkout Page

**Route:** `/book` or `/venues/[slug]/book`

**Purpose:** The primary booking interface. Users select a date, one or both courts, one or more consecutive time slots, review the live price, and initiate the auth + payment flow.

**Layout (single scrollable page, no bottom navigation bar):**

**Section 1 — Venue Hero**
- Full-width court image.
- Venue name in large bold text, location address with pin icon.

**Section 2 — Select Date**
- Horizontal scrollable date strip. Selected date highlighted in accent colour.
- Calendar icon at the end opens a full-date picker for dates further out.
- Only dates within the advance booking window are interactive.

**Section 3 — Select Courts**
- Row of court cards (one per court), each with a checkbox or toggle.
- Default: no court selected. User must select at least one.
- Each card shows: court name, environment (Indoor), and a brief tag.
- Selecting/deselecting a court immediately refreshes the slot grid below and triggers a `price-preview` API call to update the total.

**Section 4 — Select Time Slots**
- One slot grid per selected court, rendered side-by-side on tablet/desktop, stacked on mobile.
- Slots are displayed as chips: `09:00 – 10:00`.
- **Multi-select rule:** The user can tap any available slot to start a selection. Tapping another slot on the same court extends the range up to it, auto-filling the slots in between (e.g. 7:00 selected, tap 11:00 → 7:00–12:00); the extension is refused with an inline notice if any slot in the span is unavailable or the session would exceed 12 slots. All selected courts share one time range: tapping a slot inside the range on another court adds that court with the same range (refused with a notice if the court isn't free for the whole range), and range changes apply to every selected court — an asymmetric selection cannot be created.
- Slots that are booked, pending, or blocked are greyed out and non-interactive.
- When both courts are selected, the slot grids must show the **intersection of available slots** highlighted — slots that are available on at least one court show normally, but the price-preview reflects both courts' pricing.
- Selected slots are highlighted in accent colour. The range is visualised as a connected bar across the selected chips.
- Deselecting a slot in the middle of a range clears the entire selection (no gaps allowed).

**Section 5 — Live Summary**
- Updates in real-time as courts and slots are selected/deselected.
- Shows: "Court 1 + Court 2 · Sunday 11 May · 9:00 AM – 12:00 PM (3 hrs)"
- Price table: per-unit breakdown (collapsible) + subtotal + tax (rendered conditionally only when tax > 0) + total.
- Price data comes from the `/bookings/price-preview` endpoint, triggered on every selection change (debounced 300ms).
- Promo code input with "Apply" button — applying a coupon re-calls price-preview with `coupon_code`.
- Wallet credit toggle (if user is authenticated and has a balance).

**Sticky Bottom CTA**
- "Confirm & Pay" pill button — disabled until at least one court and one slot are selected.
- "🔒 Secure checkout" micro-label beneath.
- Tapping triggers the auth gate (if not verified), then opens the confirm step instantly. Nothing is reserved yet — the hold API call runs only at the final Confirm & Pay click (commit-on-confirm), so abandoning the review leaves no stale hold.

---

### 2.3 Auth Gate — Modal Surface (Booking Context)

The auth gate appears as a bottom-sheet modal overlay on the booking page. It is used exclusively when the user is in an active booking flow — preserving their court and slot selection in React state without any page navigation.

**When the modal is used:**
- User clicks "Confirm & Pay" on `/book` while unauthenticated.
- User's JWT expires mid-session while reviewing the checkout summary.
- Any in-context flow where leaving the current page would destroy the selection state.

**When the dedicated `/login` page is used instead:**
- User navigates directly to `/login` with no booking in progress.
- Route guard redirects from a protected page (e.g., `/bookings`, `/wallet`).
- Shared or external links to the platform.
- Authentication recovery (expired session, device change).

**The booking page never navigates away during auth.** The modal is always used in a booking context. This guarantees the user's court and time slot selection, accumulated in React state, is never lost.

Both the modal and the `/login` page use the same `useAuth` hook and identical step components. See Section 2A for the shared frontend architecture.

**Path determination on "Confirm & Pay" click:**

```
Valid JWT in storage?
├─ YES → GET /users/me
│   ├─ name IS NOT NULL → skip auth gate entirely → proceed to Hold
│   └─ name IS NULL    → show Step 3 sheet only (OTP already verified)
└─ NO / 401 → open Auth Gate from Step 1
```

#### Step 1 — Phone Entry (always first for unauthenticated users)

**Content:**
- Phone icon in circular container at top.
- Heading: "Verify to Book"
- Subheading: "Enter your phone number to receive a 6-digit code."
- Input: flag emoji + "+91" (fixed), 10-digit phone number field.
- CTA: "Send OTP →"

---

#### Step 2 — OTP Entry

**Content:**
- Heading: "Enter Code"
- Subheading: "Sent to +91 XXXXX XXXXX" (last 5 digits visible).
- 6-box OTP input; auto-focuses first box; numeric keyboard on mobile.
- "↺ Resend Code" link with countdown timer (appears after 30 seconds).
- CTA: "Verify OTP"

**On success:**
- Backend returns `next_step`.
- `complete_onboarding` → advance to Step 3 (name collection).
- `resume_booking` → close auth gate; proceed to slot hold.
- `admin_dashboard` → navigate to `/admin` (no booking flow continues).

---

#### Step 3 — Name Collection (first-time users only)

Shown only when `next_step = "complete_onboarding"`. Does not re-appear for returning users.

**Content:**
- Heading: "Almost there!"
- Subheading: "Tell us your name to finish your booking."
- Input labeled "FULL NAME" with person icon and placeholder.
- CTA: "Continue →"

**On submit:**
- Calls `POST /auth/onboarding { name }`.
- On success: auth gate closes; frontend proceeds to slot hold.

**Interrupted onboarding handling:** If the user had previously verified OTP but never submitted a name (closed mid-flow), the frontend detects `user.name = null` on `GET /users/me` and shows only this Step 3 sheet — Steps 1 and 2 are skipped since the JWT is still valid.

---

#### Already Authenticated (No Gate Shown)

If `GET /users/me` returns a user with `name IS NOT NULL` and the JWT is valid, the entire auth gate is bypassed silently. The user proceeds directly to the slot hold. This is the experience for all returning users who have previously completed a booking.

---

### 2.4 Checkout — Waiver & Payment (Commit-on-Confirm)

**Trigger:** Auth gate completed (or skipped for returning users). The confirm step opens instantly from the live price preview — nothing is reserved while the user reviews.

**Content:**
- Full order summary rendered clearly: court(s), date, session time in full unambiguous format (e.g., "Sunday, 11 May 2025 · 9:00 AM to 12:00 PM · 3 hours").
- Per-unit price breakdown (collapsible), coupon field, wallet credit toggle.
- Two mandatory checkboxes (both must be checked to enable "Confirm & Pay"):
  1. "I confirm my booking is for [full time string] and understand it is non-refundable."
  2. "I accept the Terms & Conditions and Liability Waiver."
- Final total amount.
- CTA: "Confirm & Pay" → commits the booking in one server pass (`POST /bookings/hold` → waiver → initiate-payment), then opens the PhonePe payment sheet or confirms a wallet-only booking. Slot contention at commit shows a clear conflict message and refreshes the grid.
- From the commit, a countdown timer shows the remaining 10-minute payment window. If the gateway step is cancelled or abandoned (popup dismissed, modal closed, reload), the payment can be resumed within the window — a "Resume checkout" banner on the grid shows the remaining time, and the backend reuses the initiated payment order. An expired window releases the slots and returns the user to selection.

---

### 2.5 Booking Confirmation Screen

**Trigger:** Successful payment webhook received.

**Content:**
- Success animation or checkmark.
- "You're booked!" heading.
- Booking details card: venue, court, date, time, amount paid.
- Court access PIN (if smart lock integration is active — future feature).
- "View My Bookings" and "Book Again" links.
- A WhatsApp confirmation is simultaneously sent to the user.

---

### 2.7 Dedicated Login Page — `/login`

**Purpose:** Full-page authentication entry point for all flows outside an active booking. Supports direct navigation, route guard redirects, and shared links.

**URL:** `/login?next=[encoded-path]`

The `next` query param carries the destination the user should be sent to after successful auth. It is validated by the shared `safeNext()` open-redirect guard; if absent or unsafe, it defaults to `/dashboard/overview`.

**Layout:**
- Platform logo and "Welcome back" heading at the top.
- Minimal background — dark theme consistent with design system.
- The same step flow as the modal (Phone → OTP → Name if new user), but rendered as a centred card on desktop and a full-screen view on mobile.
- Progress indicator (Step 1 of 2 / Step 2 of 2) — visible because there is no modal context to orient the user.
- Back-arrow on the OTP step to return to phone entry.

**Step 1 — Phone Entry:**
- Same `PhoneInput` component as the modal.
- Heading: "Sign in to continue" (or "Create your account" for new users — determined after OTP verify).
- Subheading: "Enter your phone number to receive a 6-digit code."
- CTA: "Send OTP →"

**Step 2 — OTP Entry:**
- Same `OtpInput` component as the modal.
- 30-second resend countdown.
- CTA: "Verify OTP"
- On success: `next_step` drives routing (see below).

**Post-verify routing from `/login`:**

| `next_step` | Action |
|---|---|
| `complete_onboarding` | Redirect to `/onboarding?next=[original next]` |
| `resume_booking` | Redirect to `next` (or `/dashboard/overview` if absent) |
| `admin_dashboard` | Redirect to `/admin` |

**Route guards on `/login`:**
- If already authenticated (`name IS NOT NULL`): redirect to `next` (or `/dashboard/overview`) immediately.
- If authenticated but onboarding incomplete (`name IS NULL`): redirect to `/onboarding?next=...`.

---

### 2.8 Dedicated Onboarding Page — `/onboarding`

**Purpose:** Full-page name collection for first-time users arriving from `/login` or from a route guard redirect. Never shown during an active booking flow (the modal handles that case).

**URL:** `/onboarding?next=[encoded-path]`

**Access rules:**
- Requires a valid JWT. If no JWT → redirect to `/login?next=[same next]` (the destination passes through unchanged).
- If `name IS NOT NULL` (already onboarded) → redirect to `next` or `/dashboard/overview`.

**Layout:**
- Progress indicator: "Step 2 of 2 — Almost done!"
- Heading: "What should we call you?"
- Subheading: "Your name helps us personalise your booking experience."
- Full-name input (same `NameInput` component as the modal).
- CTA: "Continue →"

**On submit:**
- Calls `POST /auth/onboarding { name }`.
- On success: redirect to `next` or `/dashboard/overview`.
- Error states shown inline.

---

### 2.9 Route Guard Reference

Protected routes are guarded in two layers: an optimistic edge pass in the proxy (`web/src/proxy.js`) and authoritative server-side session checks at the data boundary (`web/src/lib/dal/session.js`). Both layers must agree. Post-auth destinations always travel in the `next` query param, validated by the shared `safeNext()` open-redirect guard.

| Route | Accessible to | Redirect if not met |
|---|---|---|
| `/login` | Unauthenticated only | `next` (or `/dashboard/overview`) if already authenticated |
| `/onboarding` | JWT only (name may be null) | `/login?next=[target]` if no JWT |
| `/book` | Public (auth triggered mid-flow via modal) | — |
| `/bookings`, `/wallet`, `/rewards` | JWT + onboarding complete | `/login?next=[current path]` |
| `/review/[id]` | JWT + booking owner | In-page sign-in gate linking to `/login?next=[current path]` |
| `/admin/*` | JWT + non-customer role | `/admin/login?next=[current path]` |
| `/admin/login` | Unauthenticated (or non-admin JWT) | `next` (or `/admin/overview`) if already authenticated as an admin |

**The optimistic proxy (`web/src/proxy.js`) handles:**
- No JWT present on `/dashboard/*` or `/admin/*` → redirect to `/login` / `/admin/login` carrying `?next=[current path]`.
- Expired access token with a valid refresh token → proactive refresh, forwarding fresh cookies to the render.
- Authenticated users landing on `/login` / `/onboarding` → bounced to `next` (or the dashboard overview).
- Admin JWT on customer routes → allowed (admins can browse the customer experience).

**Authoritative server-side checks (`verifySession()` / `requireUser()` / `requireRouteAccess()`) handle:**
- No verified session on a protected page → redirect to `/login?next=[pathname]`.
- Customer session without a name → redirect to `/onboarding?next=[pathname]`.
- Fail-closed route→permission mapping; denial redirects to the area overview.
- Deep-linked pages (`/booking/[id]`, `/review/[id]`) render in-page sign-in gates whose login links carry `?next=` instead of redirecting.
- `force_password_change` flag on an admin → redirect to `/admin/change-password`. *(Planned — ships with the admin email flows.)*

---

### 2.10 Rate Your Experience Screen

**Trigger:** Automatically triggered via WhatsApp link after the booking slot end time has passed.

**Route:** `/review/[booking_id]`

**Content (top to bottom):**

1. **Hero** — Full-bleed dark court image (same as on landing).
2. **Header** — "Thank you for playing!" heading. Session context sourced from the booking record — court name(s), venue brand, and the session date/time (e.g., "Court 1, Court 2 — Baseline Arena · Sunday, 13 Jul · 09:00 – 10:00"). Never hardcoded copy.
3. **Rating Card** — Dark card with "How was your experience?" heading. "Tap a star to rate your session." subtext. Five-star tap-to-rate row (filled stars in accent yellow-green) with a rating label (Poor → Excellent). Keyboard: arrow keys move the selection (radiogroup semantics).
4. **Share Your Thoughts** — "Share your thoughts" section label. Multi-line text input with placeholder: "How was the court surface? Did you have a good game?" Labeled "Optional" in bottom-right corner; shows remaining characters near the 1000-char cap.
5. **Add a Photo** *(deferred)* — Dashed-border upload area with camera icon; ships with the Cloudflare R2 integration.
6. **CTA** — "Submit Review" full-width accent button, disabled until a star rating is selected.

**Behaviour:**
- The page resolves its state server-side before rendering, so the form only appears when it can actually be submitted:
  - **Unauthenticated** → sign-in gate ("Sign In to Rate Your Session") whose login CTA carries `?next=/review/[id]`; the user returns to this exact page after verifying. Any draft rating/comment is kept on-device and restored.
  - **Authenticated but not onboarded** → redirect to `/onboarding?next=/review/[id]`.
  - **Booking not found / not owned** → not-found / access-denied card (existence is never leaked).
  - **Booking not yet completed** → "This session hasn't been played yet" card with a link to the booking.
  - **Booking cancelled or expired** → "This booking can't be reviewed" card.
  - **Review already exists** → the submitted state (stars, comment, submission date) — the form is no longer accessible for that booking.
- Star rating is required to enable submit; the comment stays optional.
- Photo upload is deferred until Cloudflare R2 integration lands (`reviews.photo_url` is reserved in the schema).
- After submit, the same submitted state is shown (server-refreshed in the same round trip); duplicate submissions from another tab resolve to it as well.

---

## 2A. Frontend Authentication Architecture

This section defines the shared architecture that powers both the modal and page authentication surfaces. Business logic, API calls, state management, and validation live here exactly once.

### 2A.1 The `useAuth` Hook

A custom React hook that encapsulates the entire customer auth state machine. Both `AuthModal` and the `/login` page import and use this hook — they are simply different shells around the same logic.

```
useAuth({ next, onSuccess, mode })
  mode: 'modal' | 'page'

State machine:
  idle
    → entering_phone   (user starts typing phone)
    → sending_otp      (POST /auth/otp/send in flight)
    → entering_otp     (OTP sent, awaiting user input)
    → verifying_otp    (POST /auth/otp/verify in flight)
    → collecting_name  (nextStep = 'complete_onboarding')
    → submitting_name  (POST /auth/onboarding in flight)
    → authenticated    (terminal — onSuccess() called)
    → error            (any failed step — user can retry)

Exposed values:
  step, phone, isLoading, error, canResendOtp, resendCountdown

Exposed actions:
  setPhone(value)
  sendOtp()
  setOtp(value)
  verifyOtp()
  resendOtp()
  setName(value)
  submitName()
  reset()          ← returns to idle (used when modal is dismissed)
```

### 2A.2 Shared Step Components

These components are UI-only — they receive state and actions as props and render nothing stateful themselves.

| Component | Used on step | Props |
|---|---|---|
| `PhoneStep` | `entering_phone`, `sending_otp` | `phone`, `setPhone`, `onSubmit`, `isLoading`, `error` |
| `OtpStep` | `entering_otp`, `verifying_otp` | `phone`, `onSubmit`, `onResend`, `isLoading`, `error`, `countdown` |
| `NameStep` | `collecting_name`, `submitting_name` | `onSubmit`, `isLoading`, `error` |

### 2A.3 Modal Shell vs Page Shell

The same step components are wrapped in different layout containers:

```
AuthModal (bottom-sheet, for booking context):
  <BottomSheet isOpen={isOpen} onClose={handleDismiss}>
    <PhoneStep  />  or  <OtpStep  />  or  <NameStep  />
    (chosen based on auth.step)
  </BottomSheet>

  Dismissal: user taps outside or swipes down → auth.reset()
  Booking context is fully preserved (no navigation)

LoginPage (/login, for all other contexts):
  <PageLayout>
    <ProgressIndicator step={auth.step} />
    <PhoneStep  />  or  <OtpStep  />  or  <NameStep  />
  </PageLayout>

  No dismiss — user uses browser back button
  next from query param drives post-auth redirect (validated by safeNext)
```

### 2A.4 Post-Auth Routing Logic

`onSuccess` is called by `useAuth` when the state machine reaches `authenticated`. The behaviour differs between modal and page mode:

```
Modal mode (onSuccess):
  nextStep === 'complete_onboarding' → transition modal to NameStep
  nextStep === 'resume_booking'      → close modal → proceed to booking hold
  nextStep === 'admin_dashboard'     → full page navigate to /admin

Page mode (onSuccess):
  nextStep === 'complete_onboarding' → router.push('/onboarding?next=...')
  nextStep === 'resume_booking'      → router.push(next || '/dashboard/overview')
  nextStep === 'admin_dashboard'     → router.push('/admin')
```

### 2A.5 The `useOnboarding` Hook

A narrower hook used only on the `/onboarding` page (and by the `NameStep` component inside the auth flow). Encapsulates name collection only:

```
useOnboarding({ next, onSuccess })
  State: name, isLoading, error
  Actions: setName(value), submit()
```

The `NameStep` component in the auth flow is powered by this hook through `useAuth`'s internal delegation.

### 2A.6 Session Restoration on App Load

On every app load or page navigation, a top-level `AuthProvider` component (wrapping the Next.js layout) checks session state:

```
1. Read JWT from localStorage (customer) or secure cookie (admin — TBD).
2. If JWT exists and not expired (client-side exp check):
   → Call GET /users/me to confirm validity and get current user state.
   → If name IS NULL: user is partially onboarded.
     → On /book: show NameStep modal when they click "Confirm & Pay".
     → On /bookings or /wallet: route guard redirects to /onboarding.
   → If name IS NOT NULL: fully authenticated → store user in AuthContext.
3. If JWT is absent or expired:
   → Clear any stale tokens.
   → User is unauthenticated → route guards apply on page access.
```

### 2A.7 Booking Context Preservation

The booking page (`/book`) holds the user's court and slot selection entirely in React state (no server-side draft, no local storage persistence). This is intentional:

- The modal never causes a page navigation → selection is preserved.
- If the user closes the tab or browser, the selection is lost — this is expected behaviour.
- The 10-minute slot hold only starts after auth is complete and `POST /bookings/hold` is called.
- If the user's JWT expires exactly as they click "Confirm & Pay", the modal opens (they re-authenticate in ~30 seconds), and the selection remains intact.

### 2A.8 Admin Auth Architecture

Admin auth (`/admin/login`, activation, reset) uses an entirely separate `useAdminAuth` hook that calls the `/auth/admin/*` endpoints. It does not share state or components with `useAuth`. Admin-side logic does not bleed into the customer auth flow.

---

## 3. User Account

### 3.1 My Bookings

Lists all bookings for the verified phone number, grouped by: Upcoming, Past, Cancelled.

Each booking card shows: court name, date/time, status badge, total paid, and (for past bookings) a "Rate Session" button if no review exists.

If the booking has an associated unrevealed reward instance, an accent badge ("🎁 Scratch Card waiting!") appears on the booking card and tapping it navigates to the scratch card screen.

### 3.2 Wallet & Credits

Shows current `wallet_credits` balance and a list of `wallet_transactions` (credits issued, credits redeemed) with dates and reasons.

### 3.3 My Rewards

Lists all reward instances for the user, grouped by: **Pending** (unrevealed, not expired) and **Past** (revealed or expired).

**Pending card (scratch card):** Shows a scratch card graphic with an unscratched surface, the booking it was earned from, and an expiry countdown ("Expires in 5 days"). Tapping navigates to the Scratch Card screen.

**Past card (revealed):** Shows the scratch card in revealed state with the prize label. A "won" badge in accent green for prizes; a subtle grey tone for `no_prize`.

**Past card (expired):** Greyed out, "Expired" badge. No interaction.

---

### 3.4 Scratch Card Screen

**Route:** `/rewards/[instanceId]`

**Trigger:** User taps a pending reward instance from My Bookings or My Rewards.

**Layout:**

1. **Header** — "Your Reward" heading, subtitle "From your booking on [date]". Close button top-right.
2. **Card Area** — Full-width dark card with a scratch surface rendered using an HTML5 Canvas or CSS mask animation. The scratch surface uses the `card_theme` from `config_snapshot`.
3. **Instruction** — "Scratch to reveal your prize!" shown before interaction begins.
4. **Interaction** — User drags finger/mouse across the card to erase the scratch layer. At ~70% coverage, the card calls `POST /rewards/instances/:id/reveal` and receives the outcome.
5. **Reveal State** — The scratch layer fully clears to reveal the prize:
   - `no_prize`: Muted text, "Better luck next time!" No accent color.
   - `wallet_credit`: Bold accent headline "₹50 Added to Your Wallet!". Wallet balance shown updating.
   - `coupon`: Coupon code displayed in a tappable chip. "Copied!" on tap.
   - `free_booking`: "Free session on us!" message with an instruction to contact the facility.
6. **CTA** — "View My Wallet" (for credit prizes) or "Book Again" (for all others).

**Frontend rules:**
- The scratch interaction is cosmetic. The reveal API is called server-side; the frontend animates to display whatever the server returns.
- If the user partially scratches and leaves the page, the instance remains `pending`. On return, the screen shows a "Continue Scratching" state.
- If `expires_at` has passed when the user opens the screen, show an "Expired" state with no scratch interaction.
- The screen is not accessible for `revealed` instances — redirect to My Rewards.

**The `mechanism_type` field drives which frontend component renders.** If the mechanism type is `spinner`, the same route would render a spinner wheel instead. The backend response shape is identical; only the UI component changes.

---

## 4. Responsive Behaviour

All customer-facing pages are **mobile-first**. The booking page design shown in the mockups has **no bottom navigation bar** — the layout uses a sticky "Confirm & Pay" CTA at the bottom of the scroll container.

On desktop, the layout switches to a two-column arrangement: date/slot selection on the left, summary + CTA on the right. Auth gate modals become centered dialog boxes instead of bottom sheets.

---

## 5. Real-Time Slot State Sync — Deferred

> **Deferred Implementation.** At low concurrent user volume, the "slot was just taken" error returned when a user tries to lock an already-held slot is an acceptable experience. Real-time sync is added when concurrent booking contention becomes a noticeable problem.

**When implemented:** The backend broadcasts a slot-state-change event whenever a booking enters `pending_payment`, `confirmed`, or `expired` state. The frontend subscribes to the current venue/date channel and updates the slot chip state without a page refresh. Implementation options: Socket.io WebSockets or Server-Sent Events.

---

## 6. Admin Panel — Auth Pages

> [!NOTE]
> **Implementation Status: Planned API Contracts / Not Yet Implemented**
> The admin login page screen (`/admin/login`) and its underlying endpoint (`POST /auth/admin/login`) are fully implemented and functional. The remaining auth-related screens and pages (`/admin/activate`, `/admin/forgot-password`, `/admin/reset-password`, and `/admin/change-password`) are planned future contracts. They are currently inactive in the backend, awaiting configuration of the production email provider.

The admin panel is a separate authenticated surface at `/admin`. It uses credential-based auth entirely independent of the customer OTP flow.

### 6.1 Admin Login Page — `/admin/login`

**Purpose:** Entry point for all non-customer roles.

**Layout:**
- Platform logo and "Admin Panel" label at the top.
- Email input (type `email`, autofocus).
- Password input (type `password`, with show/hide toggle).
- "Sign In" primary button (full width, accent colour).
- "Forgot your password?" link → navigates to `/admin/forgot-password`.
- No self-registration link — accounts are admin-provisioned only.

**Behaviour:**
- On submit: calls `POST /auth/admin/login`.
- `next_step: "admin_dashboard"` → redirect to `/admin`.
- `next_step: "force_password_change"` → redirect to `/admin/change-password`.
- Error states rendered inline below the form (not as page-level alerts):
  - `INVALID_CREDENTIALS` → "Incorrect email or password."
  - `ACCOUNT_LOCKED` → "Account locked due to too many failed attempts. Try again at [time]."
  - `ACCOUNT_SUSPENDED` → "Your account has been suspended. Contact your administrator."
  - `ACCOUNT_NOT_ACTIVATED` → "Account not yet activated. Check your email for the activation link."

---

### 6.2 Account Activation Page — `/admin/activate`

**Purpose:** Shown when an admin user clicks the activation link in their provisioning email.

**URL shape:** `/admin/activate?token=<raw-token>`

**Layout:**
- "Set your password" heading.
- Display of the email address for the account (fetched from the token lookup).
- Password input + confirm password input.
- Password strength indicator.
- "Activate Account" button.

**Behaviour:**
- On submit: calls `POST /auth/admin/activate { token, password, password_confirm }`.
- On success: JWT stored, redirect to `/admin`.
- `INVALID_ACTIVATION_TOKEN` → "This activation link has expired or is invalid. Ask your administrator to resend the activation email."
- `PASSWORD_TOO_WEAK` → Inline validation shown before submit.

---

### 6.3 Forgot Password Page — `/admin/forgot-password`

**Layout:**
- "Reset your password" heading.
- Email input.
- "Send Reset Link" button.
- Back to login link.

**Behaviour:**
- Calls `POST /auth/admin/reset-password/request { email }`.
- Always shows: "If that email is registered, a reset link has been sent." (prevents account enumeration regardless of result).

---

### 6.4 Password Reset Page — `/admin/reset-password`

**URL shape:** `/admin/reset-password?token=<raw-token>`

**Layout:** Identical to the activation page — new password + confirm password inputs.

**Behaviour:**
- Calls `POST /auth/admin/reset-password/confirm { token, password, password_confirm }`.
- On success: JWT stored, redirect to `/admin`.
- Expired token → friendly error with link to request a new reset.

---

### 6.5 Force Password Change Page — `/admin/change-password`

Shown when `next_step: "force_password_change"` is returned after login. All other admin routes redirect here until the password is changed.

**Layout:**
- "You must change your password to continue" heading.
- Current password input + new password + confirm.
- "Update Password" button.

**Behaviour:**
- Calls `POST /auth/admin/change-password`.
- On success: clears `force_password_change` flag, redirect to `/admin`.

---

## 7. Admin Dashboard — Operational Screens

The admin dashboard is a separate authenticated web application (accessible via `/admin`). It is not part of the customer-facing Next.js pages. Access requires a valid admin JWT with the appropriate `venue_user_roles` assignment.

| Screen | Status | Key Functions |
|---|---|---|
| **Overview / Home** | Launch | Live slot grid for today across all courts, pending bookings count, today's revenue |
| **Bookings** | Launch | List and filter all bookings; create walk-ins; trigger admin-block; initiate force-cancellation + credit issuance |
| **Schedule Manager** | Launch | Edit standard operating hours, create/edit/delete schedule exceptions |
| **Pricing Manager** | Launch | Create/edit/deactivate pricing rules; manage coupons |
| **Courts** | Launch | Edit court details, status (active/maintenance/offline), cover images |
| **Users** | Launch | Look up customer by phone; view booking history, wallet balance, reward instance history |
| **Admin Account Management** | Launch | Provision new admin accounts, manage status (activate/suspend/unlock), resend activation, force password reset |
| **Settings** | Launch | Venue-level settings (rollover time, advance window, tax rate) |
| **Reward Engine** | **Deferred** | Create/edit/activate reward mechanisms; edit prize pool config; view instances — activate when reward engine is enabled |

