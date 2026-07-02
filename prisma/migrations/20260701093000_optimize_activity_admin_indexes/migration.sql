CREATE INDEX IF NOT EXISTS "VisitorActivity_userId_createdAt_idx"
  ON "VisitorActivity"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "VisitorActivity_visitorId_action_idx"
  ON "VisitorActivity"("visitorId", "action");

CREATE INDEX IF NOT EXISTS "VisitorActivity_userId_action_idx"
  ON "VisitorActivity"("userId", "action");
