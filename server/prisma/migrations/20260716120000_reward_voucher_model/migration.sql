-- Reward Engine: voucher fulfillment model (PO direction 2026-07-16).
-- Rewards are external offer vouchers (e.g. venue F&B stall) with staff-tracked
-- redemption — never wallet credits. The reward tables predate any issuance
-- (feature was never active), so the reshape needs no data backfill.

-- Prize types collapse to no_prize | voucher.
ALTER TYPE "PrizeType" RENAME TO "PrizeType_old";
CREATE TYPE "PrizeType" AS ENUM ('no_prize', 'voucher');

-- Reshape reward_instances: drop wallet-era fulfillment columns, add the
-- voucher lifecycle (unique code, redemption validity, staff redemption stamp).
ALTER TABLE "reward_instances"
  DROP COLUMN "prize_value",
  DROP COLUMN "fulfillment_status",
  DROP COLUMN "fulfillment_note",
  ALTER COLUMN "prize_type" TYPE "PrizeType" USING (
    CASE WHEN "prize_type"::text = 'no_prize' THEN 'no_prize' ELSE 'voucher' END::"PrizeType"
  ),
  ADD COLUMN "voucher_code" VARCHAR(20),
  ADD COLUMN "voucher_valid_until" TIMESTAMPTZ(6),
  ADD COLUMN "redeemed_at" TIMESTAMPTZ(6),
  ADD COLUMN "redemption_note" TEXT;

DROP TYPE "PrizeType_old";
DROP TYPE "FulfillmentStatus";

-- Voucher codes are shown at the stall and looked up by staff — globally unique.
CREATE UNIQUE INDEX "reward_instances_voucher_code_key"
ON "reward_instances" ("voucher_code");

-- A redemption can only exist for a revealed voucher that has a code.
ALTER TABLE "reward_instances"
  ADD CONSTRAINT "reward_instances_redemption_requires_voucher"
  CHECK ("redeemed_at" IS NULL OR "voucher_code" IS NOT NULL);

-- Sweep support: the reward-instance expiry sweeper repeatedly scans for
-- pending instances past their expiry. A partial index keeps that scan cheap
-- as revealed/expired rows accumulate (same pattern as payments_initiated_idx).
CREATE INDEX "reward_instances_pending_expiry_idx"
ON "reward_instances" ("expires_at")
WHERE "status" = 'pending';
