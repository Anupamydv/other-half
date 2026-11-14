CREATE TYPE "TourRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED', 'CANCELLED');
CREATE TYPE "TourTimeSlot" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

CREATE TABLE "TourRequest" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "timeSlot" "TourTimeSlot" NOT NULL,
    "note" VARCHAR(500) NOT NULL DEFAULT '',
    "status" "TourRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TourRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TourRequest_listingId_status_scheduledDate_idx"
ON "TourRequest"("listingId", "status", "scheduledDate");
CREATE INDEX "TourRequest_requesterId_status_createdAt_idx"
ON "TourRequest"("requesterId", "status", "createdAt");

ALTER TABLE "TourRequest" ADD CONSTRAINT "TourRequest_listingId_fkey"
FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TourRequest" ADD CONSTRAINT "TourRequest_requesterId_fkey"
FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
