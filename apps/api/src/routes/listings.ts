import {Router} from 'express';
import {
  listingCreateSchema,
  listingQuerySchema,
  savedListingQuerySchema,
  listingUpdateSchema,
  myListingQuerySchema,
  type ListingInput,
} from '@other-half/contracts';
import {Prisma, type City, type ListingAmenity, type ListingStatus, type ListingType} from '../generated/prisma/client.js';
import {HttpError, asyncRoute} from '../lib/http.js';
import {optionalSession, requireSession} from './auth.js';
import {prisma} from '../lib/prisma.js';
import {createSignedViewUrl} from '../lib/mediaStorage.js';

const cityToDb: Record<string, City> = {
  bengaluru: 'BENGALURU', mumbai: 'MUMBAI', delhi: 'DELHI_NCR', hyderabad: 'HYDERABAD',
};
const cityFromDb: Record<City, 'bengaluru' | 'mumbai' | 'delhi' | 'hyderabad'> = {
  BENGALURU: 'bengaluru', MUMBAI: 'mumbai', DELHI_NCR: 'delhi', HYDERABAD: 'hyderabad',
};
const listingInclude = {
  owner: {select: {profile: {select: {displayName: true}}}},
  media: {where: {status: 'READY'}, orderBy: [{sortOrder: 'asc'}, {createdAt: 'asc'}]},
} satisfies Prisma.ListingInclude;

export const listingsRouter = Router();

listingsRouter.get('/listings', optionalSession, asyncRoute(async (request, response) => {
  const parsed = listingQuerySchema.safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid listing filters.');
  const {cityId, neighborhood, maxRent, listingType, availableBy, amenities, limit, cursor} = parsed.data;
  await assertCursor(cursor);
  const rows = await prisma.listing.findMany({
    where: {
      status: 'ACTIVE',
      ...(cityId ? {city: cityToDb[cityId]} : {}),
      ...(neighborhood ? {neighborhood: {equals: neighborhood, mode: 'insensitive'}} : {}),
      ...(maxRent ? {monthlyRent: {lte: maxRent}} : {}),
      ...(listingType ? {listingType} : {}),
      ...(availableBy ? {availableFrom: {lte: new Date(`${availableBy}T00:00:00.000Z`)}} : {}),
      ...(amenities?.length ? {amenities: {hasEvery: amenities as ListingAmenity[]}} : {}),
    },
    include: listingInclude,
    orderBy: [{createdAt: 'desc'}, {id: 'desc'}],
    ...(cursor ? {cursor: {id: cursor}, skip: 1} : {}),
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const userId = response.locals.sessionUserId as string | undefined;
  const savedRows = userId && items.length
    ? await prisma.savedListing.findMany({where: {userId, listingId: {in: items.map((item) => item.id)}}, select: {listingId: true}})
    : [];
  const savedIds = new Set(savedRows.map((item) => item.listingId));
  response.json({
    items: await Promise.all(items.map((item) => serializeListing(item, savedIds.has(item.id)))),
    nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
  });
}));

listingsRouter.get('/listings/mine', requireSession, asyncRoute(async (_request, response) => {
  const parsed = myListingQuerySchema.safeParse(_request.query);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid listing filters.');
  const {status, limit, cursor} = parsed.data;
  const ownerId = response.locals.sessionUserId as string;
  await assertCursor(cursor, ownerId);
  const rows = await prisma.listing.findMany({
    where: {
      ownerId,
      ...(status ? {status: status as ListingStatus} : {}),
    },
    include: listingInclude,
    orderBy: [{createdAt: 'desc'}, {id: 'desc'}],
    ...(cursor ? {cursor: {id: cursor}, skip: 1} : {}),
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  response.json({items: await Promise.all(items.map((item) => serializeListing(item, false))), nextCursor: hasMore ? items.at(-1)?.id ?? null : null});
}));

listingsRouter.get('/listings/saved', requireSession, asyncRoute(async (request, response) => {
  const parsed = savedListingQuerySchema.safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid saved listings request.');
  const userId = response.locals.sessionUserId as string;
  const {limit, cursor} = parsed.data;
  if (cursor) {
    const exists = await prisma.savedListing.findUnique({
      where: {userId_listingId: {userId, listingId: cursor}}, select: {listingId: true},
    });
    if (!exists) throw new HttpError(400, 'INVALID_CURSOR', 'The saved listing page cursor is no longer valid. Reload the list.');
  }
  const rows = await prisma.savedListing.findMany({
    where: {userId},
    include: {listing: {include: listingInclude}},
    orderBy: [{createdAt: 'desc'}, {listingId: 'desc'}],
    ...(cursor ? {cursor: {userId_listingId: {userId, listingId: cursor}}, skip: 1} : {}),
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  response.json({items: await Promise.all(items.map((row) => serializeListing(row.listing, true))), nextCursor: hasMore ? items.at(-1)?.listingId ?? null : null});
}));

listingsRouter.put('/listings/:id/save', requireSession, asyncRoute(async (request, response) => {
  const userId = response.locals.sessionUserId as string;
  const listing = await prisma.listing.findFirst({
    where: {id: request.params.id as string, status: 'ACTIVE'},
    select: {id: true, ownerId: true},
  });
  if (!listing) throw new HttpError(404, 'LISTING_NOT_FOUND', 'This listing is not available.');
  if (listing.ownerId === userId) throw new HttpError(400, 'CANNOT_SAVE_OWN_LISTING', 'You cannot save your own listing.');
  await prisma.savedListing.upsert({
    where: {userId_listingId: {userId, listingId: listing.id}},
    create: {userId, listingId: listing.id},
    update: {},
  });
  response.status(204).end();
}));

listingsRouter.delete('/listings/:id/save', requireSession, asyncRoute(async (request, response) => {
  const userId = response.locals.sessionUserId as string;
  await prisma.savedListing.deleteMany({where: {userId, listingId: request.params.id as string}});
  response.status(204).end();
}));

listingsRouter.get('/listings/:id', optionalSession, asyncRoute(async (request, response) => {
  const listing = await prisma.listing.findFirst({
    where: {id: request.params.id as string, status: 'ACTIVE'},
    include: listingInclude,
  });
  if (!listing) throw new HttpError(404, 'LISTING_NOT_FOUND', 'This listing is not available.');
  const userId = response.locals.sessionUserId as string | undefined;
  const saved = userId ? await prisma.savedListing.findUnique({
    where: {userId_listingId: {userId, listingId: listing.id}}, select: {listingId: true},
  }) : null;
  response.json({item: await serializeListing(listing, Boolean(saved))});
}));

listingsRouter.post('/listings', requireSession, asyncRoute(async (request, response) => {
  const parsed = listingCreateSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid listing details.');
  const listing = await prisma.listing.create({
    data: toCreateData(parsed.data, response.locals.sessionUserId as string),
    include: listingInclude,
  });
  response.status(201).json({item: await serializeListing(listing, false)});
}));

listingsRouter.patch('/listings/:id', requireSession, asyncRoute(async (request, response) => {
  const parsed = listingUpdateSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid listing details.');
  const ownerId = response.locals.sessionUserId as string;
  const id = request.params.id as string;
  const existing = await prisma.listing.findFirst({where: {id, ownerId}});
  if (!existing) throw new HttpError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
  if (existing.status !== 'ACTIVE') throw new HttpError(409, 'LISTING_ARCHIVED', 'Archived listings cannot be edited.');

  const result = await prisma.listing.updateMany({
    where: {id, ownerId, status: 'ACTIVE'},
    data: toUpdateData(parsed.data),
  });
  if (result.count !== 1) throw new HttpError(409, 'LISTING_CHANGED', 'This listing changed. Refresh and try again.');
  const listing = await prisma.listing.findUniqueOrThrow({where: {id}, include: listingInclude});
  response.json({item: await serializeListing(listing, false)});
}));

listingsRouter.post('/listings/:id/archive', requireSession, asyncRoute(async (request, response) => {
  const ownerId = response.locals.sessionUserId as string;
  const id = request.params.id as string;
  const result = await prisma.$transaction(async (transaction) => {
    const archived = await transaction.listing.updateMany({
      where: {id, ownerId, status: 'ACTIVE'},
      data: {status: 'ARCHIVED', archivedAt: new Date()},
    });
    if (archived.count === 1) {
      const pendingRequests = await transaction.tourRequest.findMany({
        where: {listingId: id, status: 'PENDING'}, select: {id: true, requesterId: true},
      });
      await transaction.tourRequest.updateMany({
        where: {listingId: id, status: 'PENDING'},
        data: {status: 'CANCELLED'},
      });
      if (pendingRequests.length > 0) {
        await transaction.notification.createMany({data: pendingRequests.map((tourRequest) => ({
          userId: tourRequest.requesterId,
          tourRequestId: tourRequest.id,
          type: 'TOUR_CANCELLED' as const,
          title: 'Visit request cancelled',
          body: 'The home listing was archived, so the requested visit was cancelled.',
        }))});
      }
    }
    return archived;
  });
  if (result.count !== 1) {
    const owned = await prisma.listing.findFirst({where: {id, ownerId}, select: {id: true}});
    if (!owned) throw new HttpError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    throw new HttpError(409, 'LISTING_ALREADY_ARCHIVED', 'This listing is already archived.');
  }
  response.status(204).end();
}));

function toCreateData(input: ListingInput, ownerId: string) {
  return {
    ownerId,
    title: input.title,
    description: input.description,
    city: cityToDb[input.cityId],
    neighborhood: input.neighborhood,
    listingType: input.listingType as ListingType,
    monthlyRent: input.monthlyRent,
    deposit: input.deposit,
    availableFrom: new Date(`${input.availableFrom}T00:00:00.000Z`),
    minimumStay: input.minimumStay,
    amenities: input.amenities as ListingAmenity[],
  };
}

function toUpdateData(input: Partial<ListingInput>) {
  return {
    ...(input.title !== undefined ? {title: input.title} : {}),
    ...(input.description !== undefined ? {description: input.description} : {}),
    ...(input.cityId !== undefined ? {city: cityToDb[input.cityId]} : {}),
    ...(input.neighborhood !== undefined ? {neighborhood: input.neighborhood} : {}),
    ...(input.listingType !== undefined ? {listingType: input.listingType as ListingType} : {}),
    ...(input.monthlyRent !== undefined ? {monthlyRent: input.monthlyRent} : {}),
    ...(input.deposit !== undefined ? {deposit: input.deposit} : {}),
    ...(input.availableFrom !== undefined ? {availableFrom: new Date(`${input.availableFrom}T00:00:00.000Z`)} : {}),
    ...(input.minimumStay !== undefined ? {minimumStay: input.minimumStay} : {}),
    ...(input.amenities !== undefined ? {amenities: input.amenities as ListingAmenity[]} : {}),
  };
}

async function serializeListing(listing: Prisma.ListingGetPayload<{include: typeof listingInclude}>, savedByMe: boolean) {
  return {
    id: listing.id,
    ownerId: listing.ownerId,
    title: listing.title,
    description: listing.description,
    cityId: cityFromDb[listing.city],
    neighborhood: listing.neighborhood,
    listingType: listing.listingType,
    monthlyRent: listing.monthlyRent,
    deposit: listing.deposit,
    availableFrom: listing.availableFrom.toISOString().slice(0, 10),
    minimumStay: listing.minimumStay,
    amenities: listing.amenities,
    status: listing.status,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
    ownerDisplayName: listing.owner.profile?.displayName ?? 'Other Half member',
    savedByMe,
    media: await Promise.all(listing.media.map(async (item) => ({
      id: item.id, url: await createSignedViewUrl(item.objectKey), contentType: item.contentType,
      byteSize: item.byteSize, altText: item.altText,
    }))),
  };
}

async function assertCursor(cursor: string | undefined, ownerId?: string) {
  if (!cursor) return;
  const exists = await prisma.listing.findFirst({
    where: {id: cursor, ...(ownerId ? {ownerId} : {})},
    select: {id: true},
  });
  if (!exists) throw new HttpError(400, 'INVALID_CURSOR', 'The listing page cursor is no longer valid. Reload the list.');
}
