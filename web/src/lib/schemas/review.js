/**
 * schemas/review.js — Session review (ADR-W003).
 * Rating is a required integer 1–5; comment is optional and whitespace-collapsed,
 * capped at 1000 chars to match the backend contract.
 */
import { z } from "zod";
import { collapseSpaces } from "./name.js";

export const reviewSchema = z.object({
  rating: z.coerce
    .number()
    .int()
    .min(1, "Choose a star rating between 1 and 5.")
    .max(5, "Choose a star rating between 1 and 5."),
  // Optional. Preprocess collapses whitespace and caps length, turning a missing
  // or null comment into "" so the output is always a validated string.
  comment: z.preprocess(
    (value) => collapseSpaces(value).slice(0, 1000),
    z.string(),
  ),
});
