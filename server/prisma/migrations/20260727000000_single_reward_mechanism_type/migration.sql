-- Clean up obsolete reward mechanism records if present before updating enum
UPDATE "reward_mechanisms" SET "deleted_at" = NOW() WHERE "type"::text IN ('spinner', 'coupon_drop', 'points');

-- Alter ENUM RewardMechanismType to contain scratch_card
CREATE TYPE "RewardMechanismType_new" AS ENUM ('scratch_card');
ALTER TABLE "reward_mechanisms" ALTER COLUMN "type" TYPE "RewardMechanismType_new" USING ("type"::text::"RewardMechanismType_new");
ALTER TABLE "reward_instances" ALTER COLUMN "mechanism_type" TYPE "RewardMechanismType_new" USING ("mechanism_type"::text::"RewardMechanismType_new");
DROP TYPE "RewardMechanismType";
ALTER TYPE "RewardMechanismType_new" RENAME TO "RewardMechanismType";
