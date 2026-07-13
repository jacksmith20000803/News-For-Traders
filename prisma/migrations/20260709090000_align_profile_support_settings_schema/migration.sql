-- CreateEnum
CREATE TYPE "PreferredMarket" AS ENUM ('CRYPTO', 'FOREX', 'STOCKS', 'COMMODITIES');

-- CreateEnum
CREATE TYPE "AdminPresenceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'DND');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('CONTACT', 'FEEDBACK', 'BUG', 'SUGGESTION');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'REPLIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportMessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'USER_PROFILE_UPDATE';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ADMIN_MESSAGE';
ALTER TYPE "NotificationType" ADD VALUE 'PROFILE_CHANGE';
ALTER TYPE "NotificationType" ADD VALUE 'NEW_REGISTRATION';
ALTER TYPE "NotificationType" ADD VALUE 'SUPPORT_MESSAGE';

-- DropIndex
DROP INDEX "EmailVerificationToken_userId_idx";

-- AlterTable
ALTER TABLE "News" ADD COLUMN "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "PriceHistory" ADD COLUMN "close" DOUBLE PRECISION,
ADD COLUMN "high" DOUBLE PRECISION,
ADD COLUMN "low" DOUBLE PRECISION,
ADD COLUMN "open" DOUBLE PRECISION,
ADD COLUMN "volume" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PuterToken" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TrustedDevice" ALTER COLUMN "tokenHash" SET DATA TYPE TEXT,
ALTER COLUMN "deviceName" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "country" TEXT,
ADD COLUMN "dateOfBirth" TIMESTAMP(3),
ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "preferredLanguage" TEXT DEFAULT 'en',
ADD COLUMN "timezone" TEXT DEFAULT 'UTC',
ADD COLUMN "username" TEXT;

-- CreateTable
CREATE TABLE "UserPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredMarket" "PreferredMarket" NOT NULL DEFAULT 'STOCKS',
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "chartInterval" TEXT NOT NULL DEFAULT '1H',
    "defaultSymbol" TEXT DEFAULT 'BTC/USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "priceAlerts" BOOLEAN NOT NULL DEFAULT true,
    "newsAlerts" BOOLEAN NOT NULL DEFAULT true,
    "adminMessages" BOOLEAN NOT NULL DEFAULT true,
    "profileChanges" BOOLEAN NOT NULL DEFAULT true,
    "systemAnnounce" BOOLEAN NOT NULL DEFAULT true,
    "marketingEmails" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "category" "AssetCategory" NOT NULL DEFAULT 'STOCKS',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "FeedbackType" NOT NULL DEFAULT 'CONTACT',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "adminReply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT 'Support',
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "status" "SupportMessageStatus" NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminPresence" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "status" "AdminPresenceStatus" NOT NULL DEFAULT 'OFFLINE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminPresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSettings" (
    "id" TEXT NOT NULL,
    "welcomeMessage" TEXT NOT NULL DEFAULT 'Welcome to TRADX support! How can we help you today?',
    "offlineMessage" TEXT NOT NULL DEFAULT 'Our team is currently offline. Leave a message and we''ll respond soon.',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPreferences_userId_key" ON "UserPreferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationSettings_userId_key" ON "NotificationSettings"("userId");

-- CreateIndex
CREATE INDEX "FavoriteAsset_userId_sortOrder_idx" ON "FavoriteAsset"("userId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteAsset_userId_symbol_assetType_key" ON "FavoriteAsset"("userId", "symbol", "assetType");

-- CreateIndex
CREATE INDEX "FeedbackSubmission_status_idx" ON "FeedbackSubmission"("status");

-- CreateIndex
CREATE INDEX "FeedbackSubmission_type_idx" ON "FeedbackSubmission"("type");

-- CreateIndex
CREATE INDEX "FeedbackSubmission_createdAt_idx" ON "FeedbackSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "SupportConversation_userId_idx" ON "SupportConversation"("userId");

-- CreateIndex
CREATE INDEX "SupportConversation_isOpen_idx" ON "SupportConversation"("isOpen");

-- CreateIndex
CREATE INDEX "SupportMessage_conversationId_idx" ON "SupportMessage"("conversationId");

-- CreateIndex
CREATE INDEX "SupportMessage_createdAt_idx" ON "SupportMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminPresence_adminId_key" ON "AdminPresence"("adminId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PriceHistory_symbol_timestamp_idx" ON "PriceHistory"("symbol", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteAsset" ADD CONSTRAINT "FavoriteAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportConversation" ADD CONSTRAINT "SupportConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminPresence" ADD CONSTRAINT "AdminPresence_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
