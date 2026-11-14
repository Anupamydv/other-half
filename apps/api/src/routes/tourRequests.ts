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
      select: {id: true, ownerId: true, title: true, availableFrom: true},
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
    const created = await transaction.tourRequest.create({
      data: {
        listingId,
        requesterId,
        scheduledDate: requestedDate,
        timeSlot: parsed.data.timeSlot as TourTimeSlot,
        note: parsed.data.note,
      },
      include: tourInclude,
    });
    const requester = await transaction.profile.findUnique({where: {userId: requesterId}, select: {displayName: true}});
    await transaction.notification.create({data: {
      userId: listing.ownerId,
      tourRequestId: created.id,
      type: 'TOUR_REQUESTED',
      title: 'New home visit request',
      body: `${requester?.displayName ?? 'A member'} requested a visit for ${listing.title}.`,
    }});
    return created;
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
    include: {listing: {select: {id: true, ownerId: true, title: true}}},
  });
  if (!requestRecord || requestRecord.listing.ownerId !== ownerId) {
    throw new HttpError(404, 'REQUEST_NOT_FOUND', 'Visit request not found.');
  }
  if (requestRecord.status !== 'PENDING') throw new HttpError(409, 'REQUEST_ALREADY_RESOLVED', 'This visit request has already been resolved.');

  const updated = await prisma.$transaction(async (transaction) => {
    // Serialize owner decisions for this listing so two requests for one window cannot both be confirmed.
    await transaction.$queryRaw`SELECT "id" FROM "Listing" WHERE "id" = ${requestRecord.listingId} FOR UPDATE`;
    const current = await transaction.tourRequest.findUnique({where: {id}, select: {status: true, requesterId: true}});
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
    const affectedPending = nextStatus === 'CONFIRMED' ? await transaction.tourRequest.findMany({
      where: {
        listingId: requestRecord.listingId,
        scheduledDate: requestRecord.scheduledDate,
        timeSlot: requestRecord.timeSlot,
        status: 'PENDING',
        id: {not: id},
      },
      select: {id: true, requesterId: true},
    }) : [];
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
    await transaction.notification.create({data: {
      userId: current.requesterId,
      tourRequestId: id,
      type: nextStatus === 'CONFIRMED' ? 'TOUR_CONFIRMED' : 'TOUR_DECLINED',
      title: nextStatus === 'CONFIRMED' ? 'Visit request confirmed' : 'Visit request declined',
      body: nextStatus === 'CONFIRMED'
        ? `Your visit for ${requestRecord.listing.title} was confirmed.`
        : `Your visit request for ${requestRecord.listing.title} was declined.`,
    }});
    if (affectedPending.length > 0) {
      await transaction.notification.createMany({data: affectedPending.map((affected) => ({
        userId: affected.requesterId,
        tourRequestId: affected.id,
        type: 'TOUR_DECLINED' as const,
        title: 'Visit window no longer available',
        body: `Another visit for ${requestRecord.listing.title} was confirmed for this time window.`,
      }))});
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
    select: {status: true, requesterId: true, listingId: true, listing: {select: {ownerId: true, title: true}}},
  });
  if (!ownRequest) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'Visit request not found.');
  if (ownRequest.status !== 'PENDING' && ownRequest.status !== 'CONFIRMED') {
    throw new HttpError(409, 'REQUEST_ALREADY_RESOLVED', 'This visit request is already closed.');
  }
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "Listing" WHERE "id" = ${ownRequest.listingId} FOR UPDATE`;
    const current = await transaction.tourRequest.findFirst({
      where: {id, OR: [{requesterId: userId}, {listing: {ownerId: userId}}]},
      select: {status: true, requesterId: true, listingId: true, listing: {select: {ownerId: true, title: true}}},
    });
    if (!current) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'Visit request not found.');
    if (current.status !== 'PENDING' && current.status !== 'CONFIRMED') {
      throw new HttpError(409, 'REQUEST_ALREADY_RESOLVED', 'This visit request is already closed.');
    }
    await transaction.tourRequest.update({where: {id}, data: {status: 'CANCELLED'}});
    const cancelledByGuest = current.requesterId === userId;
    await transaction.notification.create({data: {
      userId: cancelledByGuest ? current.listing.ownerId : current.requesterId,
      tourRequestId: id,
      type: 'TOUR_CANCELLED',
      title: 'Visit cancelled',
      body: `The ${cancelledByGuest ? 'guest' : 'host'} cancelled the visit for ${current.listing.title}.`,
    }});
  });
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
