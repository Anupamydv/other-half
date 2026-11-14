CREATE TYPE "NotificationType" AS ENUM ('TOUR_REQUESTED', 'TOUR_CONFIRMED', 'TOUR_DECLINED', 'TOUR_CANCELLED');

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tourRequestId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" VARCHAR(300) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_readAt_createdAt_idx"
ON "Notification"("userId", "readAt", "createdAt");
CREATE INDEX "Notification_tourRequestId_idx"
ON "Notification"("tourRequestId");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tourRequestId_fkey"
FOREIGN KEY ("tourRequestId") REFERENCES "TourRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
