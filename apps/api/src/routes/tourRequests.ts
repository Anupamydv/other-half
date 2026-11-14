import {Router} from 'express';
import {
  createTourRequestSchema,
  tourDecisionSchema,
  tourRequestQuerySchema,
} from '@other-half/contracts';
import {Prisma, type City, type TourTimeSlot} from '../generated/prisma/client.js';
import {HttpError, asyncRoute} from '../lib/http.js';
import {requireSession} from './auth.js';
import {prisma} from '../lib/prisma.js';

const cityFromDb: Record<City, 'bengaluru' | 'mumbai' | 'delhi' | 'hyderabad'> = {
  BENGALURU: 'bengaluru', MUMBAI: 'mumbai', DELHI_NCR: 'delhi', HYDERABAD: 'hyderabad',
};
const tourInclude = {
  listing: {include: {owner: {select: {profile: {select: {displayName: true}}}}}},
  requester: {select: {profile: {select: {displayName: true}}}},
} satisfies Prisma.TourRequestInclude;

export const tourRequestsRouter = Router();

tourRequestsRouter.post('/listings/:id/tour-requests', requireSession, asyncRoute(async (request, response) => {
  const parsed = createTourRequestSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid visit request.');
  const requesterId = response.locals.sessionUserId as string;
  const listingId = request.params.id as string;
  const requestedDate = new Date(`${parsed.data.scheduledDate}T00:00:00.000Z`);
  const result = await prisma.$transaction(async (transaction) => {
    // Serialize request creation with owner confirmations and listing archival.
    await transaction.$queryRaw`SELECT "id" FROM "Listing" WHERE "id" = ${listingId} FOR UPDATE`;
    const listing = await transaction.listing.findFirst({
      where: {id: listingId, status: 'ACTIVE'},
      select: {id: true, ownerId: true, availableFrom: true},
    });
    if (!listing) throw new HttpError(404, 'LISTING_NOT_FOUND', 'This listing is not available.');
    if (listing.ownerId === requesterId) throw new HttpError(400, 'OWN_LISTING', 'You cannot request a visit for your own listing.');
    if (requestedDate < listing.availableFrom) {
      throw new HttpError(400, 'BEFORE_AVAILABILITY', 'Choose a visit date on or after the listing availability date.');
    }
    const confirmed = await transaction.tourRequest.findFirst({
      where: {listingId, scheduledDate: requestedDate, timeSlot: parsed.data.timeSlot, status: 'CONFIRMED'},
      select: {id: true},
    });
    if (confirmed) throw new HttpError(409, 'TIME_SLOT_TAKEN', 'That visit window has already been accepted. Choose another date or time.');
    const existing = await transaction.tourRequest.findFirst({
      where: {listingId, requesterId, scheduledDate: requestedDate, timeSlot: parsed.data.timeSlot, status: 'PENDING'},
      select: {id: true},
    });
    if (existing) throw new HttpError(409, 'REQUEST_ALREADY_PENDING', 'You already have a pending request for that visit window.');
    return transaction.tourRequest.create({
      data: {
        listingId,
        requesterId,
        scheduledDate: requestedDate,
        timeSlot: parsed.data.timeSlot as TourTimeSlot,
        note: parsed.data.note,
      },
      include: tourInclude,
    });
  });
  response.status(201).json({item: serializeTourRequest(result)});
}));

tourRequestsRouter.get('/tour-requests', requireSession, asyncRoute(async (request, response) => {
  const parsed = tourRequestQuerySchema.safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid visit requests query.');
  const userId = response.locals.sessionUserId as string;
  const {direction, limit, cursor} = parsed.data;
  const where = direction === 'incoming'
    ? {listing: {ownerId: userId}}
    : {requesterId: userId};
  if (cursor) {
    const ownedCursor = await prisma.tourRequest.findFirst({where: {id: cursor, ...where}, select: {id: true}});
    if (!ownedCursor) throw new HttpError(400, 'INVALID_CURSOR', 'The visit request page cursor is no longer valid. Reload the list.');
  }
  const rows = await prisma.tourRequest.findMany({
    where,
    include: tourInclude,
    orderBy: [{scheduledDate: 'asc'}, {timeSlot: 'asc'}, {createdAt: 'desc'}, {id: 'desc'}],
    ...(cursor ? {cursor: {id: cursor}, skip: 1} : {}),
    take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  response.json({items: items.map(serializeTourRequest), nextCursor: hasMore ? items.at(-1)?.id ?? null : null});
}));

tourRequestsRouter.patch('/tour-requests/:id', requireSession, asyncRoute(async (request, response) => {
  const parsed = tourDecisionSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Choose whether to confirm or decline the visit request.');
  const ownerId = response.locals.sessionUserId as string;
  const id = request.params.id as string;
  const requestRecord = await prisma.tourRequest.findUnique({
    where: {id},
    include: {listing: {select: {id: true, ownerId: true}}},
  });
  if (!requestRecord || requestRecord.listing.ownerId !== ownerId) {
    throw new HttpError(404, 'REQUEST_NOT_FOUND', 'Visit request not found.');
  }
  if (requestRecord.status !== 'PENDING') throw new HttpError(409, 'REQUEST_ALREADY_RESOLVED', 'This visit request has already been resolved.');

  const updated = await prisma.$transaction(async (transaction) => {
    // Serialize owner decisions for this listing so two requests for one window cannot both be confirmed.
    await transaction.$queryRaw`SELECT "id" FROM "Listing" WHERE "id" = ${requestRecord.listingId} FOR UPDATE`;
    const current = await transaction.tourRequest.findUnique({where: {id}, select: {status: true}});
    if (!current || current.status !== 'PENDING') {
      throw new HttpError(409, 'REQUEST_ALREADY_RESOLVED', 'This visit request has already been resolved.');
    }
    const nextStatus = parsed.data.decision === 'CONFIRM' ? 'CONFIRMED' : 'DECLINED';
    if (nextStatus === 'CONFIRMED') {
      const taken = await transaction.tourRequest.findFirst({
        where: {
          listingId: requestRecord.listingId,
          scheduledDate: requestRecord.scheduledDate,
          timeSlot: requestRecord.timeSlot,
          status: 'CONFIRMED',
        },
        select: {id: true},
      });
      if (taken) throw new HttpError(409, 'TIME_SLOT_TAKEN', 'Another visit request already holds this time window.');
    }
    await transaction.tourRequest.update({where: {id}, data: {status: nextStatus}});
    if (nextStatus === 'CONFIRMED') {
      await transaction.tourRequest.updateMany({
        where: {
          listingId: requestRecord.listingId,
          scheduledDate: requestRecord.scheduledDate,
          timeSlot: requestRecord.timeSlot,
          status: 'PENDING',
          id: {not: id},
        },
        data: {status: 'DECLINED'},
      });
    }
    return transaction.tourRequest.findUniqueOrThrow({where: {id}, include: tourInclude});
  });
  response.json({item: serializeTourRequest(updated)});
}));

tourRequestsRouter.post('/tour-requests/:id/cancel', requireSession, asyncRoute(async (request, response) => {
  const userId = response.locals.sessionUserId as string;
  const id = request.params.id as string;
  const ownRequest = await prisma.tourRequest.findFirst({
    where: {id, OR: [{requesterId: userId}, {listing: {ownerId: userId}}]},
    select: {status: true},
  });
  if (!ownRequest) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'Visit request not found.');
  if (ownRequest.status !== 'PENDING' && ownRequest.status !== 'CONFIRMED') {
    throw new HttpError(409, 'REQUEST_ALREADY_RESOLVED', 'This visit request is already closed.');
  }
  const result = await prisma.tourRequest.updateMany({
    where: {id, status: ownRequest.status},
    data: {status: 'CANCELLED'},
  });
  if (result.count !== 1) {
    throw new HttpError(409, 'REQUEST_ALREADY_RESOLVED', 'This visit request has changed. Refresh and try again.');
  }
  response.status(204).end();
}));

function serializeTourRequest(request: Prisma.TourRequestGetPayload<{include: typeof tourInclude}>) {
  return {
    id: request.id,
    listingId: request.listingId,
    listingTitle: request.listing.title,
    cityId: cityFromDb[request.listing.city],
    neighborhood: request.listing.neighborhood,
    requesterId: request.requesterId,
    requesterDisplayName: request.requester.profile?.displayName ?? 'Other Half member',
    ownerId: request.listing.ownerId,
    ownerDisplayName: request.listing.owner.profile?.displayName ?? 'Other Half member',
    scheduledDate: request.scheduledDate.toISOString().slice(0, 10),
    timeSlot: request.timeSlot,
    note: request.note,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}
