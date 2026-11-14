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
