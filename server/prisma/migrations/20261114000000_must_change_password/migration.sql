-- Phase 4: staff accounts start with a temporary password
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;

-- Reception lookups by member name
CREATE INDEX "users_full_name_lower_idx" ON "users" (lower("full_name"));
