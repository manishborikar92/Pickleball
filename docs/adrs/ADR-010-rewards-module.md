# ADR-010: Rewards as an Independent Domain Under `/rewards` with Voucher-Only Prizes

## Status

Approved

## Context

The platform needed the Reward Engine: each confirmed booking triggers the venue's active reward mechanisms (scratch card at launch), generating a pre-computed, hidden prize instance the customer reveals interactively. The database schema (`reward_mechanisms`, `reward_instances`) predated the implementation, and the original API specification placed the management surface under an `/admin` namespace and defined four prize types — `no_prize`, `wallet_credit`, `coupon` (booking-discount template), and `free_booking`.

Key facts established during analysis:

- No `/admin` route namespace exists anywhere in the backend — "admin" is an authorization concern (permission checks per ADR-007), not a module. ADR-009 already resolved the same tension for reviews by keeping moderation under `/reviews`.
- The booking confirmation state transition happens in exactly three repository transactions (`confirmWalletOnlyPayment`, `confirmProviderPayment`, `confirmBooking`), all funneling through `bookings.repository.js` — a single seam for atomic issuance.
- Product direction (July 2026) narrowed prize fulfillment: **rewards must not touch wallet credits**. Wallet credits remain exclusively for business-initiated cancellations and payment rollbacks. Reward prizes are **external offer vouchers** (e.g., the venue's food & beverage stall) redeemed outside the booking flow.

## Decision

Model rewards as a **first-class, self-contained module** (`server/src/modules/rewards/`) owning every reward route under a single `/rewards` prefix, with a **voucher-only prize model** and **staff-tracked redemption**.

RESTful surface (all under `/rewards`):

| Method & path | Purpose | Auth |
|---|---|---|
| `GET /rewards/instances` | Caller's instances (outcome hidden while pending) | user + onboarding |
| `GET /rewards/instances/{instanceId}` | Single owned instance | user + onboarding |
| `POST /rewards/instances/{instanceId}/reveal` | Reveal + voucher issuance, atomic | user + onboarding |
| `GET /rewards/mechanisms?venue_id=` | List a venue's mechanisms | `edit_pricing` |
| `POST /rewards/mechanisms` | Create a mechanism | `edit_pricing` |
| `PATCH /rewards/mechanisms/{mechanismId}` | Edit config/state/validity | `edit_pricing` (service-resolved) |
| `GET /rewards/instances/moderation?venue_id=` | Staff listing with voucher filters | `manage_bookings` |
| `PATCH /rewards/instances/{instanceId}/expire` | Manually expire a pending instance | `manage_bookings` (service-resolved) |
| `PATCH /rewards/instances/{instanceId}/redeem` | Mark a voucher redeemed at the stall | `manage_bookings` (service-resolved) |

Supporting decisions:

- **Issuance inside the confirmation transaction.** A `rewardIssuance` service is injected into the bookings repository and called within all three booking-confirm transactions. A booking is never confirmed without its instances; a rolled-back confirmation leaves no orphans. Duplicate trigger signals (webhook redelivery, redirect/webhook races) are absorbed by the `UNIQUE (booking_id, mechanism_id)` constraint (P2002 → skip).
- **Outcome pre-computed at issuance, revealed once.** The weighted draw runs server-side at issuance and is stored with a frozen `config_snapshot`; the client never sees the outcome until reveal. Reveal uses a status-guarded `updateMany` so concurrent reveals resolve first-wins (loser gets `409`).
- **Voucher-only prizes.** `PrizeType` is `no_prize | voucher`. A voucher prize carries a label, optional `terms`, and `validity_days`. At reveal, a unique code (`RWD-XXXXXXXX`, unique column) and redemption window are stamped in the reveal transaction. No wallet, coupon-template, or free-booking fulfillment paths exist.
- **Staff-tracked redemption.** Venue staff look up the voucher in the moderation list and redeem it; the `redeemed_at IS NULL` guard makes redemption first-wins under concurrency, preventing double-honoring at the stall.
- **Authorization on instance-scoped staff actions in the service layer**, resolved against the mechanism's own `venue_id` (routes can't know it); unauthorized callers receive `404` to avoid leaking existence — the ADR-009 pattern.
- **Expiry via the shared scheduler** (`sweep-expired-reward-instances` job) backed by a partial index on pending instances, plus lazy expiry at reveal time for sweeper lag.

## Alternatives Considered

| Alternative | Tradeoff |
|---|---|
| `/admin/reward-*` namespace per the original spec | Would introduce the first `/admin` namespace in the codebase for no gain; contradicts ADR-009's precedent |
| Wallet-credit prizes per the original spec | Entangles marketing rewards with the monetary refund ledger; rejected by product direction — vouchers keep reward liability outside the payments domain |
| Untracked ("show-and-go") voucher redemption | Simpler, but a voucher could be reused until expiry and yields no redemption analytics |
| Issue voucher codes at issuance rather than reveal | Codes for never-revealed instances would clutter the unique namespace and imply redeemability before reveal |
| Fold issuance into the bookings service layer | The service has multiple confirm entry points; the repository transaction is the single choke point where atomicity is guaranteed |

## Consequences

> **Documentation reconciliation (2026-07-21):** The product documents state this voucher-only, overlay-first implementation and explicitly classify the former wallet-credit/coupon/free-booking and standalone-route descriptions as historical design records.

- **Benefits:** Clear domain ownership; issuance atomicity for free at every present and future confirmation path (walk-ins included); reward liability decoupled from the wallet ledger; double-use prevention at the stall; independent evolution and testing of the rewards domain.
- **Trade-offs:** The Prisma enum retains `coupon_drop`/`points` mechanism values with no launch support (creation restricted to `scratch_card`/`spinner`); staff redemption requires a device at the stall.
- **Frontend shape (2026-07-16 revision):** The reveal is **overlay-first, never a route**. On arrival at the booking-confirmation page, the scratch overlay (`RewardExperience` — bottom sheet on mobile, centered dialog on desktop, with a top-right close icon) auto-presents once after a short beat; dismissed unscratched, the reward persists as a tappable foil teaser card in the right panel above the map (and on `/dashboard/rewards`), which reopens the overlay. The overlay renders through the shared SSR-safe `Portal` (`web/src/components/shared/Portal.js`, `createPortal` → `document.body`) so ancestor CSS containment contexts (transform/overflow/contain on layout wrappers) can never clip or reposition the fixed-position dialog. The scratch surface itself (`RewardReveal`) is cosmetic — canvas foil with `destination-out` strokes, ~55% coverage auto-clear, confetti via `canvas-confetti` with `disableForReducedMotion`, an explicit no-gesture reveal button for keyboard/AT users — and the outcome is always the server's pre-computed fact. **The web app exposes only the scratch-card experience**: no spinner UI, text, or option exists anywhere in the frontend (the mechanism editor pins `type: scratch_card`); the backend's `spinner` support stays dormant until a wheel component ships. Admin operations live at `/admin/rewards` (redemption desk + mechanism editor + instance table) — staff see the desk via `manage_bookings`, the mechanism panel additionally requires `edit_pricing`.
- **Divergences from product docs:** `docs/product/02-BUSINESS-LOGIC.md` §12.5 still describes the wallet-credit/coupon/free-booking prize table, and `docs/product/03-UI-UX-SPECIFICATION.md` §3.4 describes a standalone `/rewards/[instanceId]` scratch screen (both PO-owned); the authoritative model is this ADR and `docs/specs/01-DATABASE-SCHEMA.md` Domain F. Recorded in `docs/ai/03-IMPLEMENTATION-STATUS.md` §3.
- **Follow-ups:** Spinner frontend component (backend supports the type end-to-end); WhatsApp reward notification template (deferred with the rest of marketing messaging).
