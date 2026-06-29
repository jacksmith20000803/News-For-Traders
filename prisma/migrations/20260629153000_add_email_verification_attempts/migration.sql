ALTER TABLE "EmailVerificationToken" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");
