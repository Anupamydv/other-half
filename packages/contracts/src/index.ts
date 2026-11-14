import {z} from 'zod';

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  checks: z.object({database: z.enum(['ok', 'unavailable'])}),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const cityIdSchema = z.enum(['bengaluru', 'mumbai', 'delhi', 'hyderabad']);

export const lifestylePreferencesSchema = z.object({
  sleep: z.enum(['Early Bird', 'Balanced', 'Night Owl']),
  kitchen: z.enum(['Pure Veg', 'Eggetarian', 'Non-Veg Friendly']),
  work: z.enum(['WFH Mostly', 'Hybrid', 'Office Daily']),
  cleanliness: z.enum(['Neat Freak', 'Tidy', 'Relaxed']),
  social: z.enum(['Quiet Sanctuary', 'Balanced', 'Social Host']),
  maxBudget: z.number().int().min(0).max(1_000_000),
  petFriendly: z.boolean(),
  nonSmoker: z.boolean(),
});

export const registerInputSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(2).max(80),
  cityId: cityIdSchema,
});

export const loginInputSchema = z.object({
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(1).max(128),
});

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
}).refine((value) => value.currentPassword !== value.newPassword, {
  path: ['newPassword'],
  message: 'Choose a password different from your current one.',
});

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  age: z.number().int().min(18).max(100).nullable().optional(),
  role: z.string().trim().max(100).nullable().optional(),
  cityId: cityIdSchema.optional(),
  neighborhood: z.string().trim().max(100).nullable().optional(),
  bio: z.string().trim().max(500).optional(),
  preferences: lifestylePreferencesSchema.optional(),
  discoveryEnabled: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'Provide at least one profile field.');

export type LifestylePreferences = z.infer<typeof lifestylePreferencesSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

export const listingTypeSchema = z.enum(['PRIVATE_ROOM', 'SHARED_ROOM', 'ENTIRE_FLAT']);
export const listingAmenitySchema = z.enum([
  'FURNISHED', 'WIFI', 'AIR_CONDITIONING', 'LAUNDRY', 'PARKING', 'PET_FRIENDLY', 'VEGETARIAN_HOUSEHOLD',
]);

const futureOrCurrentDate = z.iso.date().refine(
  (date) => date >= new Date().toISOString().slice(0, 10),
  'Availability date cannot be in the past.',
);

export const listingCreateSchema = z.object({
  title: z.string().trim().min(6).max(120),
  description: z.string().trim().min(30).max(2000),
  cityId: cityIdSchema,
  neighborhood: z.string().trim().min(2).max(100),
  listingType: listingTypeSchema,
  monthlyRent: z.number().int().min(1_000).max(2_000_000),
  deposit: z.number().int().min(0).max(10_000_000).nullable(),
  availableFrom: futureOrCurrentDate,
  minimumStay: z.number().int().min(1).max(36),
  amenities: z.array(listingAmenitySchema).max(7)
    .refine((amenities) => new Set(amenities).size === amenities.length, 'Remove duplicate amenities.'),
});

export const listingUpdateSchema = listingCreateSchema.partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one listing field.');

export const listingQuerySchema = z.object({
  cityId: cityIdSchema.optional(),
  neighborhood: z.string().trim().min(2).max(100).optional(),
  maxRent: z.coerce.number().int().min(1_000).max(2_000_000).optional(),
  listingType: listingTypeSchema.optional(),
  availableBy: z.iso.date().optional(),
  amenities: z.preprocess(
    (value) => typeof value === 'string' ? value.split(',') : value,
    z.array(listingAmenitySchema).max(7).optional(),
  ),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(64).optional(),
});

export const listingStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);
export const myListingQuerySchema = z.object({
  status: listingStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(64).optional(),
});
export const savedListingQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(64).optional(),
});
export const listingDtoSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  description: z.string(),
  cityId: cityIdSchema,
  neighborhood: z.string(),
  listingType: listingTypeSchema,
  monthlyRent: z.number().int(),
  deposit: z.number().int().nullable(),
  availableFrom: z.iso.date(),
  minimumStay: z.number().int(),
  amenities: z.array(listingAmenitySchema),
  status: listingStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  ownerDisplayName: z.string(),
  savedByMe: z.boolean(),
});
export const listingPageSchema = z.object({items: z.array(listingDtoSchema), nextCursor: z.string().nullable()});

export type ListingType = z.infer<typeof listingTypeSchema>;
export type ListingAmenity = z.infer<typeof listingAmenitySchema>;
export type ListingInput = z.infer<typeof listingCreateSchema>;
export type ListingUpdate = z.infer<typeof listingUpdateSchema>;
export type ListingDto = z.infer<typeof listingDtoSchema>;

export const tourTimeSlotSchema = z.enum(['MORNING', 'AFTERNOON', 'EVENING']);
export const tourRequestStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'DECLINED', 'CANCELLED']);
export type TourTimeSlot = z.infer<typeof tourTimeSlotSchema>;

export function isTourSlotAvailable(date: string, timeSlot: TourTimeSlot, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const todayInIndia = `${values.year}-${values.month}-${values.day}`;
  if (date > todayInIndia) return true;
  if (date < todayInIndia) return false;
  const startHour = {MORNING: 9, AFTERNOON: 12, EVENING: 16}[timeSlot];
  return Number(values.hour) < startHour;
}

export const createTourRequestSchema = z.object({
  scheduledDate: futureOrCurrentDate,
  timeSlot: tourTimeSlotSchema,
  note: z.string().trim().max(500).default(''),
}).superRefine((request, context) => {
  if (!isTourSlotAvailable(request.scheduledDate, request.timeSlot)) {
    context.addIssue({code: 'custom', path: ['timeSlot'], message: 'Choose a visit window that has not started yet.'});
  }
});
export const tourDecisionSchema = z.object({decision: z.enum(['CONFIRM', 'DECLINE'])});
export const tourRequestQuerySchema = z.object({
  direction: z.enum(['incoming', 'outgoing']).default('outgoing'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(64).optional(),
});
export const tourRequestDtoSchema = z.object({
  id: z.string(),
  listingId: z.string(),
  listingTitle: z.string(),
  cityId: cityIdSchema,
  neighborhood: z.string(),
  requesterId: z.string(),
  requesterDisplayName: z.string(),
  ownerId: z.string(),
  ownerDisplayName: z.string(),
  scheduledDate: z.iso.date(),
  timeSlot: tourTimeSlotSchema,
  note: z.string(),
  status: tourRequestStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const tourRequestPageSchema = z.object({items: z.array(tourRequestDtoSchema), nextCursor: z.string().nullable()});

export type TourRequestDto = z.infer<typeof tourRequestDtoSchema>;

export const sendMessageSchema = z.object({body: z.string().trim().min(1).max(2000)});
export const conversationMessageSchema = z.object({
  id: z.string(), conversationId: z.string(), senderId: z.string(), body: z.string(), createdAt: z.iso.datetime(),
});
export const conversationMessagePageSchema = z.object({items: z.array(conversationMessageSchema), nextCursor: z.string().nullable()});
export const conversationDtoSchema = z.object({
  id: z.string(), listingId: z.string().nullable(), listingTitle: z.string(), cityId: cityIdSchema, neighborhood: z.string(),
  peerId: z.string(), peerDisplayName: z.string(), lastMessage: conversationMessageSchema.nullable(),
  lastMessageAt: z.iso.datetime(), unread: z.boolean(), blockedByMe: z.boolean(), blockedByPeer: z.boolean(),
});
export const conversationPageSchema = z.object({items: z.array(conversationDtoSchema)});
export type ConversationDto = z.infer<typeof conversationDtoSchema>;
export type ConversationMessageDto = z.infer<typeof conversationMessageSchema>;

export const notificationTypeSchema = z.enum(['TOUR_REQUESTED', 'TOUR_CONFIRMED', 'TOUR_DECLINED', 'TOUR_CANCELLED']);
export const notificationDtoSchema = z.object({
  id: z.string(), type: notificationTypeSchema, title: z.string(), body: z.string(),
  tourRequestId: z.string(), createdAt: z.iso.datetime(), readAt: z.iso.datetime().nullable(),
});
export const notificationListSchema = z.object({items: z.array(notificationDtoSchema), unreadCount: z.number().int().nonnegative()});
export type NotificationDto = z.infer<typeof notificationDtoSchema>;

export const discoveryActionTypeSchema = z.enum(['PASS', 'LIKE', 'SUPER_LIKE']);
export const discoveryQuerySchema = z.object({
  cityId: cityIdSchema,
  limit: z.coerce.number().int().min(1).max(30).default(15),
  cursor: z.string().min(1).max(64).optional(),
});
export const discoveryActionSchema = z.object({
  targetUserId: z.string().trim().min(1).max(64),
  action: discoveryActionTypeSchema,
});
export const publicProfileSchema = z.object({
  id: z.string(), displayName: z.string(), age: z.number().int().nullable(), role: z.string().nullable(),
  cityId: cityIdSchema, neighborhood: z.string().nullable(), bio: z.string(), preferences: lifestylePreferencesSchema,
});
export const discoveryPageSchema = z.object({
  items: z.array(publicProfileSchema), nextCursor: z.string().nullable(), discoveryEnabled: z.boolean(),
});
export const matchDtoSchema = z.object({
  id: z.string(), conversationId: z.string(), createdAt: z.iso.datetime(), profile: publicProfileSchema,
});
export const matchPageSchema = z.object({items: z.array(matchDtoSchema)});
export const discoveryActionResponseSchema = z.object({
  action: discoveryActionTypeSchema, matched: z.boolean(), conversationId: z.string().nullable(),
});
export type PublicProfileDto = z.infer<typeof publicProfileSchema>;
export type MatchDto = z.infer<typeof matchDtoSchema>;

export const reportReasonSchema = z.enum(['HARASSMENT', 'SCAM', 'INAPPROPRIATE', 'FAKE_PROFILE', 'OTHER']);
export const reportStatusSchema = z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED']);
export const createReportSchema = z.object({reason: reportReasonSchema, details: z.string().trim().max(1000).default('')});
export const updateReportStatusSchema = z.object({status: z.enum(['IN_REVIEW', 'RESOLVED', 'DISMISSED'])});
export const userReportDtoSchema = z.object({
  id: z.string(), reportedUserId: z.string(), reportedDisplayName: z.string(), reason: reportReasonSchema,
  details: z.string(), status: reportStatusSchema, createdAt: z.iso.datetime(), reviewedAt: z.iso.datetime().nullable(),
});
export const moderationReportDtoSchema = userReportDtoSchema.extend({
  reporterId: z.string(), reporterDisplayName: z.string(),
});
export const reportListSchema = z.object({items: z.array(moderationReportDtoSchema)});
export const myReportsSchema = z.object({items: z.array(userReportDtoSchema)});
export const blockedUserSchema = z.object({userId: z.string(), displayName: z.string(), cityId: cityIdSchema, blockedAt: z.iso.datetime()});
export const blockedUsersSchema = z.object({items: z.array(blockedUserSchema)});
export type UserReportDto = z.infer<typeof userReportDtoSchema>;
export type ModerationReportDto = z.infer<typeof moderationReportDtoSchema>;
export type BlockedUserDto = z.infer<typeof blockedUserSchema>;
