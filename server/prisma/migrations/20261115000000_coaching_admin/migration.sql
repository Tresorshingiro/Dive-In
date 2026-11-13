-- Phases 5–6: coaching + admin
ALTER TABLE "users" ADD COLUMN "totp_enabled_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "totp_last_step" INTEGER;

ALTER TABLE "coach_access_passes" ADD COLUMN "payment_id" UUID;
CREATE UNIQUE INDEX "coach_access_passes_payment_id_key" ON "coach_access_passes"("payment_id");

ALTER TABLE "bookings" ADD COLUMN "cancel_reason" TEXT;
ALTER TABLE "bookings" ADD COLUMN "cancelled_by_id" UUID;
ALTER TABLE "bookings" ADD COLUMN "completed_at" TIMESTAMP(3);
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_time_order" CHECK ("ends_at" > "starts_at");

ALTER TABLE "conversations" ADD COLUMN "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "conversations_trainer_id_last_message_at_idx" ON "conversations"("trainer_id", "last_message_at");
