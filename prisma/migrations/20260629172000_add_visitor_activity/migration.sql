CREATE TABLE IF NOT EXISTS "VisitorActivity" (
  "id" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "path" TEXT,
  "target" TEXT,
  "ipAddress" TEXT,
  "country" TEXT,
  "region" TEXT,
  "city" TEXT,
  "timezone" TEXT,
  "browser" TEXT,
  "os" TEXT,
  "deviceType" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VisitorActivity_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'VisitorActivity_userId_fkey'
  ) THEN
    ALTER TABLE "VisitorActivity"
      ADD CONSTRAINT "VisitorActivity_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "VisitorActivity_visitorId_idx"
  ON "VisitorActivity"("visitorId");

CREATE INDEX IF NOT EXISTS "VisitorActivity_userId_idx"
  ON "VisitorActivity"("userId");

CREATE INDEX IF NOT EXISTS "VisitorActivity_createdAt_idx"
  ON "VisitorActivity"("createdAt");

CREATE INDEX IF NOT EXISTS "VisitorActivity_visitorId_createdAt_idx"
  ON "VisitorActivity"("visitorId", "createdAt");
