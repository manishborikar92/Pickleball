-- Standardize the back-office credential domain naming: staff_* -> admin_*.
-- The `staff` ROLE in the role hierarchy is intentionally unchanged; only the
-- credential/identity domain is renamed to match the `admin` console surface.

-- Enum type
ALTER TYPE "StaffStatus" RENAME TO "AdminStatus";

-- Table
ALTER TABLE "staff_credentials" RENAME TO "admin_credentials";

-- Primary key
ALTER TABLE "admin_credentials" RENAME CONSTRAINT "staff_credentials_pkey" TO "admin_credentials_pkey";

-- Foreign keys
ALTER TABLE "admin_credentials" RENAME CONSTRAINT "staff_credentials_user_id_fkey" TO "admin_credentials_user_id_fkey";
ALTER TABLE "admin_credentials" RENAME CONSTRAINT "staff_credentials_created_by_fkey" TO "admin_credentials_created_by_fkey";

-- Check constraint
ALTER TABLE "admin_credentials" RENAME CONSTRAINT "staff_credentials_failed_attempts_non_negative" TO "admin_credentials_failed_attempts_non_negative";

-- Indexes
ALTER INDEX "staff_credentials_user_id_key" RENAME TO "admin_credentials_user_id_key";
ALTER INDEX "staff_credentials_email_key" RENAME TO "admin_credentials_email_key";
ALTER INDEX "staff_credentials_status_idx" RENAME TO "admin_credentials_status_idx";
ALTER INDEX "staff_credentials_pending_activation_idx" RENAME TO "admin_credentials_pending_activation_idx";
