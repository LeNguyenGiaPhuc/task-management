-- Password reset OTPs are stored hashed, expire quickly, and can only be used once.

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "session_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "password_reset_otps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_password_reset_otps_user_created"
ON "password_reset_otps"("user_id", "created_at" DESC);

CREATE INDEX "idx_password_reset_otps_expiry"
ON "password_reset_otps"("expires_at");

ALTER TABLE "password_reset_otps"
ADD CONSTRAINT "password_reset_otps_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
