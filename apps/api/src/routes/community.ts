import {Router} from 'express';
import {
  communityCommentCreateSchema,
  communityCommentQuerySchema,
  communityPostCreateSchema,
  communityPostQuerySchema,
  type CommunityPostInput,
} from '@other-half/contracts';
import {type City, type CommunityPostType} from '../generated/prisma/client.js';
import {HttpError, asyncRoute} from '../lib/http.js';
import {prisma} from '../lib/prisma.js';
import {requireSession} from './auth.js';

const cityToDb: Record<string, City> = {bengaluru: 'BENGALURU', mumbai: 'MUMBAI', delhi: 'DELHI_NCR', hyderabad: 'HYDERABAD'};
const cityFromDb: Record<City, 'bengaluru' | 'mumbai' | 'delhi' | 'hyderabad'> = {BENGALURU: 'bengaluru', MUMBAI: 'mumbai', DELHI_NCR: 'delhi', HYDERABAD: 'hyderabad'};
const postInclude = {
  author: {select: {profile: {select: {displayName: true}}}},
  _count: {select: {likes: true, comments: true}},
} as const;

export const communityRouter = Router();

communityRouter.get('/community/posts', requireSession, asyncRoute(async (request, response) => {
  const parsed = communityPostQuerySchema.safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid community feed filters.');
  const userId = response.locals.sessionUserId as string;
  const {cityId, neighborhood, savedOnly, cursor, limit} = parsed.data;
  const excludedAuthorIds = await getExcludedAuthorIds(userId);
  if (cursor) {
    const valid = await prisma.communityPost.findFirst({where: {
      id: cursor, city: cityToDb[cityId], status: 'ACTIVE', authorId: {notIn: excludedAuthorIds},
      ...(savedOnly ? {saves: {some: {userId}}} : {}),
      ...(neighborhood ? {neighborhood: {equals: neighborhood, mode: 'insensitive' as const}} : {}),
    }, select: {id: true}});
    if (!valid) throw new HttpError(400, 'INVALID_CURSOR', 'The community feed changed. Reload the feed to continue.');
  }
  const posts = await prisma.communityPost.findMany({
    where: {
      city: cityToDb[cityId], status: 'ACTIVE', authorId: {notIn: excludedAuthorIds},
      ...(savedOnly ? {saves: {some: {userId}}} : {}),
      ...(neighborhood ? {neighborhood: {equals: neighborhood, mode: 'insensitive' as const}} : {}),
    },
    include: {...postInclude, likes: {where: {userId}, select: {postId: true}}, saves: {where: {userId}, select: {postId: true}},
      comments: {where: {authorId: {notIn: excludedAuthorIds}}, orderBy: [{createdAt: 'desc'}, {id: 'desc'}], take: 3, include: {author: {select: {profile: {select: {displayName: true}}}}}}},
    orderBy: [{createdAt: 'desc'}, {id: 'desc'}],
    ...(cursor ? {cursor: {id: cursor}, skip: 1} : {}),
    take: limit + 1,
  });
  const hasMore = posts.length > limit;
  const items = posts.slice(0, limit);
  response.json({items: items.map((post) => serializePost(post, userId)), nextCursor: hasMore ? items.at(-1)?.id ?? null : null});
}));

communityRouter.post('/community/posts', requireSession, asyncRoute(async (request, response) => {
  const parsed = communityPostCreateSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid post details.');
  const userId = response.locals.sessionUserId as string;
  const input = parsed.data;
  const recentPosts = await prisma.communityPost.count({where: {authorId: userId, createdAt: {gt: new Date(Date.now() - 24 * 60 * 60 * 1000)}}});
  if (recentPosts >= 10) throw new HttpError(429, 'POST_RATE_LIMITED', 'You have shared several updates today. Try again tomorrow.');
  const post = await prisma.communityPost.create({
    data: toPostData(input, userId),
    include: {...postInclude, likes: {where: {userId}, select: {postId: true}}, saves: {where: {userId}, select: {postId: true}}, comments: {take: 0, include: {author: {select: {profile: {select: {displayName: true}}}}}}},
  });
  response.status(201).json({item: serializePost(post, userId)});
}));

communityRouter.put('/community/posts/:id/like', requireSession, asyncRoute(async (request, response) => {
  const userId = response.locals.sessionUserId as string;
  const post = await findVisiblePost(request.params.id as string, userId);
  if (!post) throw new HttpError(404, 'POST_NOT_FOUND', 'This post is not available.');
  const excludedAuthorIds = await getExcludedAuthorIds(userId);
  await prisma.communityPostLike.upsert({where: {postId_userId: {postId: post.id, userId}}, create: {postId: post.id, userId}, update: {}});
  response.status(204).end();
}));

communityRouter.delete('/community/posts/:id/like', requireSession, asyncRoute(async (request, response) => {
  const userId = response.locals.sessionUserId as string;
  await prisma.communityPostLike.deleteMany({where: {postId: request.params.id as string, userId}});
  response.status(204).end();
}));

communityRouter.put('/community/posts/:id/save', requireSession, asyncRoute(async (request, response) => {
  const userId = response.locals.sessionUserId as string;
  const post = await findVisiblePost(request.params.id as string, userId);
  if (!post) throw new HttpError(404, 'POST_NOT_FOUND', 'This post is not available.');
  await prisma.communityPostSave.upsert({where: {postId_userId: {postId: post.id, userId}}, create: {postId: post.id, userId}, update: {}});
  response.status(204).end();
}));

communityRouter.delete('/community/posts/:id/save', requireSession, asyncRoute(async (request, response) => {
  const userId = response.locals.sessionUserId as string;
  await prisma.communityPostSave.deleteMany({where: {postId: request.params.id as string, userId}});
  response.status(204).end();
}));

communityRouter.get('/community/posts/:id/comments', requireSession, asyncRoute(async (request, response) => {
  const userId = response.locals.sessionUserId as string;
  const post = await findVisiblePost(request.params.id as string, userId);
  if (!post) throw new HttpError(404, 'POST_NOT_FOUND', 'This post is not available.');
  const excludedAuthorIds = await getExcludedAuthorIds(userId);
  const parsed = communityCommentQuerySchema.safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid comment page.');
  const {limit, cursor} = parsed.data;
  const rows = await prisma.communityPostComment.findMany({
    where: {postId: post.id, authorId: {notIn: excludedAuthorIds}},
    include: {author: {select: {profile: {select: {displayName: true}}}}},
    orderBy: [{createdAt: 'desc'}, {id: 'desc'}],
    ...(cursor ? {cursor: {id: cursor}, skip: 1} : {}), take: limit + 1,
  });
  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const items = pageRows.reverse().map(serializeComment);
  response.json({items, nextCursor: hasMore ? pageRows.at(-1)?.id ?? null : null});
}));

communityRouter.post('/community/posts/:id/comments', requireSession, asyncRoute(async (request, response) => {
  const parsed = communityCommentCreateSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Write a comment first.');
  const userId = response.locals.sessionUserId as string;
  const post = await findVisiblePost(request.params.id as string, userId);
  if (!post) throw new HttpError(404, 'POST_NOT_FOUND', 'This post is not available.');
  const recentComments = await prisma.communityPostComment.count({where: {authorId: userId, createdAt: {gt: new Date(Date.now() - 60 * 60 * 1000)}}});
  if (recentComments >= 60) throw new HttpError(429, 'COMMENT_RATE_LIMITED', 'You have sent many comments this hour. Wait a little before commenting again.');
  const comment = await prisma.communityPostComment.create({
    data: {postId: post.id, authorId: userId, body: parsed.data.body},
    include: {author: {select: {profile: {select: {displayName: true}}}}},
  });
  response.status(201).json({item: serializeComment(comment)});
}));

communityRouter.delete('/community/posts/:id', requireSession, asyncRoute(async (request, response) => {
  const userId = response.locals.sessionUserId as string;
  const result = await prisma.communityPost.updateMany({where: {id: request.params.id as string, authorId: userId, status: 'ACTIVE'}, data: {status: 'REMOVED'}});
  if (!result.count) throw new HttpError(404, 'POST_NOT_FOUND', 'This post is not available.');
  response.status(204).end();
}));

function toPostData(input: CommunityPostInput, authorId: string) {
  return {
    authorId, city: cityToDb[input.cityId], neighborhood: input.neighborhood, postType: input.postType as CommunityPostType,
    caption: input.caption, rentPerMonth: input.rentPerMonth, flatTitle: input.flatTitle, tags: [...new Set(input.tags)],
  };
}

async function getExcludedAuthorIds(userId: string) {
  const blocks = await prisma.userBlock.findMany({where: {OR: [{blockerId: userId}, {blockedId: userId}]}, select: {blockerId: true, blockedId: true}});
  return [...new Set(blocks.flatMap((block) => [block.blockerId, block.blockedId]).filter((id) => id !== userId))];
}

async function findVisiblePost(postId: string, userId: string) {
  const excluded = await getExcludedAuthorIds(userId);
  return prisma.communityPost.findFirst({where: {id: postId, status: 'ACTIVE', authorId: {notIn: excluded}}});
}

function serializePost(post: {
  id: string; authorId: string; city: City; neighborhood: string; postType: CommunityPostType; caption: string;
  rentPerMonth: number | null; flatTitle: string | null; tags: string[]; createdAt: Date;
  author: {profile: {displayName: string} | null}; _count: {likes: number; comments: number};
  likes: Array<{postId: string}>; saves: Array<{postId: string}>;
  comments: Array<{id: string; authorId: string; body: string; createdAt: Date; author: {profile: {displayName: string} | null}}>
}, userId: string) {
  return {
    id: post.id, authorId: post.authorId, authorDisplayName: post.author.profile?.displayName ?? 'Other Half member',
    cityId: cityFromDb[post.city], neighborhood: post.neighborhood, postType: post.postType,
    caption: post.caption, rentPerMonth: post.rentPerMonth, flatTitle: post.flatTitle, tags: post.tags,
    likeCount: post._count.likes, commentCount: post._count.comments,
    likedByMe: post.likes.some((like) => like.postId === post.id), savedByMe: post.saves.some((save) => save.postId === post.id),
    createdAt: post.createdAt.toISOString(), comments: post.comments.slice().reverse().map(serializeComment),
  };
}

function serializeComment(comment: {id: string; authorId: string; body: string; createdAt: Date; author: {profile: {displayName: string} | null}}) {
  return {id: comment.id, authorId: comment.authorId, authorDisplayName: comment.author.profile?.displayName ?? 'Other Half member', body: comment.body, createdAt: comment.createdAt.toISOString()};
}
