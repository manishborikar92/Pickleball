/**
 * schemas/name.js — Customer full name (ADR-W003).
 * Collapses internal whitespace, trims, requires ≥ 2 chars. Returns the name.
 */
import { z } from "zod";

export const collapseSpaces = (value) => String(value || "").trim().replace(/\s+/g, " ");

export const nameSchema = z
  .string()
  .transform(collapseSpaces)
  .refine((value) => value.length >= 2, {
    message: "Enter your full name.",
  });
