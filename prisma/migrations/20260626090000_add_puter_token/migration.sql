CREATE TABLE IF NOT EXISTS "PuterToken" (
  "id" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "selectedModels" JSONB NOT NULL DEFAULT '[]',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isExhausted" BOOLEAN NOT NULL DEFAULT false,
  "requestLimit" INTEGER NOT NULL DEFAULT 1000,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "lastUsedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PuterToken_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "PuterToken"
  ADD CONSTRAINT "PuterToken_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "PuterToken_isActive_isExhausted_idx" ON "PuterToken"("isActive", "isExhausted");
CREATE INDEX IF NOT EXISTS "PuterToken_lastUsedAt_idx" ON "PuterToken"("lastUsedAt");
CREATE INDEX IF NOT EXISTS "PuterToken_createdAt_idx" ON "PuterToken"("createdAt");
