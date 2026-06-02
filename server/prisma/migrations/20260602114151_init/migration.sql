-- CreateEnum
CREATE TYPE "CourtEnvironment" AS ENUM ('indoor', 'outdoor');

-- CreateEnum
CREATE TYPE "CourtStatus" AS ENUM ('active', 'maintenance', 'offline');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('pending_activation', 'active', 'suspended', 'locked');

-- CreateEnum
CREATE TYPE "AuthSessionStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('customer_login');

-- CreateEnum
CREATE TYPE "ScheduleExceptionType" AS ENUM ('closed', 'modified_hours', 'blocked');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('flat', 'percentage');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending_payment', 'confirmed', 'expired', 'cancelled', 'walk_in', 'admin_block');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('online', 'walk_in', 'admin_block');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('phonepe', 'wallet');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('initiated', 'success', 'failed', 'refund_pending', 'refunded', 'refund_failed');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('credit_issued', 'credit_redeemed');

-- CreateEnum
CREATE TYPE "RewardMechanismType" AS ENUM ('scratch_card', 'spinner', 'coupon_drop', 'points');

-- CreateEnum
CREATE TYPE "RewardTriggerEvent" AS ENUM ('booking_confirmed');

-- CreateEnum
CREATE TYPE "RewardInstanceStatus" AS ENUM ('pending', 'revealed', 'expired');

-- CreateEnum
CREATE TYPE "PrizeType" AS ENUM ('no_prize', 'wallet_credit', 'coupon', 'free_booking');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('pending', 'fulfilled', 'not_applicable', 'failed');

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "address" TEXT NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "timezone" VARCHAR(50) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "rollover_time" TIME NOT NULL,
    "advance_booking_days" SMALLINT NOT NULL DEFAULT 7,
    "phone" VARCHAR(20),
    "secondary_phone" VARCHAR(20),
    "email" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "surface_type" VARCHAR(50),
    "environment" "CourtEnvironment" NOT NULL,
    "description" TEXT,
    "cover_image_url" VARCHAR(500),
    "status" "CourtStatus" NOT NULL DEFAULT 'active',
    "display_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255),
    "is_phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_completed_at" TIMESTAMPTZ(6),
    "wallet_credits" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "venue_user_roles" (
    "user_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,

    CONSTRAINT "venue_user_roles_pkey" PRIMARY KEY ("user_id","venue_id")
);

-- CreateTable
CREATE TABLE "staff_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT,
    "status" "StaffStatus" NOT NULL DEFAULT 'pending_activation',
    "activation_token_hash" TEXT,
    "activation_token_expires_at" TIMESTAMPTZ(6),
    "password_reset_token_hash" TEXT,
    "password_reset_expires_at" TIMESTAMPTZ(6),
    "failed_login_attempts" SMALLINT NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "force_password_change" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ(6),
    "last_login_ip" INET,
    "password_changed_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "staff_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" VARCHAR(20) NOT NULL,
    "purpose" "OtpPurpose" NOT NULL DEFAULT 'customer_login',
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "verified_at" TIMESTAMPTZ(6),
    "attempt_count" SMALLINT NOT NULL DEFAULT 0,
    "ip_address" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "status" "AuthSessionStatus" NOT NULL DEFAULT 'active',
    "ip_address" INET,
    "user_agent" TEXT,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "parent_token_id" UUID,
    "replaced_by_token_id" UUID,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "day_of_week" INTEGER[],
    "open_time" TIME NOT NULL,
    "close_time" TIME NOT NULL,
    "slot_duration_mins" SMALLINT NOT NULL DEFAULT 60,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_exceptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID NOT NULL,
    "court_id" UUID,
    "exception_date" DATE NOT NULL,
    "exception_type" "ScheduleExceptionType" NOT NULL,
    "open_time" TIME,
    "close_time" TIME,
    "reason" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID NOT NULL,
    "court_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "rule" JSONB NOT NULL,
    "priority" SMALLINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "base_prices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "court_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "base_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID,
    "code" VARCHAR(50) NOT NULL,
    "discount_type" "DiscountType" NOT NULL,
    "discount_value" DECIMAL(10,2) NOT NULL,
    "max_uses_total" INTEGER,
    "max_uses_per_phone" SMALLINT NOT NULL DEFAULT 1,
    "valid_from" TIMESTAMPTZ(6),
    "valid_until" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_usages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "coupon_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "slot_date" DATE NOT NULL,
    "session_start_time" TIME NOT NULL,
    "session_end_time" TIME NOT NULL,
    "session_duration_mins" SMALLINT NOT NULL,
    "court_count" SMALLINT NOT NULL,
    "slot_unit_count" SMALLINT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending_payment',
    "booking_type" "BookingType" NOT NULL DEFAULT 'online',
    "base_amount" DECIMAL(10,2) NOT NULL,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "credits_applied" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "coupon_id" UUID,
    "expires_at" TIMESTAMPTZ(6),
    "waiver_accepted" BOOLEAN NOT NULL DEFAULT false,
    "waiver_accepted_at" TIMESTAMPTZ(6),
    "waiver_ip_address" INET,
    "access_pin" CHAR(4),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_slots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "court_id" UUID NOT NULL,
    "slot_date" DATE NOT NULL,
    "slot_start_time" TIME NOT NULL,
    "slot_end_time" TIME NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "gateway" "PaymentGateway" NOT NULL DEFAULT 'phonepe',
    "merchant_order_id" VARCHAR(255),
    "gateway_order_id" VARCHAR(255),
    "gateway_payment_id" VARCHAR(255),
    "upi_vpa" VARCHAR(255),
    "payment_mode" VARCHAR(30),
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "status" "PaymentStatus" NOT NULL DEFAULT 'initiated',
    "webhook_received_at" TIMESTAMPTZ(6),
    "idempotency_key" VARCHAR(255),
    "merchant_refund_id" VARCHAR(255),
    "refund_amount" DECIMAL(10,2),
    "refund_initiated_at" TIMESTAMPTZ(6),
    "refund_completed_at" TIMESTAMPTZ(6),
    "raw_webhook_payload" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "booking_id" UUID,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "balance_after" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" TEXT,
    "photo_url" VARCHAR(500),
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_mechanisms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "RewardMechanismType" NOT NULL,
    "trigger_event" "RewardTriggerEvent" NOT NULL DEFAULT 'booking_confirmed',
    "config" JSONB NOT NULL,
    "instance_expiry_days" SMALLINT NOT NULL DEFAULT 7,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "valid_from" TIMESTAMPTZ(6),
    "valid_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "reward_mechanisms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_instances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mechanism_id" UUID NOT NULL,
    "mechanism_type" "RewardMechanismType" NOT NULL,
    "user_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "status" "RewardInstanceStatus" NOT NULL DEFAULT 'pending',
    "config_snapshot" JSONB NOT NULL,
    "outcome" JSONB NOT NULL,
    "prize_type" "PrizeType" NOT NULL,
    "prize_value" DECIMAL(10,2),
    "revealed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "fulfillment_status" "FulfillmentStatus" NOT NULL DEFAULT 'pending',
    "fulfillment_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "venues_slug_key" ON "venues"("slug");

-- CreateIndex
CREATE INDEX "venues_is_active_idx" ON "venues"("is_active");

-- CreateIndex
CREATE INDEX "courts_venue_id_status_display_order_idx" ON "courts"("venue_id", "status", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_name_idx" ON "users"("name");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "venue_user_roles_venue_id_role_id_idx" ON "venue_user_roles"("venue_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_credentials_user_id_key" ON "staff_credentials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_credentials_email_key" ON "staff_credentials"("email");

-- CreateIndex
CREATE INDEX "staff_credentials_status_idx" ON "staff_credentials"("status");

-- CreateIndex
CREATE INDEX "otp_requests_phone_created_at_idx" ON "otp_requests"("phone", "created_at");

-- CreateIndex
CREATE INDEX "otp_requests_expires_at_idx" ON "otp_requests"("expires_at");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_status_idx" ON "auth_sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_revoked_at_idx" ON "refresh_tokens"("session_id", "revoked_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_created_at_idx" ON "refresh_tokens"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "schedules_venue_id_court_id_is_active_idx" ON "schedules"("venue_id", "court_id", "is_active");

-- CreateIndex
CREATE INDEX "schedule_exceptions_venue_id_exception_date_idx" ON "schedule_exceptions"("venue_id", "exception_date");

-- CreateIndex
CREATE INDEX "schedule_exceptions_court_id_exception_date_idx" ON "schedule_exceptions"("court_id", "exception_date");

-- CreateIndex
CREATE INDEX "pricing_rules_venue_id_is_active_priority_idx" ON "pricing_rules"("venue_id", "is_active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "base_prices_court_id_key" ON "base_prices"("court_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_venue_id_is_active_idx" ON "coupons"("venue_id", "is_active");

-- CreateIndex
CREATE INDEX "coupon_usages_coupon_id_phone_idx" ON "coupon_usages"("coupon_id", "phone");

-- CreateIndex
CREATE INDEX "bookings_status_expires_at_idx" ON "bookings"("status", "expires_at");

-- CreateIndex
CREATE INDEX "bookings_user_id_status_idx" ON "bookings"("user_id", "status");

-- CreateIndex
CREATE INDEX "bookings_venue_id_slot_date_idx" ON "bookings"("venue_id", "slot_date");

-- CreateIndex
CREATE INDEX "booking_slots_booking_id_idx" ON "booking_slots"("booking_id");

-- CreateIndex
CREATE INDEX "booking_slots_court_id_slot_date_idx" ON "booking_slots"("court_id", "slot_date");

-- CreateIndex
CREATE UNIQUE INDEX "payments_merchant_order_id_key" ON "payments"("merchant_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payments_merchant_refund_id_key" ON "payments"("merchant_refund_id");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "wallet_transactions_user_id_created_at_idx" ON "wallet_transactions"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");

-- CreateIndex
CREATE INDEX "reviews_venue_id_is_published_created_at_idx" ON "reviews"("venue_id", "is_published", "created_at");

-- CreateIndex
CREATE INDEX "reward_mechanisms_venue_id_is_active_trigger_event_idx" ON "reward_mechanisms"("venue_id", "is_active", "trigger_event");

-- CreateIndex
CREATE INDEX "reward_instances_user_id_status_idx" ON "reward_instances"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reward_instances_booking_id_mechanism_id_key" ON "reward_instances"("booking_id", "mechanism_id");

-- AddForeignKey
ALTER TABLE "courts" ADD CONSTRAINT "courts_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_user_roles" ADD CONSTRAINT "venue_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_user_roles" ADD CONSTRAINT "venue_user_roles_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_user_roles" ADD CONSTRAINT "venue_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_user_roles" ADD CONSTRAINT "venue_user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_credentials" ADD CONSTRAINT "staff_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_credentials" ADD CONSTRAINT "staff_credentials_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "base_prices" ADD CONSTRAINT "base_prices_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_slots" ADD CONSTRAINT "booking_slots_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_mechanisms" ADD CONSTRAINT "reward_mechanisms_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_instances" ADD CONSTRAINT "reward_instances_mechanism_id_fkey" FOREIGN KEY ("mechanism_id") REFERENCES "reward_mechanisms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_instances" ADD CONSTRAINT "reward_instances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_instances" ADD CONSTRAINT "reward_instances_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
