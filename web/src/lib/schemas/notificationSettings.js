/**
 * schemas/notificationSettings.js — Admin notification toggles (ADR-W003).
 *
 * Mirrors the backend contract (notifications.validators.js): one or both
 * toggles may be provided. The same schema powers instant client feedback and
 * the authoritative server-action validation (HI-2).
 */
import { z } from "zod";

export const notificationSettingsSchema = z
  .object({
    reminders_enabled: z.boolean().optional(),
    review_requests_enabled: z.boolean().optional(),
  })
  .refine((value) => value.reminders_enabled !== undefined || value.review_requests_enabled !== undefined, {
    message: "Change at least one notification setting.",
  });

/** Single-toggle update (the settings UI flips one switch at a time). */
export const notificationToggleSchema = z.object({
  key: z.enum(["reminders_enabled", "review_requests_enabled"]),
  enabled: z.boolean(),
});
