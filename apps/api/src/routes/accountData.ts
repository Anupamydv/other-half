import {Router} from 'express';
import {prisma} from '../lib/prisma.js';
import {asyncRoute, HttpError} from '../lib/http.js';
import {requireSession} from './auth.js';
import {createSignedViewUrl, MEDIA_STORAGE_CONFIGURED} from '../lib/mediaStorage.js';

export const accountDataRouter = Router();

accountDataRouter.get('/account/export', requireSession, asyncRoute(async (_request, response) => {
  const userId = response.locals.sessionUserId as string;
  const user = await prisma.user.findUnique({
    where: {id: userId},
    select: {id: true, email: true, createdAt: true, profile: true},
  });
  if (!user) throw new HttpError(404, 'ACCOUNT_NOT_FOUND', 'Account not found.');

  const [listings, savedListings, tourRequests, conversations, actions, matches, blocks, reports, notifications] = await Promise.all([
    prisma.listing.findMany({where: {ownerId: userId}, orderBy: {createdAt: 'asc'}, include: {media: {where: {status: 'READY'}, orderBy: [{sortOrder: 'asc'}, {createdAt: 'asc'}]}}}),
    prisma.savedListing.findMany({where: {userId}, orderBy: {createdAt: 'asc'}, include: {listing: {select: {id: true, title: true, city: true, neighborhood: true, monthlyRent: true, status: true}}}}),
    prisma.tourRequest.findMany({where: {OR: [{requesterId: userId}, {listing: {ownerId: userId}}]}, orderBy: {createdAt: 'asc'}, include: {listing: {select: {id: true, title: true, ownerId: true}}, notifications: {where: {userId}, select: {id: true, type: true, title: true, body: true, createdAt: true, readAt: true}}}}),
    prisma.conversation.findMany({where: {OR: [{ownerId: userId}, {guestId: userId}]}, orderBy: {createdAt: 'asc'}, include: {messages: {orderBy: {createdAt: 'asc'}, select: {id: true, senderId: true, body: true, createdAt: true}}, listing: {select: {id: true, title: true}}}}),
    prisma.discoveryAction.findMany({where: {actorId: userId}, orderBy: {createdAt: 'asc'}, select: {id: true, targetId: true, action: true, createdAt: true}}),
    prisma.match.findMany({where: {OR: [{lowUserId: userId}, {highUserId: userId}]}, orderBy: {createdAt: 'asc'}, select: {id: true, createdAt: true}}),
    prisma.userBlock.findMany({where: {blockerId: userId}, orderBy: {createdAt: 'asc'}, select: {blockedId: true, createdAt: true}}),
    prisma.userReport.findMany({where: {reporterId: userId}, orderBy: {createdAt: 'asc'}, select: {id: true, reportedUserId: true, reason: true, details: true, status: true, createdAt: true, updatedAt: true, reviewedAt: true}}),
    prisma.notification.findMany({where: {userId}, orderBy: {createdAt: 'asc'}, select: {id: true, type: true, title: true, body: true, createdAt: true, readAt: true, tourRequestId: true}}),
  ]);

  const exportListings = await Promise.all(listings.map(async (listing) => ({
    ...listing,
    approximateLatitude: listing.approximateLatitude,
    approximateLongitude: listing.approximateLongitude,
    media: await Promise.all(listing.media.map(async (media) => ({
      id: media.id, contentType: media.contentType, byteSize: media.byteSize, altText: media.altText,
      url: MEDIA_STORAGE_CONFIGURED ? await createSignedViewUrl(media.objectKey).catch(() => null) : null,
      urlExpiresInSeconds: MEDIA_STORAGE_CONFIGURED ? 900 : null,
    }))),
  })));

  const payload = {
    exportVersion: 1,
    generatedAt: new Date().toISOString(),
    account: {id: user.id, email: user.email, createdAt: user.createdAt},
    profile: user.profile,
    listings: exportListings,
    savedListings,
    tourRequests,
    conversations,
    discoveryActions: actions,
    matches,
    blocks,
    reportsSubmitted: reports,
    notifications,
    notes: [
      'Authentication secrets, password hashes, session tokens, and other members’ private profile data are excluded.',
      'Listing photo URLs, when included, expire after 15 minutes. Download those files before the links expire.',
    ],
  };
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Content-Disposition', `attachment; filename="other-half-data-export-${new Date().toISOString().slice(0, 10)}.json"`);
  response.send(JSON.stringify(payload, null, 2));
}));
