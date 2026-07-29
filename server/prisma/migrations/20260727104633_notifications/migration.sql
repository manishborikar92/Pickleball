-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('reminder_t24', 'reminder_t2h', 'review_request');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('scheduled', 'sending', 'sent', 'failed', 'cancelled', 'skipped');

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "venue_id" UUID NOT NULL,
    "reminders_enabled" BOOLEAN NOT NULL DEFAULT false,
    "review_requests_enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "scheduled_for" TIMESTAMPTZ(6) NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'scheduled',
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "provider" VARCHAR(20),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_venue_id_key" ON "notification_settings"("venue_id");

-- CreateIndex
CREATE INDEX "notifications_status_scheduled_for_idx" ON "notifications"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "notifications_venue_id_created_at_idx" ON "notifications"("venue_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_booking_id_idx" ON "notifications"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_booking_id_type_key" ON "notifications"("booking_id", "type");

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
