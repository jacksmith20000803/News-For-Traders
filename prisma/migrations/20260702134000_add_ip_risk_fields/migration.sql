ALTER TABLE "VisitorActivity"
  ADD COLUMN "vpnDetected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "vpnProvider" TEXT,
  ADD COLUMN "ipAsn" TEXT,
  ADD COLUMN "ipCompany" TEXT,
  ADD COLUMN "ipRiskSource" TEXT,
  ADD COLUMN "ipRiskCheckedAt" TIMESTAMP(3),
  ADD COLUMN "ipRisk" JSONB;

ALTER TABLE "RegistrationAudit"
  ADD COLUMN "vpnDetected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "vpnProvider" TEXT,
  ADD COLUMN "ipAsn" TEXT,
  ADD COLUMN "ipCompany" TEXT,
  ADD COLUMN "ipRiskSource" TEXT,
  ADD COLUMN "ipRiskCheckedAt" TIMESTAMP(3),
  ADD COLUMN "ipRisk" JSONB;

CREATE INDEX "VisitorActivity_vpnDetected_idx" ON "VisitorActivity"("vpnDetected");
CREATE INDEX "RegistrationAudit_vpnDetected_idx" ON "RegistrationAudit"("vpnDetected");
