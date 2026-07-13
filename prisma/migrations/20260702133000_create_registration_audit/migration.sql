CREATE TABLE "RegistrationAudit" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "ipAddress" TEXT,
  "country" TEXT,
  "city" TEXT,
  "browser" TEXT,
  "deviceType" TEXT,
  "os" TEXT,
  "userAgent" TEXT,
  "adminViewed" BOOLEAN NOT NULL DEFAULT false,
  "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RegistrationAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RegistrationAudit_userId_key" ON "RegistrationAudit"("userId");
CREATE INDEX "RegistrationAudit_registeredAt_idx" ON "RegistrationAudit"("registeredAt");
CREATE INDEX "RegistrationAudit_adminViewed_idx" ON "RegistrationAudit"("adminViewed");
CREATE INDEX "RegistrationAudit_country_idx" ON "RegistrationAudit"("country");

ALTER TABLE "RegistrationAudit"
  ADD CONSTRAINT "RegistrationAudit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
