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
