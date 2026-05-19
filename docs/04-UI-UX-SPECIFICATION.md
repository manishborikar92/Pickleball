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
- **Multi-select rule:** The user can tap any available slot to start a selection. Tapping an adjacent slot extends the range. Tapping a non-adjacent slot shows an inline warning: "Slots must be consecutive. Tap an adjoining slot to extend your selection."
- Slots that are booked, pending, or blocked are greyed out and non-interactive.
- When both courts are selected, the slot grids must show the **intersection of available slots** highlighted — slots that are available on at least one court show normally, but the price-preview reflects both courts' pricing.
- Selected slots are highlighted in accent colour. The range is visualised as a connected bar across the selected chips.
- Deselecting a slot in the middle of a range clears the entire selection (no gaps allowed).

**Section 5 — Live Summary**
- Updates in real-time as courts and slots are selected/deselected.
- Shows: "Court 1 + Court 2 · Sunday 11 May · 9:00 AM – 12:00 PM (3 hrs)"
- Price table: per-unit breakdown (collapsible) + subtotal + tax + total.
- Price data comes from the `/bookings/price-preview` endpoint, triggered on every selection change (debounced 300ms).
- Promo code input with "Apply" button — applying a coupon re-calls price-preview with `coupon_code`.
- Wallet credit toggle (if user is authenticated and has a balance).

**Sticky Bottom CTA**
- "Confirm & Pay" pill button — disabled until at least one court and one slot are selected.
- "🔒 Secure checkout" micro-label beneath.
- Tapping triggers the auth gate (if not verified), then the hold API call.

---

### 2.3 Auth Gate — Bottom Sheet Sequence

The auth gate appears as a sequence of bottom-sheet modals layered over the blurred Checkout page. The user progresses through three steps before payment.

#### Step 1 — Name Entry

**Trigger:** User taps "Confirm & Pay" for the first time (unauthenticated).

**Content:**
- Top of bottom sheet: blurred preview of the order summary visible above.
- Heading: "Almost there!"
- Subheading: "Tell us your name to finish your booking."
- Input field labeled "FULL NAME" with a person icon placeholder.
- CTA: "Next →"

**Validation:** Name must be non-empty, at least 2 characters.

---

#### Step 2 — Phone Entry

**Trigger:** User submits name.

**Content:**
- Phone icon in a circular container at top of sheet.
- Heading: "Verify to Book"
- Subheading: "Enter your phone number to receive a 4-digit code."
- Input field: Flag emoji + "+91" prefix (fixed), followed by 10-digit phone number entry.
- CTA: "Send OTP →"

**Behaviour:**
- The "+91" country code is pre-filled and non-editable (India only at launch).
- Tapping "Send OTP" calls the backend which triggers a WhatsApp OTP message.
- If the user already has 2 pending bookings, the backend returns an error at this step and the flow is blocked.

---

#### Step 3 — OTP Entry

**Trigger:** OTP sent successfully.

**Content:**
- Heading: "Enter Code"
- Subheading: "Sent to +91 XXXXX XXXXX" (masked phone number).
- 6-box OTP input (one digit per box). The first box is auto-focused. On mobile, the numeric keyboard appears automatically.
- "↺ Resend Code" link (rate-limited; appears after a countdown timer).
- CTA: "Verify OTP"

**Behaviour:**
- Each digit auto-advances focus to the next box.
- On successful verification, the backend links the booking to the user profile and proceeds to the waiver/payment step.
- If OTP is incorrect, an inline error is shown. After N failed attempts, the OTP is invalidated and the user must request a new one.

---

### 2.4 Checkout — Waiver & Payment

**Trigger:** OTP verified successfully.

**Content:**
- Full order summary rendered clearly: venue, court, date, time (full unambiguous format, e.g., "Sunday, 11 May 2025 — 09:00 AM to 10:00 AM").
- Two mandatory checkboxes (both must be checked to enable Pay):
  1. "I confirm my booking is for [full time string] and I understand this is non-refundable."
  2. "I accept the Terms & Conditions and Liability Waiver."
- Final total amount displayed.
- CTA: "Confirm & Pay" → opens PhonePe payment sheet.

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

### 2.6 Rate Your Experience Screen

**Trigger:** Automatically triggered via WhatsApp link after the booking slot end time has passed.

**Route:** `/review/[booking_id]`

**Content (top to bottom):**

1. **Hero** — Full-bleed dark court image (same as on landing). "✕" close button top-left.
2. **Header** — "Thank you for playing!" heading. Venue name with location pin (e.g., "Court 3 – The Apex Club").
3. **Rating Card** — Dark card with "How was your experience?" heading. "Tap a star to rate your session." subtext. Five-star tap-to-rate row (filled stars in accent yellow-green).
4. **Share Your Thoughts** — "Share your thoughts" section label. Multi-line text input with placeholder: "How was the court surface? Did you have a good game?" Labeled "Optional" in bottom-right corner.
5. **Add a Photo** — "Add a photo" section label. Dashed-border upload area with camera icon and "Tap to upload a court selfie" label.
6. **Sticky CTA** — "▶ SUBMIT REVIEW" full-width accent button.

**Behaviour:**
- Star rating is required to enable submit.
- Photo upload sends the file to Cloudflare R2 and stores the URL in the `reviews.photo_url` column.
- After submit, a success state is shown and the screen is no longer accessible for that booking.

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

## 6. Admin Dashboard — High-Level Screens

The admin dashboard is a separate authenticated web application (accessible via `/admin`). It is not part of the customer-facing Next.js pages.

| Screen | Status | Key Functions |
|---|---|---|
| **Overview / Home** | Launch | Live slot grid for today across all courts, pending bookings count, today's revenue |
| **Bookings** | Launch | List and filter all bookings; create walk-ins; trigger admin-block; initiate force-cancellation + credit issuance |
| **Schedule Manager** | Launch | Edit standard operating hours, create/edit/delete schedule exceptions |
| **Pricing Manager** | Launch | Create/edit/deactivate pricing rules; manage coupons |
| **Courts** | Launch | Edit court details, status (active/maintenance/offline), cover images |
| **Users** | Launch | Look up user by phone; view booking history, wallet balance, reward instance history |
| **Settings** | Launch | Venue-level settings (rollover time, advance window, tax rate) |
| **Reward Engine** | **Deferred** | Create/edit/activate reward mechanisms; edit prize pool config; view instances — activate when reward engine is enabled |
| **Analytics — Advanced** | **Deferred** | Utilization heatmaps, revenue trends, coupon usage, CLV reporting — built after 3+ months of data |
