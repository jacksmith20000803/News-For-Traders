-- Add lightweight read receipt support for direct messages.
ALTER TABLE "DirectConversationParticipant" ADD COLUMN "lastReadAt" TIMESTAMP(3);

CREATE INDEX "DirectConversationParticipant_conversationId_lastReadAt_idx" ON "DirectConversationParticipant"("conversationId", "lastReadAt");
