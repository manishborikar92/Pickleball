/**
 * schemas/bookingSelection.js — Booking selection payload (ADR-W003).
 *
 * Validates the payload sent to price-preview / hold, mirroring the backend Joi
 * contract: a venue, 1–8 courts, an ISO date, and 1–12 slot start times
 * (bookings.validators.js caps). `coupon_code` is optional. This is the
 * authoritative server-side guard for the checkout mutation actions (HI-2).
 */
import { z } from "zod";

import { MAX_SESSION_COURTS, MAX_SESSION_SLOTS } from "../bookingEngine.js";

export const bookingSelectionSchema = z.object({
  venue_id: z.string().min(1, "A venue is required."),
  court_ids: z
    .array(z.string().min(1))
    .min(1, "Select at least one court.")
    .max(MAX_SESSION_COURTS, `You can book up to ${MAX_SESSION_COURTS} courts in one session.`),
  slot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a valid date."),
  slot_start_times: z
    .array(z.string().min(1))
    .min(1, "Select at least one time slot.")
    .max(MAX_SESSION_SLOTS, `You can book up to ${MAX_SESSION_SLOTS} consecutive slots in one session.`),
  coupon_code: z.string().trim().toUpperCase().optional(),
});
