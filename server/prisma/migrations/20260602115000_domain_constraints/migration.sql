-- Domain check constraints.
ALTER TABLE "users"
  ADD CONSTRAINT "users_wallet_credits_non_negative"
  CHECK ("wallet_credits" >= 0);

ALTER TABLE "staff_credentials"
  ADD CONSTRAINT "staff_credentials_failed_attempts_non_negative"
  CHECK ("failed_login_attempts" >= 0);

ALTER TABLE "otp_requests"
  ADD CONSTRAINT "otp_requests_attempt_count_non_negative"
  CHECK ("attempt_count" >= 0);

ALTER TABLE "auth_sessions"
  ADD CONSTRAINT "auth_sessions_expire_after_creation"
  CHECK ("expires_at" > "created_at");

ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_expire_after_creation"
  CHECK ("expires_at" > "created_at");

ALTER TABLE "schedules"
  ADD CONSTRAINT "schedules_close_after_open"
  CHECK ("close_time" > "open_time");

ALTER TABLE "schedules"
  ADD CONSTRAINT "schedules_slot_duration_allowed"
  CHECK ("slot_duration_mins" IN (30, 60, 90, 120));

ALTER TABLE "schedule_exceptions"
  ADD CONSTRAINT "schedule_exceptions_modified_hours_complete"
  CHECK (
    "exception_type" <> 'modified_hours'
    OR ("open_time" IS NOT NULL AND "close_time" IS NOT NULL AND "close_time" > "open_time")
  );

ALTER TABLE "base_prices"
  ADD CONSTRAINT "base_prices_amount_non_negative"
  CHECK ("amount" >= 0);

ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_discount_value_non_negative"
  CHECK ("discount_value" >= 0);

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_amounts_non_negative"
  CHECK (
    "base_amount" >= 0
    AND "discount_amount" >= 0
    AND "tax_amount" >= 0
    AND "total_amount" >= 0
    AND "credits_applied" >= 0
  );

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_session_time_valid"
  CHECK ("session_end_time" > "session_start_time");

ALTER TABLE "booking_slots"
  ADD CONSTRAINT "booking_slots_time_valid"
  CHECK ("slot_end_time" > "slot_start_time");

ALTER TABLE "booking_slots"
  ADD CONSTRAINT "booking_slots_unit_price_non_negative"
  CHECK ("unit_price" >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_non_negative"
  CHECK ("amount" >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_refund_amount_non_negative"
  CHECK ("refund_amount" IS NULL OR "refund_amount" >= 0);

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_balance_non_negative"
  CHECK ("balance_after" >= 0);

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_range"
  CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "reward_mechanisms"
  ADD CONSTRAINT "reward_mechanisms_instance_expiry_positive"
  CHECK ("instance_expiry_days" > 0);

ALTER TABLE "reward_instances"
  ADD CONSTRAINT "reward_instances_prize_value_non_negative"
  CHECK ("prize_value" IS NULL OR "prize_value" >= 0);

-- PostgreSQL-specific indexes Prisma cannot fully express.
CREATE UNIQUE INDEX "booking_slots_no_double_book"
ON "booking_slots" ("court_id", "slot_date", "slot_start_time")
WHERE "status" IN ('pending_payment', 'confirmed', 'walk_in', 'admin_block');

CREATE INDEX "users_onboarding_incomplete_idx"
ON "users" ("created_at")
WHERE "name" IS NULL AND "deleted_at" IS NULL;

CREATE INDEX "staff_credentials_pending_activation_idx"
ON "staff_credentials" ("created_at")
WHERE "status" = 'pending_activation' AND "deleted_at" IS NULL;

CREATE INDEX "payments_initiated_idx"
ON "payments" ("created_at")
WHERE "status" = 'initiated';

CREATE INDEX "active_refresh_tokens_session_idx"
ON "refresh_tokens" ("session_id", "expires_at")
WHERE "revoked_at" IS NULL;
