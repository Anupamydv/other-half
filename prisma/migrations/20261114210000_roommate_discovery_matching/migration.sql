CREATE TYPE "DiscoveryActionType" AS ENUM ('PASS', 'LIKE', 'SUPER_LIKE');

ALTER TABLE "Profile" ADD COLUMN "discoveryEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN "matchId" TEXT;
ALTER TABLE "Conversation" ALTER COLUMN "listingId" DROP NOT NULL;

CREATE TABLE "DiscoveryAction" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" "DiscoveryActionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscoveryAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "lowUserId" TEXT NOT NULL,
    "highUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiscoveryAction_actorId_createdAt_idx" ON "DiscoveryAction"("actorId", "createdAt");
CREATE INDEX "DiscoveryAction_targetId_action_idx" ON "DiscoveryAction"("targetId", "action");
CREATE UNIQUE INDEX "DiscoveryAction_actorId_targetId_key" ON "DiscoveryAction"("actorId", "targetId");
CREATE INDEX "Match_lowUserId_createdAt_idx" ON "Match"("lowUserId", "createdAt");
CREATE INDEX "Match_highUserId_createdAt_idx" ON "Match"("highUserId", "createdAt");
CREATE UNIQUE INDEX "Match_lowUserId_highUserId_key" ON "Match"("lowUserId", "highUserId");
CREATE UNIQUE INDEX "Conversation_matchId_key" ON "Conversation"("matchId");

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryAction" ADD CONSTRAINT "DiscoveryAction_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscoveryAction" ADD CONSTRAINT "DiscoveryAction_targetId_fkey"
FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_lowUserId_fkey"
FOREIGN KEY ("lowUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_highUserId_fkey"
FOREIGN KEY ("highUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
