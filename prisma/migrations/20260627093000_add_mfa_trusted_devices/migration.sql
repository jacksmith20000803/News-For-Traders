-- Add durable MFA metadata for recovery codes, step-up age, and trusted devices.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "twoFactorRecoveryCodes" TEXT,
ADD COLUMN IF NOT EXISTS "twoFactorLastVerifiedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "TrustedDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "deviceName" VARCHAR(255),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TrustedDevice_tokenHash_key" ON "TrustedDevice"("tokenHash");
CREATE INDEX IF NOT EXISTS "TrustedDevice_userId_idx" ON "TrustedDevice"("userId");
CREATE INDEX IF NOT EXISTS "TrustedDevice_expiresAt_idx" ON "TrustedDevice"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TrustedDevice_userId_fkey'
  ) THEN
    ALTER TABLE "TrustedDevice"
    ADD CONSTRAINT "TrustedDevice_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
