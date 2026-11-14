import {Router} from 'express';
import {asyncRoute} from '../lib/http.js';
import {prisma} from '../lib/prisma.js';
import {requireSession} from './auth.js';

export const notificationsRouter = Router();

notificationsRouter.get('/notifications', requireSession, asyncRoute(async (_request, response) => {
  const userId = response.locals.sessionUserId as string;
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {userId}, orderBy: [{createdAt: 'desc'}, {id: 'desc'}], take: 30,
    }),
    prisma.notification.count({where: {userId, readAt: null}}),
  ]);
  response.json({
    items: items.map((item) => ({...item, createdAt: item.createdAt.toISOString(), readAt: item.readAt?.toISOString() ?? null})),
    unreadCount,
  });
}));

notificationsRouter.post('/notifications/:id/read', requireSession, asyncRoute(async (request, response) => {
  const userId = response.locals.sessionUserId as string;
  await prisma.notification.updateMany({
    where: {id: request.params.id as string, userId, readAt: null}, data: {readAt: new Date()},
  });
  response.status(204).end();
}));

notificationsRouter.post('/notifications/read-all', requireSession, asyncRoute(async (_request, response) => {
  const userId = response.locals.sessionUserId as string;
  await prisma.notification.updateMany({where: {userId, readAt: null}, data: {readAt: new Date()}});
  response.status(204).end();
}));

