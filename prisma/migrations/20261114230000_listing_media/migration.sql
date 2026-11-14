-- CreateEnum
CREATE TYPE "ListingMediaStatus" AS ENUM ('PENDING', 'READY');

-- CreateTable
CREATE TABLE "ListingMedia" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" VARCHAR(100) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "altText" VARCHAR(200) NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ListingMediaStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListingMedia_objectKey_key" ON "ListingMedia"("objectKey");

-- CreateIndex
CREATE INDEX "ListingMedia_listingId_status_sortOrder_createdAt_idx" ON "ListingMedia"("listingId", "status", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "ListingMedia_uploaderId_createdAt_idx" ON "ListingMedia"("uploaderId", "createdAt");

-- AddForeignKey
ALTER TABLE "ListingMedia" ADD CONSTRAINT "ListingMedia_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingMedia" ADD CONSTRAINT "ListingMedia_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
