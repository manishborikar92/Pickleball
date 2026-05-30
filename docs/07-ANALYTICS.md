# Pickleball Platform — Analytics & Monitoring

This document defines the analytics strategy, tooling decisions, event taxonomy, privacy implementation, and monitoring approach for the platform.

---

## 1. Tool Decisions & Rationale

### 1.1 The Core Problem With Common Choices

| Tool | Why Not |
|---|---|
| **Google Analytics 4** | Cookie-based by default; requires consent banners; data is sampled at scale; overcomplicated event model; multiple EU data protection authorities have ruled against GA4 implementations; zero product analytics |
| **Hotjar** | Replaced entirely by PostHog session replay; unnecessary cost and extra script |
| **Mixpanel / Amplitude** | Priced for enterprise; far more complexity than this platform needs; no error tracking or session replay |
| **Plausible / Fathom** | Too lightweight; no funnel tracking, no session replay, no error tracking. Good for a blog, not a booking product |
| **Vercel Analytics** | Traffic data only; no funnels, no user-level data, no session replay. A convenience add-on, not a full analytics layer |

### 1.2 Recommended Stack

**Primary: PostHog** — single platform covering all analytics needs.
**Secondary: Sentry** — added only when the codebase matures and deeper backend performance tracing becomes necessary. Not needed at launch.

### 1.3 Why PostHog

PostHog is an all-in-one developer platform combining product analytics, web analytics, session replay, error tracking, feature flags, experiments, and surveys — all integrated in one place. For this platform, that means one SDK, one dashboard, one data model, and zero stitching together of separate tools.

The free tier includes 1 million analytics events, 5,000 session replay recordings, and 100,000 error events per month — resetting monthly, forever. A 2-court facility in Nagpur with a few hundred bookings per month will comfortably remain on the free tier for a long time.

PostHog supports Next.js App Router natively, covering client-side event capture, autocapture, user identification, session replay, feature flags, and error tracking.

PostHog supports cookieless tracking and is GDPR-ready and can be used without cookie consent banners when configured for privacy-first tracking.

### 1.4 When to Add Sentry

Use PostHog for measuring product usage, understanding user journeys, running experiments, and improving UX. Use Sentry for deep error monitoring, performance tracking, and debugging production issues. The combination gives you behavioral insights from PostHog and rigorous performance insights from Sentry.

Add Sentry when: the engineering team grows to a point where dedicated alerting, release tracking, distributed tracing across Express + Next.js, and on-call incident workflows become necessary. At launch, PostHog's error tracking is sufficient.

---

## 2. PostHog Pricing (Free Tier Reference)

| Product | Free Monthly Allowance | Paid Rate After Free |
|---|---|---|
| Analytics events | 1,000,000 events | From $0.00005/event |
| Session replay | 5,000 recordings | $0.005/recording |
| Error tracking | 100,000 exceptions | Usage-based |
| Feature flags | 1,000,000 requests | Usage-based |
| Surveys | 1,500 responses | Usage-based |

You can set hard monthly spend caps per product so you never pay more than expected. If you exceed a cap, PostHog stops processing that product until the next billing cycle — other products are unaffected.

Set a billing cap of $0 per product initially. Increase only when the free tier is consistently exhausted over multiple months.

---

## 3. Privacy Implementation

### 3.1 The Platform's Privacy Context

This platform is India-based and primarily serves Indian users. It is not subject to GDPR (which covers EU residents), but the **DPDP Act 2023** applies. The core principles are the same: collect only what you need, disclose what you collect, and honor deletion requests.

### 3.2 Cookieless Configuration

Configure PostHog to run without cookies. This removes the need for any cookie consent banner and significantly simplifies compliance.

```javascript
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  persistence: 'memory',           // No cookies, no localStorage
  disable_persistence: false,       // OR set to true for fully stateless
  defaults: '2025-05-24',
})
```

> **Trade-off:** Without persistence, users cannot be tracked across sessions unless they are identified via `posthog.identify()` after OTP verification. For this platform, that is acceptable — the booking funnel is completed within a single session, and identified users are linked to their verified phone number.

### 3.3 PII Masking Rules

The following data must **never** appear in any analytics event property, session replay recording, or error trace:

| Data | Reason |
|---|---|
| Phone numbers (full) | PII; primary identifier |
| OTP codes | Security-critical |
| Payment card details | PCI scope (never touches our code anyway — PhonePe handles this) |
| Full names | PII where not necessary |

**Session Replay Masking:** PostHog automatically masks password and OTP input fields. Explicitly extend masking to phone number fields and name fields:

```javascript
posthog.init(key, {
  session_recording: {
    maskAllInputs: true,              // Mask all text inputs by default
    maskInputOptions: { text: true }, // Belt-and-suspenders
  }
})
```

### 3.4 Reverse Proxy Setup

Configure a reverse proxy in Next.js to route PostHog requests through the platform's own domain. This reduces the likelihood of events being blocked by browser ad blockers and privacy extensions.

In `next.config.js`:
```javascript
async rewrites() {
  return [
    {
      source: '/ingest/static/:path*',
      destination: 'https://us-assets.i.posthog.com/static/:path*',
    },
    {
      source: '/ingest/:path*',
      destination: 'https://us.i.posthog.com/:path*',
    },
  ]
}
```

Update `api_host` in PostHog init to `/ingest`.

### 3.5 Privacy Policy Disclosure

The platform's Privacy Policy must disclose:
- That PostHog is used for analytics and session replay.
- What data is collected (page views, click events, session recordings).
- That phone numbers are used only for booking-related communications (not passed to PostHog).
- How users can request data deletion (email or in-app contact).

---

## 4. Next.js Integration

### 4.1 Setup (App Router, Next.js 15.3+)

**Install:**
```
npm install posthog-js posthog-node
```

**`instrumentation-client.ts` (client-side init, runs before any page load):**
```javascript
import posthog from 'posthog-js'

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: '/ingest',
  defaults: '2025-05-24',
  persistence: 'memory',
  autocapture: true,
  // Session replay is deferred — enable when traffic warrants it
})
```

**For Next.js < 15.3 (App Router), use a `providers.tsx` wrapper:**
```javascript
'use client'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PHProvider({ children }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: '/ingest',
      defaults: '2025-05-24',
      persistence: 'memory',
      session_recording: { maskAllInputs: true },
    })
  }, [])
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
```

### 4.2 User Identification

Identifying users is required to link events to a known user. Call `posthog.identify()` after OTP verification to connect all anonymous events from the current session to the verified profile.

Call this immediately after a successful OTP verification response:
```javascript
posthog.identify(userId, {
  // Do NOT include the full phone number
  phone_last4: phone.slice(-4),      // For support reference only
  is_new_user: isNewUser,
  city: 'Nagpur',
})
```

On logout or session end, call `posthog.reset()` to disconnect the identity from future anonymous events.

### 4.3 Backend Event Capture (Express.js)

Use `posthog-node` for server-side events where client-side tracking may not fire (e.g., webhook confirmations):

```javascript
import { PostHog } from 'posthog-node'
const client = new PostHog(process.env.POSTHOG_KEY, { host: 'https://us.i.posthog.com' })

// After booking confirmed via PhonePe webhook
client.capture({
  distinctId: userId,
  event: 'booking_confirmed',
  properties: {
    booking_id: bookingId,
    court_name: courtName,
    slot_date: slotDate,
    total_amount: totalAmount,
    source: 'webhook',
  },
})

await client.shutdown() // Always flush on serverless/short-lived functions
```

### 4.4 Error Tracking Setup

Enable autocapture of unhandled exceptions in PostHog project settings. For the Express.js backend, use `posthog-node` to capture server-side errors:

```javascript
try {
  // critical operation
} catch (error) {
  client.capture({
    distinctId: userId || 'anonymous',
    event: '$exception',
    properties: {
      $exception_message: error.message,
      $exception_type: error.name,
      context: 'payment_webhook',
    },
  })
}
```

---

## 5. Event Taxonomy

Track only events that directly support a business or product decision. Avoid tracking every micro-interaction — it generates noise and inflates event counts.

### 5.1 Booking Funnel Events (Critical)

These events form the primary conversion funnel. Every drop-off between steps is an optimization opportunity.

| Event Name | Trigger | Key Properties |
|---|---|---|
| `page_viewed` | Auto-captured by PostHog | `$current_url`, `$referrer` |
| `date_selected` | User selects a date on booking page | `date`, `days_in_advance` |
| `slot_selected` | User taps an available slot | `court_name`, `slot_time`, `slot_price` |
| `slot_hold_failed` | Backend returns 409 (slot taken) | `court_name`, `slot_time` |
| `auth_gate_opened` | Name entry sheet appears | — |
| `name_submitted` | User submits name | — |
| `otp_requested` | OTP send button tapped | — |
| `otp_verified` | OTP verified successfully | `is_new_user` |
| `otp_failed` | OTP verification failed | `attempt_number` |
| `waiver_accepted` | Both checkboxes checked | — |
| `payment_initiated` | PhonePe sheet opened | `amount`, `has_wallet_credits`, `has_coupon` |
| `booking_confirmed` | Payment success webhook received | `booking_id`, `court_name`, `total_amount`, `duration_mins` |
| `payment_failed` | Payment failure received | `gateway_error_code` |
| `booking_expired` | 10-minute hold expired | — |
| `coupon_applied` | Coupon successfully applied | `coupon_code`, `discount_amount` |
| `coupon_failed` | Invalid or expired coupon | `reason` |

### 5.2 Review & Engagement Events

| Event Name | Trigger | Key Properties |
|---|---|---|
| `review_opened` | User opens review screen via link | `booking_id` |
| `review_submitted` | User submits a review | `rating`, `has_comment`, `has_photo` |
| `reward_screen_opened` | User opens a scratch card / reward screen | `instance_id`, `mechanism_type`, `days_until_expiry` |
| `reward_revealed` | User completes scratch interaction; reveal API called | `instance_id`, `mechanism_type`, `prize_type`, `prize_value` |
| `reward_expired_on_open` | User opens a reward screen after expiry | `instance_id`, `mechanism_type` |

### 5.3 Infrastructure Events (Backend Only)

| Event Name | Trigger |
|---|---|
| `phantom_booking_detected` | Stale payment webhook arrives for expired slot |
| `webhook_duplicate_received` | Duplicate PhonePe webhook detected |
| `velocity_check_blocked` | User blocked for holding 2+ pending slots |
| `slot_expired_by_sweeper` | Background job expires a pending booking |

### 5.4 What to Avoid Tracking

| Data / Event | Reason to Avoid |
|---|---|
| Every scroll position and mouse movement | Noise; no actionable insight at this scale |
| Raw phone numbers in event properties | PII; violates DPDP Act |
| OTP values | Security critical |
| Individual keystrokes in input fields | Covered by session replay masking; redundant and invasive |
| Admin-only actions | Pollutes user funnel data; segment separately |
| Payment gateway redirect intermediary pages | Not our domain; no data captured there |

---

## 6. Key Dashboards & Reports

Create the following dashboards in PostHog from day one.

### 6.1 Booking Funnel (Primary Dashboard)

A funnel visualization tracking the full journey from `slot_selected` → `booking_confirmed`. This reveals the exact step where most users drop off.

| Step | Event |
|---|---|
| 1 | `slot_selected` |
| 2 | `otp_requested` |
| 3 | `otp_verified` |
| 4 | `payment_initiated` |
| 5 | `booking_confirmed` |

**Key questions it answers:**
- What percentage of users who select a slot complete the booking?
- At which auth step (phone → OTP → name collection) do most users abandon?
- How often does payment initiation not result in confirmation?

### 6.2 Traffic & Acquisition Dashboard

Using PostHog's built-in web analytics:

- Daily/weekly unique visitors to the landing page
- Traffic sources (direct, organic search, referral, social)
- Mobile vs. desktop split
- City and device breakdown
- Bounce rate on the booking page

### 6.3 Slot & Revenue Intelligence Dashboard — Deferred

> **Deferred Implementation.** Build this dashboard once 3+ months of booking data exists to make the signals meaningful. At launch, the basic booking list and daily revenue in the admin panel is sufficient.

When built:
- Most-selected courts and time slots.
- Average booking value over time.
- Coupon usage rate and redemption breakdown.
- Wallet credit issuance frequency (indicator of operational issues).
- `phantom_booking_detected` frequency (indicator of payment gateway latency).

### 6.4 Error & Reliability Dashboard

- Unhandled exception count over time
- `slot_hold_failed` rate (indicates high demand or potential bot activity)
- `velocity_check_blocked` frequency (anti-hoarding triggers)
- `booking_expired` rate (users abandoning at payment step)

---

## 7. Session Replay — Deferred

> **Deferred Implementation.** Session replay is not configured at launch. At low traffic volumes there are not enough sessions to make replay review a productive use of time, and the masking configuration requires careful setup to avoid capturing PII. Enable session replay when weekly booking sessions consistently exceed ~100, and when there is dedicated time to review recordings and act on the findings.

**When session replay is activated**, configure sampling and masking as follows:

```javascript
posthog.init(key, {
  session_recording: {
    maskAllInputs: true,
    sampleRate: 0.4,
  }
})
```

**Most valuable replay use cases when enabled:**
- Sessions where `slot_selected` fired but `booking_confirmed` did not — understanding abandonment.
- Sessions where `otp_failed` fired — understanding OTP UX friction.
- Sessions containing a JavaScript error.
- Mobile sessions with the date/slot selector — validating touch interaction.

---

## 8. Performance Monitoring

### 8.1 Core Web Vitals

PostHog's web analytics dashboard automatically reports Core Web Vitals (LCP, INP, CLS) for real user sessions. Monitor these at least monthly.

| Metric | Target |
|---|---|
| Largest Contentful Paint (LCP) | < 2.5 seconds |
| Interaction to Next Paint (INP) | < 200ms |
| Cumulative Layout Shift (CLS) | < 0.1 |

A slow booking page directly reduces conversion. If LCP on `/book` exceeds 3 seconds on mobile, treat it as a P1 issue.

### 8.2 What PostHog Does Not Cover

PostHog does not provide infrastructure-level monitoring (server CPU, memory, database query latency, API response times). For backend observability:

- **Express.js API response times:** Use `morgan` logging + aggregate in admin dashboards or a future APM tool (Sentry Performance or Datadog — yet to be decided).
- **PostgreSQL slow queries:** Enable `pg_stat_statements` extension and review in a periodic slow-query report.
- **Background sweeper reliability:** Log each sweep cycle outcome (slots expired, errors) to a `system_logs` table or a structured logger (e.g., Pino).

---

## 9. Environment Segregation

PostHog projects must be separated by environment to avoid test data contaminating production analytics.

| Environment | PostHog Project |
|---|---|
| Development | `pickleball-dev` |
| Staging | `pickleball-staging` |
| Production | `pickleball-prod` |

Each project has its own API key stored in the corresponding `.env` file. Never use the production project key in development or CI.

---

## 10. Implementation Checklist

Before launching to production:

- [ ] PostHog initialized with `persistence: 'memory'` (cookieless)
- [ ] Reverse proxy configured in `next.config.js`
- [ ] `posthog.identify()` called after OTP verification
- [ ] `posthog.reset()` called on logout
- [ ] All 14 funnel events listed in Section 5.1 instrumented and tested in staging
- [ ] Billing caps set to $0 per product (alert only)
- [ ] Booking funnel dashboard created (Section 6.1)
- [ ] Traffic & acquisition dashboard created (Section 6.2)
- [ ] Error autocapture enabled in PostHog project settings
- [ ] Privacy Policy updated to disclose PostHog usage
- [ ] Development and staging PostHog projects are separate from production
- [ ] Server-side PostHog client (`posthog-node`) initialized in Express.js for webhook events

**Deferred — not required at launch:**
- [ ] ~~Session replay configuration and masking~~ → Enable when weekly sessions exceed ~100
- [ ] ~~Slot & Revenue Intelligence dashboard~~ → Build after 3+ months of booking data
- [ ] ~~All input fields masked in session replay config~~ → Part of session replay activation
