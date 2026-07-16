/**
 * schemas — Barrel for the shared Zod validation schemas (ADR-W003).
 *
 * One schema per input, reused on BOTH sides: the client form reuses it for
 * instant UX feedback, and the Server Action `safeParse`s it authoritatively so
 * a direct action call cannot bypass validation (HI-2). Replaces the former
 * hand-rolled, client-only `lib/validation.js`.
 *
 * Explicit `.js` extensions so `node:test` (raw Node ESM) can load these too.
 */
export { phoneSchema } from "./phone.js";
export { otpSchema } from "./otp.js";
export { nameSchema, collapseSpaces } from "./name.js";
export { couponSchema } from "./coupon.js";
export { reviewSchema } from "./review.js";
export { rewardMechanismSchema, redemptionNoteSchema } from "./rewardMechanism.js";
export { bookingSelectionSchema } from "./bookingSelection.js";
