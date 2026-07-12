/**
 * schemas/phone.js — Indian mobile number (ADR-W003).
 *
 * Produces the same normalized output as the former `validatePhone`:
 * strips non-digits, drops a leading `91` country code, validates a 10-digit
 * `[6-9]XXXXXXXXX`, and returns the E.164 form `+91XXXXXXXXXX`.
 */
import { z } from "zod";

export const phoneSchema = z
  .string()
  .transform((value) => {
    const digits = String(value || "").replace(/\D/g, "");
    return digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  })
  .refine((national) => /^[6-9]\d{9}$/.test(national), {
    message: "Enter a valid 10-digit Indian mobile number.",
  })
  .transform((national) => `+91${national}`);
