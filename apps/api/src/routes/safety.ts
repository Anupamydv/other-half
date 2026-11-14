import {Router, type RequestHandler} from 'express';
import {
  createReportSchema,
  reportStatusSchema,
  updateReportStatusSchema,
} from '@other-half/contracts';
import {Prisma, type City} from '../generated/prisma/client.js';
import {HttpError, asyncRoute} from '../lib/http.js';
import {prisma} from '../lib/prisma.js';
import {requireSession} from './auth.js';

export const safetyRouter = Router();
const cityFromDb: Record<City, 'bengaluru' | 'mumbai' | 'delhi' | 'hyderabad'> = {
  BENGALURU: 'bengaluru', MUMBAI: 'mumbai', DELHI_NCR: 'delhi', HYDERABAD: 'hyderabad',
};
const reportInclude = {
  reportedUser: {select: {id: true, profile: {select: {displayName: true}}}},
  reporter: {select: {id: true, profile: {select: {displayName: true}}}},
} satisfies Prisma.UserReportInclude;

function serializeReport(report: Prisma.UserReportGetPayload<{include: typeof reportInclude}>) {
  return {
    id: report.id,
    reportedUserId: report.reportedUserId,
    reportedDisplayName: report.reportedUser.profile?.displayName ?? 'Former member',
    reporterId: report.reporterId,
    reporterDisplayName: report.reporter.profile?.displayName ?? 'Former member',
    reason: report.reason,
    details: report.details,
    status: report.status,
    createdAt: report.createdAt.toISOString(),
    reviewedAt: report.reviewedAt?.toISOString() ?? null,
  };
}

const requireModerator: RequestHandler = asyncRoute(async (_request, response, next) => {
  const user = await prisma.user.findUnique({where: {id: response.locals.sessionUserId as string}, select: {isModerator: true}});
  if (!user?.isModerator) throw new HttpError(403, 'MODERATOR_REQUIRED', 'Moderator access is required.');
  next();
});

safetyRouter.get('/blocks', requireSession, asyncRoute(async (_request, response) => {
  const userId = response.locals.sessionUserId as string;
  const rows = await prisma.userBlock.findMany({
    where: {blockerId: userId}, include: {blocked: {include: {profile: {select: {displayName: true, city: true}}}}},
    orderBy: [{createdAt: 'desc'}, {blockedId: 'asc'}],
  });
  response.json({items: rows.map((row) => ({
    userId: row.blockedId,
    displayName: row.blocked.profile?.displayName ?? 'Former member',
    cityId: cityFromDb[row.blocked.profile?.city ?? 'BENGALURU'],
    blockedAt: row.createdAt.toISOString(),
  }))});
}));

safetyRouter.put('/users/:userId/block', requireSession, asyncRoute(async (request, response) => {
  const blockerId = response.locals.sessionUserId as string;
  const blockedId = request.params.userId as string;
  if (blockerId === blockedId) throw new HttpError(400, 'INVALID_BLOCK_TARGET', 'You cannot block your own account.');
  const target = await prisma.user.findUnique({where: {id: blockedId}, select: {id: true}});
  if (!target) throw new HttpError(404, 'MEMBER_NOT_FOUND', 'Member not found.');
  await prisma.$transaction(async (transaction) => {
    const conversations = await transaction.conversation.findMany({
      where: {OR: [{ownerId: blockerId, guestId: blockedId}, {ownerId: blockedId, guestId: blockerId}]},
      select: {id: true}, orderBy: {id: 'asc'},
    });
    for (const conversation of conversations) {
      await transaction.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${conversation.id} FOR UPDATE`;
    }
    await transaction.userBlock.upsert({
      where: {blockerId_blockedId: {blockerId, blockedId}},
      create: {blockerId, blockedId}, update: {},
    });
  });
  response.status(204).end();
}));

safetyRouter.delete('/blocks/:userId', requireSession, asyncRoute(async (request, response) => {
  const blockerId = response.locals.sessionUserId as string;
  await prisma.userBlock.deleteMany({where: {blockerId, blockedId: request.params.userId as string}});
  response.status(204).end();
}));

safetyRouter.post('/users/:userId/reports', requireSession, asyncRoute(async (request, response) => {
  const parsed = createReportSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Choose a report reason.');
  const reporterId = response.locals.sessionUserId as string;
  const reportedUserId = request.params.userId as string;
  if (reporterId === reportedUserId) throw new HttpError(400, 'INVALID_REPORT_TARGET', 'You cannot report your own account.');
  const target = await prisma.user.findUnique({where: {id: reportedUserId}, select: {id: true}});
  if (!target) throw new HttpError(404, 'MEMBER_NOT_FOUND', 'Member not found.');
  const result = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${reporterId} FOR UPDATE`;
    const existing = await transaction.userReport.findFirst({
      where: {reporterId, reportedUserId, status: {in: ['OPEN', 'IN_REVIEW']}},
      include: reportInclude,
    });
    if (existing) return {created: false, report: existing};
    const report = await transaction.userReport.create({
      data: {reporterId, reportedUserId, reason: parsed.data.reason, details: parsed.data.details},
      include: reportInclude,
    });
    return {created: true, report};
  });
  response.status(result.created ? 201 : 200).json({item: serializeReport(result.report)});
}));

safetyRouter.get('/reports/mine', requireSession, asyncRoute(async (_request, response) => {
  const reporterId = response.locals.sessionUserId as string;
  const rows = await prisma.userReport.findMany({
    where: {reporterId}, include: reportInclude, orderBy: [{createdAt: 'desc'}, {id: 'desc'}], take: 50,
  });
  response.json({items: rows.map(serializeReport).map(({reporterId: _reporterId, reporterDisplayName: _reporterDisplayName, ...report}) => report)});
}));

safetyRouter.get('/moderation/reports', requireSession, requireModerator, asyncRoute(async (request, response) => {
  const status = typeof request.query.status === 'string' ? request.query.status : undefined;
  if (status && !reportStatusSchema.safeParse(status).success) throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a valid report status.');
  const rows = await prisma.userReport.findMany({
    where: status ? {status: status as 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED'} : {status: {in: ['OPEN', 'IN_REVIEW']}},
    include: reportInclude, orderBy: [{createdAt: 'asc'}, {id: 'asc'}], take: 100,
  });
  response.json({items: rows.map(serializeReport)});
}));

safetyRouter.patch('/moderation/reports/:id', requireSession, requireModerator, asyncRoute(async (request, response) => {
  const parsed = updateReportStatusSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Choose a report status.');
  const reviewerId = response.locals.sessionUserId as string;
  const existing = await prisma.userReport.findUnique({where: {id: request.params.id as string}, select: {id: true, status: true}});
  if (!existing) throw new HttpError(404, 'REPORT_NOT_FOUND', 'Report not found.');
  const reviewedAt = parsed.data.status === 'IN_REVIEW' ? null : new Date();
  const result = await prisma.userReport.updateMany({where: {id: existing.id, status: existing.status}, data: {
    status: parsed.data.status, reviewerId, reviewedAt,
  }});
  if (result.count !== 1) throw new HttpError(409, 'REPORT_CHANGED', 'This report changed. Refresh the queue and retry.');
  const report = await prisma.userReport.findUniqueOrThrow({where: {id: existing.id}, include: reportInclude});
  response.json({item: serializeReport(report)});
}));

