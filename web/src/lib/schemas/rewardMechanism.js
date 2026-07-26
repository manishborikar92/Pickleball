/**
 * schemas/rewardMechanism.js — Reward mechanism editor (ADR-W003).
 *
 * Mirrors the backend contract (rewards.validators.js): prize probabilities
 * must sum to exactly 1.0 (float tolerance), prize ids unique, voucher-only
 * fields forbidden on no_prize entries. The same schema powers instant client
 * feedback and the authoritative server-action validation.
 */
import { z } from "zod";
import { collapseSpaces } from "./name.js";

const PROBABILITY_SUM_TOLERANCE = 1e-9;

const prizeSchema = z
  .object({
    id: z.string().trim().min(1, "Every prize needs an id.").max(50),
    label: z.preprocess(
      (value) => collapseSpaces(value),
      z.string().min(1, "Every prize needs a label.").max(255),
    ),
    type: z.enum(["no_prize", "voucher"]),
    probability: z.coerce
      .number()
      .gt(0, "Probability must be greater than 0.")
      .max(1, "Probability cannot exceed 1."),
    terms: z.preprocess(
      (value) => collapseSpaces(value).slice(0, 500),
      z.string(),
    ),
    validity_days: z.coerce
      .number()
      .int("Validity must be a whole number of days.")
      .min(1, "Validity must be at least 1 day.")
      .max(365, "Validity cannot exceed 365 days.")
      .optional(),
  })
  .superRefine((prize, ctx) => {
    if (prize.type !== "voucher") {
      if (prize.terms) {
        ctx.addIssue({ code: "custom", path: ["terms"], message: "Terms only apply to voucher prizes." });
      }
      if (prize.validity_days !== undefined) {
        ctx.addIssue({ code: "custom", path: ["validity_days"], message: "Validity only applies to voucher prizes." });
      }
    }
  });

export const rewardMechanismSchema = z
  .object({
    name: z.preprocess(
      (value) => collapseSpaces(value),
      z.string().min(1, "Give the mechanism a name.").max(255),
    ),
    // Configures the reward experience.
    type: z.enum(["scratch_card"]),
    instance_expiry_days: z.coerce
      .number()
      .int("Expiry must be a whole number of days.")
      .min(1, "Expiry must be at least 1 day.")
      .max(365, "Expiry cannot exceed 365 days."),
    is_active: z.boolean(),
    prizes: z
      .array(prizeSchema)
      .min(1, "Add at least one prize.")
      .max(20, "A prize pool holds at most 20 entries."),
  })
  .superRefine((mechanism, ctx) => {
    const ids = new Set(mechanism.prizes.map((prize) => prize.id));
    if (ids.size !== mechanism.prizes.length) {
      ctx.addIssue({ code: "custom", path: ["prizes"], message: "Prize ids must be unique." });
    }
    const sum = mechanism.prizes.reduce((total, prize) => total + prize.probability, 0);
    if (Math.abs(sum - 1) > PROBABILITY_SUM_TOLERANCE) {
      ctx.addIssue({
        code: "custom",
        path: ["prizes"],
        message: `Prize probabilities must sum to exactly 1.0 (currently ${Number(sum.toFixed(6))}).`,
      });
    }
  });

/** Staff redemption note (optional, whitespace-collapsed, backend cap 500). */
export const redemptionNoteSchema = z.preprocess(
  (value) => collapseSpaces(value).slice(0, 500),
  z.string(),
);
