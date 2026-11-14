import {Router} from 'express';
import {
  discoveryActionSchema,
  discoveryQuerySchema,
  lifestylePreferencesSchema,
} from '@other-half/contracts';
import {Prisma, type City} from '../generated/prisma/client.js';
import {HttpError, asyncRoute} from '../lib/http.js';
import {prisma} from '../lib/prisma.js';
import {requireSession} from './auth.js';

const cityToDb: Record<string, City> = {
  bengaluru: 'BENGALURU', mumbai: 'MUMBAI', delhi: 'DELHI_NCR', hyderabad: 'HYDERABAD',
};
const cityFromDb: Record<City, 'bengaluru' | 'mumbai' | 'delhi' | 'hyderabad'> = {
  BENGALURU: 'bengaluru', MUMBAI: 'mumbai', DELHI_NCR: 'delhi', HYDERABAD: 'hyderabad',
};
const defaultPreferences = {
  sleep: 'Balanced', kitchen: 'Non-Veg Friendly', work: 'Hybrid', cleanliness: 'Tidy',
  social: 'Balanced', maxBudget: 30_000, petFriendly: false, nonSmoker: false,
} as const;

function serializeProfile(profile: {
  userId: string; displayName: string; age: number | null; role: string | null; city: City;
  neighborhood: string | null; bio: string; preferences: Prisma.JsonValue;
}) {
  const preferences = lifestylePreferencesSchema.safeParse(profile.preferences);
  return {
    id: profile.userId,
    displayName: profile.displayName,
    age: profile.age,
    role: profile.role,
    cityId: cityFromDb[profile.city],
    neighborhood: profile.neighborhood,
    bio: profile.bio,
    preferences: preferences.success ? preferences.data : defaultPreferences,
  };
}

export const discoveryRouter = Router();

discoveryRouter.get('/discovery/profiles', requireSession, asyncRoute(async (request, response) => {
  const parsed = discoveryQuerySchema.safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid discovery query.');
  const userId = response.locals.sessionUserId as string;
  const ownProfile = await prisma.profile.findUnique({where: {userId}, select: {discoveryEnabled: true}});
  if (!ownProfile?.discoveryEnabled) {
    response.json({items: [], nextCursor: null, discoveryEnabled: false});
    return;
  }
  const blocks = await prisma.userBlock.findMany({
    where: {OR: [{blockerId: userId}, {blockedId: userId}]}, select: {blockerId: true, blockedId: true},
  });
  const blockedUserIds = [...new Set(blocks.flatMap((block) => [block.blockerId, block.blockedId]))];
  const cursor = parsed.data.cursor;
  const candidateWhere = {
    city: cityToDb[parsed.data.cityId],
    discoveryEnabled: true,
    userId: {not: userId, ...(blockedUserIds.length > 0 ? {notIn: blockedUserIds} : {})},
    user: {discoveryActionsReceived: {none: {actorId: userId}}},
  } satisfies Prisma.ProfileWhereInput;
  if (cursor) {
    const validCursor = cursor === userId || blockedUserIds.includes(cursor) ? null : await prisma.profile.findFirst({
      where: {
        userId: cursor,
        city: cityToDb[parsed.data.cityId],
        discoveryEnabled: true,
        user: {discoveryActionsReceived: {none: {actorId: userId}}},
      },
      select: {userId: true},
    });
    if (!validCursor) throw new HttpError(400, 'INVALID_CURSOR', 'The discovery page changed. Reload profiles to continue.');
  }
  const rows = await prisma.profile.findMany({
    where: candidateWhere,
    orderBy: {userId: 'asc'},
    ...(cursor ? {cursor: {userId: cursor}, skip: 1} : {}),
    take: parsed.data.limit + 1,
  });
  const hasMore = rows.length > parsed.data.limit;
  const items = rows.slice(0, parsed.data.limit);
  response.json({
    items: items.map(serializeProfile),
    nextCursor: hasMore ? items.at(-1)?.userId ?? null : null,
    discoveryEnabled: true,
  });
}));

discoveryRouter.post('/discovery/actions', requireSession, asyncRoute(async (request, response) => {
  const parsed = discoveryActionSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Choose a profile action.');
  const actorId = response.locals.sessionUserId as string;
  const {targetUserId, action} = parsed.data;
  if (actorId === targetUserId) throw new HttpError(400, 'INVALID_TARGET', 'You cannot discover your own profile.');

  const result = await prisma.$transaction(async (transaction) => {
    // Lock both account rows in a stable order so simultaneous mutual likes cannot miss each other.
    await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${actorId}, ${targetUserId}) ORDER BY "id" FOR UPDATE`;
    const actor = await transaction.profile.findUnique({where: {userId: actorId}, select: {discoveryEnabled: true}});
    const target = await transaction.profile.findUnique({where: {userId: targetUserId}, select: {discoveryEnabled: true, city: true}});
    if (!actor?.discoveryEnabled) throw new HttpError(403, 'DISCOVERY_DISABLED', 'Enable your profile in Profile & Quiz before using discovery.');
    if (!target?.discoveryEnabled) throw new HttpError(404, 'PROFILE_NOT_AVAILABLE', 'This profile is no longer available.');
    const blocked = await transaction.userBlock.findFirst({
      where: {OR: [{blockerId: actorId, blockedId: targetUserId}, {blockerId: targetUserId, blockedId: actorId}]},
      select: {blockerId: true},
    });
    if (blocked) throw new HttpError(404, 'PROFILE_NOT_AVAILABLE', 'This profile is no longer available.');

    const savedAction = await transaction.discoveryAction.upsert({
      where: {actorId_targetId: {actorId, targetId: targetUserId}},
      create: {actorId, targetId: targetUserId, action},
      update: {},
      select: {action: true},
    });
    const positive = savedAction.action === 'LIKE' || savedAction.action === 'SUPER_LIKE';
    const reciprocal = positive ? await transaction.discoveryAction.findFirst({
      where: {actorId: targetUserId, targetId: actorId, action: {in: ['LIKE', 'SUPER_LIKE']}},
      select: {id: true},
    }) : null;
    if (!reciprocal) return {action: savedAction.action, matched: false, conversationId: null};

    const [lowUserId, highUserId] = actorId < targetUserId ? [actorId, targetUserId] : [targetUserId, actorId];
    const match = await transaction.match.upsert({
      where: {lowUserId_highUserId: {lowUserId, highUserId}},
      create: {lowUserId, highUserId},
      update: {},
      select: {id: true},
    });
    const conversation = await transaction.conversation.upsert({
      where: {matchId: match.id},
      create: {matchId: match.id, listingId: null, ownerId: lowUserId, guestId: highUserId},
      update: {},
      select: {id: true},
    });
    return {action: savedAction.action, matched: true, conversationId: conversation.id};
  });
  response.status(200).json(result);
}));

discoveryRouter.get('/matches', requireSession, asyncRoute(async (_request, response) => {
  const userId = response.locals.sessionUserId as string;
  const blocks = await prisma.userBlock.findMany({where: {OR: [{blockerId: userId}, {blockedId: userId}]}, select: {blockerId: true, blockedId: true}});
  const blockedUserIds = [...new Set(blocks.flatMap((block) => [block.blockerId, block.blockedId]))];
  const matchWhere: Prisma.MatchWhereInput = blockedUserIds.length > 0 ? {OR: [
    {lowUserId: userId, highUserId: {notIn: blockedUserIds}},
    {highUserId: userId, lowUserId: {notIn: blockedUserIds}},
  ]} : {OR: [{lowUserId: userId}, {highUserId: userId}]};
  const matches = await prisma.match.findMany({
    where: matchWhere,
    include: {lowUser: {include: {profile: true}}, highUser: {include: {profile: true}}, conversation: {select: {id: true}}},
    orderBy: [{createdAt: 'desc'}, {id: 'desc'}],
  });
  response.json({items: matches.flatMap((match) => {
    const other = match.lowUserId === userId ? match.highUser.profile : match.lowUser.profile;
    if (!other || !match.conversation) return [];
    return [{id: match.id, conversationId: match.conversation.id, createdAt: match.createdAt.toISOString(), profile: serializeProfile(other)}];
  })});
}));

