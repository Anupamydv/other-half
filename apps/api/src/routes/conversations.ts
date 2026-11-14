import {Router} from 'express';
import {sendMessageSchema} from '@other-half/contracts';
import {Prisma} from '../generated/prisma/client.js';
import {HttpError, asyncRoute} from '../lib/http.js';
import {prisma} from '../lib/prisma.js';
import {requireSession} from './auth.js';

export const conversationsRouter = Router();

const conversationInclude = {
  listing: {select: {id: true, title: true, city: true, neighborhood: true}},
  owner: {select: {id: true, profile: {select: {displayName: true, city: true, neighborhood: true}}}},
  guest: {select: {id: true, profile: {select: {displayName: true, city: true, neighborhood: true}}}},
  messages: {orderBy: [{createdAt: 'desc'}, {id: 'desc'}], take: 1},
} satisfies Prisma.ConversationInclude;

const cityFromDb = {BENGALURU: 'bengaluru', MUMBAI: 'mumbai', DELHI_NCR: 'delhi', HYDERABAD: 'hyderabad'} as const;

function serializeMessage(message: {id: string; conversationId: string; senderId: string; body: string; createdAt: Date}) {
  return {...message, createdAt: message.createdAt.toISOString()};
}

function serializeConversation(row: Prisma.ConversationGetPayload<{include: typeof conversationInclude}>, userId: string, blockedIds: Set<string>) {
  const isOwner = row.ownerId === userId;
  const peer = isOwner ? row.guest : row.owner;
  const peerCity = row.listing?.city ?? peer.profile?.city ?? 'BENGALURU';
  const latest = row.messages[0];
  const readAt = isOwner ? row.ownerReadAt : row.guestReadAt;
  return {
    id: row.id, listingId: row.listingId, listingTitle: row.listing?.title ?? 'Roommate match',
    cityId: cityFromDb[peerCity], neighborhood: row.listing?.neighborhood ?? peer.profile?.neighborhood ?? 'Neighborhood not set',
    peerId: peer.id, peerDisplayName: peer.profile?.displayName ?? 'Other Half member',
    lastMessage: latest ? serializeMessage(latest) : null,
    lastMessageAt: (latest?.createdAt ?? row.lastMessageAt).toISOString(),
    unread: Boolean(latest && latest.senderId !== userId && (!readAt || latest.createdAt > readAt)),
    blockedByMe: blockedIds.has(peer.id),
    blockedByPeer: false,
  };
}

async function requireConversationMember(conversationId: string, userId: string) {
  const row = await prisma.conversation.findFirst({
    where: {id: conversationId, OR: [{ownerId: userId}, {guestId: userId}]},
    select: {id: true, ownerId: true, guestId: true},
  });
  if (!row) throw new HttpError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  return row;
}

conversationsRouter.post('/tour-requests/:id/conversation', requireSession, asyncRoute(async (request, response) => {
  const userId = response.locals.sessionUserId as string;
  const tour = await prisma.tourRequest.findUnique({
    where: {id: request.params.id as string},
    include: {listing: {select: {id: true, ownerId: true, status: true}}},
  });
  if (!tour || tour.status !== 'CONFIRMED' || (tour.requesterId !== userId && tour.listing.ownerId !== userId)) {
    throw new HttpError(404, 'TOUR_NOT_FOUND', 'Confirmed visit not found.');
  }
  const ownerId = tour.listing.ownerId;
  const guestId = tour.requesterId;
  const blocked = await prisma.userBlock.findFirst({where: {OR: [{blockerId: ownerId, blockedId: guestId}, {blockerId: guestId, blockedId: ownerId}]}});
  if (blocked) throw new HttpError(403, 'MESSAGING_BLOCKED', 'Messaging is unavailable for this conversation.');
  const conversation = await prisma.conversation.upsert({
    where: {listingId_ownerId_guestId: {listingId: tour.listingId, ownerId, guestId}},
    create: {listingId: tour.listingId, ownerId, guestId},
    update: {},
    select: {id: true},
  });
  response.status(200).json({id: conversation.id});
}));

conversationsRouter.post('/matches/:id/conversation', requireSession, asyncRoute(async (request, response) => {
  const userId = response.locals.sessionUserId as string;
  const match = await prisma.match.findFirst({
    where: {id: request.params.id as string, OR: [{lowUserId: userId}, {highUserId: userId}]},
    select: {id: true, lowUserId: true, highUserId: true},
  });
  if (!match) throw new HttpError(404, 'MATCH_NOT_FOUND', 'Match not found.');
  const peerId = match.lowUserId === userId ? match.highUserId : match.lowUserId;
  const blocked = await prisma.userBlock.findFirst({where: {OR: [{blockerId: userId, blockedId: peerId}, {blockerId: peerId, blockedId: userId}]}});
  if (blocked) throw new HttpError(403, 'MESSAGING_BLOCKED', 'Messaging is unavailable for this match.');
  const conversation = await prisma.conversation.upsert({
    where: {matchId: match.id},
    create: {matchId: match.id, listingId: null, ownerId: match.lowUserId, guestId: match.highUserId},
    update: {},
    select: {id: true},
  });
  response.json({id: conversation.id});
}));

conversationsRouter.get('/conversations', requireSession, asyncRoute(async (_request, response) => {
  const userId = response.locals.sessionUserId as string;
  const rows = await prisma.conversation.findMany({
    where: {OR: [{ownerId: userId}, {guestId: userId}]}, include: conversationInclude,
    orderBy: [{lastMessageAt: 'desc'}, {id: 'desc'}], take: 100,
  });
  const peers = rows.map((row) => row.ownerId === userId ? row.guestId : row.ownerId);
  const [given, received] = await Promise.all([
    prisma.userBlock.findMany({where: {blockerId: userId, blockedId: {in: peers}}, select: {blockedId: true}}),
    prisma.userBlock.findMany({where: {blockedId: userId, blockerId: {in: peers}}, select: {blockerId: true}}),
  ]);
  const blockedByMe = new Set(given.map((item) => item.blockedId));
  const blockedByPeer = new Set(received.map((item) => item.blockerId));
  response.json({items: rows.map((row) => ({
    ...serializeConversation(row, userId, blockedByMe), blockedByPeer: blockedByPeer.has(row.ownerId === userId ? row.guestId : row.ownerId),
  }))});
}));

conversationsRouter.get('/conversations/:id/messages', requireSession, asyncRoute(async (request, response) => {
  const userId = response.locals.sessionUserId as string;
  const conversationId = request.params.id as string;
  await requireConversationMember(conversationId, userId);
  const cursor = typeof request.query.cursor === 'string' ? request.query.cursor : undefined;
  if (cursor) {
    const valid = await prisma.conversationMessage.findFirst({where: {id: cursor, conversationId}, select: {id: true}});
    if (!valid) throw new HttpError(400, 'INVALID_CURSOR', 'Message page is no longer available. Reload the conversation.');
  }
  const rows = await prisma.conversationMessage.findMany({
    where: {conversationId}, orderBy: [{createdAt: 'desc'}, {id: 'desc'}],
    ...(cursor ? {cursor: {id: cursor}, skip: 1} : {}), take: 51,
  });
  const hasMore = rows.length > 50;
  const page = rows.slice(0, 50).reverse();
  response.json({items: page.map(serializeMessage), nextCursor: hasMore ? rows[49]?.id ?? null : null});
}));

conversationsRouter.post('/conversations/:id/read', requireSession, asyncRoute(async (request, response) => {
  const userId = response.locals.sessionUserId as string;
  const conversation = await requireConversationMember(request.params.id as string, userId);
  const throughMessageId = typeof request.body?.throughMessageId === 'string' ? request.body.throughMessageId : undefined;
  if (!throughMessageId) throw new HttpError(400, 'VALIDATION_ERROR', 'Choose the latest message currently shown as read.');
  const message = await prisma.conversationMessage.findFirst({where: {id: throughMessageId, conversationId: conversation.id}, select: {createdAt: true}});
  if (!message) throw new HttpError(400, 'INVALID_READ_MARKER', 'The message read marker is not part of this conversation.');
  await prisma.conversation.update({where: {id: conversation.id}, data: conversation.ownerId === userId ? {ownerReadAt: message.createdAt} : {guestReadAt: message.createdAt}});
  response.status(204).end();
}));

conversationsRouter.post('/conversations/:id/messages', requireSession, asyncRoute(async (request, response) => {
  const parsed = sendMessageSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Enter a message.');
  const userId = response.locals.sessionUserId as string;
  const id = request.params.id as string;
  const result = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${id} FOR UPDATE`;
    const conversation = await transaction.conversation.findFirst({where: {id, OR: [{ownerId: userId}, {guestId: userId}]}, select: {id: true, ownerId: true, guestId: true}});
    if (!conversation) throw new HttpError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
    const peerId = conversation.ownerId === userId ? conversation.guestId : conversation.ownerId;
    const blocked = await transaction.userBlock.findFirst({where: {OR: [{blockerId: userId, blockedId: peerId}, {blockerId: peerId, blockedId: userId}]}, select: {blockerId: true}});
    if (blocked) throw new HttpError(403, 'MESSAGING_BLOCKED', 'This conversation cannot receive new messages.');
    const latest = await transaction.conversationMessage.findFirst({where: {conversationId: id}, orderBy: [{createdAt: 'desc'}, {id: 'desc'}], select: {createdAt: true}});
    // The conversation row is locked above. Keep timestamps strictly increasing so timestamp read markers are unambiguous.
    const createdAt = new Date(Math.max(Date.now(), (latest?.createdAt.getTime() ?? 0) + 1));
    const created = await transaction.conversationMessage.create({data: {conversationId: id, senderId: userId, body: parsed.data.body, createdAt}});
    await transaction.conversation.update({where: {id}, data: {
      lastMessageAt: created.createdAt,
      ...(conversation.ownerId === userId ? {ownerReadAt: created.createdAt} : {guestReadAt: created.createdAt}),
    }});
    return created;
  });
  response.status(201).json({item: serializeMessage(result)});
}));

conversationsRouter.put('/conversations/:id/block', requireSession, asyncRoute(async (request, response) => {
  const userId = response.locals.sessionUserId as string;
  const id = request.params.id as string;
  const conversation = await requireConversationMember(id, userId);
  const peerId = conversation.ownerId === userId ? conversation.guestId : conversation.ownerId;
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${id} FOR UPDATE`;
    await transaction.userBlock.upsert({where: {blockerId_blockedId: {blockerId: userId, blockedId: peerId}}, create: {blockerId: userId, blockedId: peerId}, update: {}});
  });
  response.status(204).end();
}));

conversationsRouter.delete('/conversations/:id/block', requireSession, asyncRoute(async (request, response) => {
  const userId = response.locals.sessionUserId as string;
  const conversation = await requireConversationMember(request.params.id as string, userId);
  const peerId = conversation.ownerId === userId ? conversation.guestId : conversation.ownerId;
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${conversation.id} FOR UPDATE`;
    await transaction.userBlock.deleteMany({where: {blockerId: userId, blockedId: peerId}});
  });
  response.status(204).end();
}));

