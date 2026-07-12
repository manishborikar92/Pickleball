/**
 * schemas/coupon.js — Promo code (ADR-W003).
 * Trims + uppercases, requires 3–50 chars of [A-Z0-9_-]. Returns the code.
 */
import { z } from "zod";

export const couponSchema = z
  .string()
  .transform((value) => String(value || "").trim().toUpperCase())
  .refine((value) => value.length > 0, { message: "Enter a promo code." })
  .refine((value) => /^[A-Z0-9_-]{3,50}$/.test(value), {
    message: "Enter a valid promo code.",
  });
