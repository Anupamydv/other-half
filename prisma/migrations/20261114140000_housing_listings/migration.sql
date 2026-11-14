CREATE TYPE "ListingType" AS ENUM ('PRIVATE_ROOM', 'SHARED_ROOM', 'ENTIRE_FLAT');
CREATE TYPE "ListingAmenity" AS ENUM (
    'FURNISHED', 'WIFI', 'AIR_CONDITIONING', 'LAUNDRY', 'PARKING', 'PET_FRIENDLY', 'VEGETARIAN_HOUSEHOLD'
);
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "city" "City" NOT NULL,
    "neighborhood" VARCHAR(100) NOT NULL,
    "listingType" "ListingType" NOT NULL,
    "monthlyRent" INTEGER NOT NULL,
    "deposit" INTEGER,
    "availableFrom" DATE NOT NULL,
    "minimumStay" INTEGER NOT NULL DEFAULT 6,
    "amenities" "ListingAmenity"[] DEFAULT ARRAY[]::"ListingAmenity"[],
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Listing_status_city_neighborhood_monthlyRent_idx"
ON "Listing"("status", "city", "neighborhood", "monthlyRent");
CREATE INDEX "Listing_status_city_neighborhood_availableFrom_idx"
ON "Listing"("status", "city", "neighborhood", "availableFrom");
CREATE INDEX "Listing_amenities_idx" ON "Listing" USING GIN ("amenities");
CREATE INDEX "Listing_ownerId_status_createdAt_idx"
ON "Listing"("ownerId", "status", "createdAt");
CREATE INDEX "Listing_createdAt_idx" ON "Listing"("createdAt");

ALTER TABLE "Listing" ADD CONSTRAINT "Listing_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
