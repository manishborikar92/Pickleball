/**
 * schemas/bookingSelection.js — Booking selection payload (ADR-W003).
 *
 * Validates the payload sent to price-preview / hold, mirroring the backend Joi
 * contract: a venue, at least one court, an ISO date, and at least one slot
 * start time. `coupon_code` is optional. This is the authoritative server-side
 * guard for the checkout mutation actions (HI-2).
 */
import { z } from "zod";

export const bookingSelectionSchema = z.object({
  venue_id: z.string().min(1, "A venue is required."),
  court_ids: z.array(z.string().min(1)).min(1, "Select at least one court."),
  slot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a valid date."),
  slot_start_times: z.array(z.string().min(1)).min(1, "Select at least one time slot."),
  coupon_code: z.string().trim().toUpperCase().optional(),
});
