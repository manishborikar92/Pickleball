/**
 * schemas/otp.js — 6-digit WhatsApp OTP (ADR-W003).
 * Strips non-digits, requires exactly 6 digits. Returns the digit string.
 */
import { z } from "zod";

export const otpSchema = z
  .string()
  .transform((value) => String(value || "").replace(/\D/g, ""))
  .refine((value) => /^\d{6}$/.test(value), {
    message: "Enter the 6-digit verification code.",
  });
