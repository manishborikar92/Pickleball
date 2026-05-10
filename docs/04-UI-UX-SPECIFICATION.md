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

**Purpose:** The primary booking interface. Users select a date, time slot, review the price summary, and initiate the auth+payment flow.

**Layout (single scrollable page, no bottom navigation bar):**

**Section 1 — Court Hero**
- Full-width court image at the top.
- "Premium Court" badge overlaid on the image.
- Court/venue name in large bold text below.
- Location address with pin icon.

**Section 2 — Select Date & Time**
- Horizontal scrollable date strip showing short-format day labels (FRI 8 MAY, SAT 9 MAY, SUN 10 MAY…). Selected date is highlighted in accent color.
- A calendar icon at the end of the strip opens a full calendar picker for dates beyond the visible strip.
- Below the date strip, courts are listed vertically (Court 1, Court 2, etc.).
- Under each court, slot chips are arranged in a 2-column grid.
- **Slot chip states:** Available → tap to select (turns accent green). Booked → strikethrough, non-interactive. Currently selected → accent background.
- Only one slot can be selected at a time across all courts (selecting a new slot deselects the previous).
- The date strip respects the advance booking window and rollover time (dates beyond the window are hidden or non-interactive).

**Section 3 — Summary**
- "Summary" heading with a receipt icon.
- Line items: Court Fee (X mins) / Equipment Rental (if applicable) / Service Fee.
- Promo code input field with "Apply" button (accent).
- Divider line.
- Total amount in large bold text with the currency symbol.

**Sticky Bottom CTA**
- "Confirm & Pay" pill button (full width, accent color).
- "🔒 Secure checkout" micro-label beneath.
- Tapping this button triggers the Auth Gate flow if the user is not verified.

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

### 3.2 Wallet & Credits

Shows current `wallet_credits` balance and a list of `wallet_transactions` (credits issued, credits redeemed) with dates and reasons.

---

## 4. Responsive Behaviour

All customer-facing pages are **mobile-first**. The booking page design shown in the mockups has **no bottom navigation bar** — the layout uses a sticky "Confirm & Pay" CTA at the bottom of the scroll container.

On desktop, the layout switches to a two-column arrangement: date/slot selection on the left, summary + CTA on the right. Auth gate modals become centered dialog boxes instead of bottom sheets.

---

## 5. Real-Time Slot State Sync

When a user has the booking page open and another user locks a slot, the just-locked slot must visually transition to "Unavailable" without requiring a page refresh.

**Implementation:** Yet to be decided (Socket.io WebSockets or Server-Sent Events). The backend broadcasts a slot-state-change event whenever a booking enters `pending_payment`, `confirmed`, or `expired` state. The frontend subscribes to the current venue/date channel and updates the slot chip state on receiving the event.

---

## 6. Admin Dashboard — High-Level Screens

The admin dashboard is a separate authenticated web application (accessible via `/admin`). It is not part of the customer-facing Next.js pages.

| Screen | Key Functions |
|---|---|
| **Overview / Home** | Live slot grid for today across all courts, pending bookings count, today's revenue |
| **Schedule Manager** | Edit standard operating hours, create/edit/delete schedule exceptions |
| **Pricing Manager** | Create/edit/deactivate pricing rules; manage coupons |
| **Bookings** | List and filter all bookings; create walk-ins; trigger admin-block; initiate force-cancellation + credit issuance |
| **Courts** | Edit court details, status (active/maintenance/offline), cover images |
| **Users** | Look up user by phone; view booking history, wallet balance, credit activity |
| **Analytics** | Utilization heatmaps, revenue by court/period, coupon usage, review summaries |
| **Settings** | Venue-level settings (rollover time, advance window, tax rate, notification templates) |
