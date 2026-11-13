-- Phase 3: hosted checkout details on payments
ALTER TABLE "payments" ADD COLUMN "checkout_url" TEXT;
ALTER TABLE "payments" ADD COLUMN "expires_at" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "meta" JSONB;
