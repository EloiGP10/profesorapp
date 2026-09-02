-- Migration: add_user_reset_token
-- Applied to: postgres DB, schema profesorapp

BEGIN;

ALTER TABLE "profesorapp"."User"
  ADD COLUMN "resetToken" TEXT,
  ADD COLUMN "resetTokenExpiry" TIMESTAMPTZ;

COMMIT;
