import {createHash, randomBytes} from 'node:crypto';
import {Router, type RequestHandler} from 'express';
import {changePasswordInputSchema, loginInputSchema, profileUpdateSchema, registerInputSchema, type LifestylePreferences} from '@other-half/contracts';
import {Prisma, type City} from '../generated/prisma/client.js';
import {env} from '../config/env.js';
import {HttpError, asyncRoute} from '../lib/http.js';
import {hashPassword, verifyPassword} from '../lib/password.js';
import {prisma} from '../lib/prisma.js';

const SESSION_COOKIE = 'other_half_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_PREFERENCES: LifestylePreferences = {
  sleep: 'Balanced', kitchen: 'Non-Veg Friendly', work: 'Hybrid', cleanliness: 'Tidy',
  social: 'Balanced', maxBudget: 30_000, petFriendly: false, nonSmoker: false,
};
const cityToDb: Record<string, City> = {
  bengaluru: 'BENGALURU', mumbai: 'MUMBAI', delhi: 'DELHI_NCR', hyderabad: 'HYDERABAD',
};
const cityFromDb: Record<City, 'bengaluru' | 'mumbai' | 'delhi' | 'hyderabad'> = {
  BENGALURU: 'bengaluru', MUMBAI: 'mumbai', DELHI_NCR: 'delhi', HYDERABAD: 'hyderabad',
};

function digest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function readSessionToken(request: Parameters<RequestHandler>[0]) {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;
  const entry = cookieHeader.split(';').map((value) => value.trim()).find((value) => value.startsWith(`${SESSION_COOKIE}=`));
  return entry?.slice(SESSION_COOKIE.length + 1);
}

function setSessionCookie(response: Parameters<RequestHandler>[1], token: string) {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1',
    maxAge: SESSION_DURATION_MS,
  });
}

function clearSessionCookie(response: Parameters<RequestHandler>[1]) {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/v1',
  });
}

async function createSession(userId: string, response: Parameters<RequestHandler>[1]) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await prisma.session.create({data: {userId, tokenHash: digest(token), expiresAt}});
  setSessionCookie(response, token);
}

export const requireSession: RequestHandler = asyncRoute(async (request, response, next) => {
  const token = readSessionToken(request);
  if (!token || token.length > 128) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  const session = await prisma.session.findUnique({
    where: {tokenHash: digest(token)},
    select: {id: true, userId: true, expiresAt: true},
  });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.delete({where: {id: session.id}});
    throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  }
  response.locals.sessionUserId = session.userId;
  next();
});

export const authRouter = Router();

authRouter.post('/auth/register', asyncRoute(async (request, response) => {
  const parsed = registerInputSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid registration details.');
  const input = parsed.data;
  const passwordHash = await hashPassword(input.password);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  try {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        sessions: {create: {tokenHash: digest(token), expiresAt}},
        profile: {create: {
          displayName: input.displayName,
          city: cityToDb[input.cityId],
          preferences: DEFAULT_PREFERENCES as Prisma.InputJsonValue,
        }},
      },
      include: {profile: true},
    });
    setSessionCookie(response, token);
    response.status(201).json({user: {id: user.id, email: user.email}, profile: serializeProfile(user.profile)});
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new HttpError(409, 'EMAIL_UNAVAILABLE', 'An account with that email already exists.');
    }
    throw error;
  }
}));

authRouter.post('/auth/login', asyncRoute(async (request, response) => {
  const parsed = loginInputSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Enter a valid email and password.');
  const user = await prisma.user.findUnique({where: {email: parsed.data.email}, include: {profile: true}});
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  await createSession(user.id, response);
  response.json({user: {id: user.id, email: user.email}, profile: serializeProfile(user.profile)});
}));

authRouter.get('/auth/me', requireSession, asyncRoute(async (request, response) => {
  const user = await prisma.user.findUnique({
    where: {id: response.locals.sessionUserId as string}, include: {profile: true},
  });
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  response.json({user: {id: user.id, email: user.email}, profile: serializeProfile(user.profile)});
}));

authRouter.post('/auth/logout', asyncRoute(async (request, response) => {
  const token = readSessionToken(request);
  if (token && token.length <= 128) {
    await prisma.session.deleteMany({where: {tokenHash: digest(token)}});
  }
  clearSessionCookie(response);
  response.status(204).end();
}));

authRouter.post('/auth/password', requireSession, asyncRoute(async (request, response) => {
  const parsed = changePasswordInputSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid password details.');
  const userId = response.locals.sessionUserId as string;
  const user = await prisma.user.findUnique({where: {id: userId}, select: {passwordHash: true}});
  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect.');
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({where: {id: userId}, data: {passwordHash}});
    await transaction.session.deleteMany({where: {userId}});
    await transaction.session.create({data: {userId, tokenHash: digest(token), expiresAt}});
  });

  setSessionCookie(response, token);
  response.status(204).end();
}));

authRouter.patch('/profile/me', requireSession, asyncRoute(async (request, response) => {
  const parsed = profileUpdateSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid profile details.');
  const input = parsed.data;
  const profile = await prisma.profile.update({
    where: {userId: response.locals.sessionUserId as string},
    data: {
      ...(input.displayName !== undefined ? {displayName: input.displayName} : {}),
      ...(input.age !== undefined ? {age: input.age} : {}),
      ...(input.role !== undefined ? {role: input.role} : {}),
      ...(input.cityId !== undefined ? {city: cityToDb[input.cityId]} : {}),
      ...(input.neighborhood !== undefined ? {neighborhood: input.neighborhood} : {}),
      ...(input.bio !== undefined ? {bio: input.bio} : {}),
      ...(input.preferences !== undefined ? {preferences: input.preferences as Prisma.InputJsonValue} : {}),
    },
  });
  response.json({profile: serializeProfile(profile)});
}));

function serializeProfile(profile: {
  id: string; displayName: string; age: number | null; role: string | null; city: City;
  neighborhood: string | null; bio: string; preferences: Prisma.JsonValue;
} | null) {
  if (!profile) throw new HttpError(500, 'PROFILE_NOT_FOUND', 'The account profile could not be loaded.');
  const parsedPreferences = profile.preferences
    ? (profile.preferences as unknown as LifestylePreferences)
    : DEFAULT_PREFERENCES;
  return {
    id: profile.id,
    displayName: profile.displayName,
    age: profile.age,
    role: profile.role,
    cityId: cityFromDb[profile.city],
    neighborhood: profile.neighborhood,
    bio: profile.bio,
    preferences: parsedPreferences,
  };
}
