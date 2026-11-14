import {healthResponseSchema} from '@other-half/contracts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export interface AccountProfile {
  id: string;
  displayName: string;
  age: number | null;
  role: string | null;
  cityId: 'bengaluru' | 'mumbai' | 'delhi' | 'hyderabad';
  neighborhood: string | null;
  bio: string;
  preferences: {
    sleep: 'Early Bird' | 'Balanced' | 'Night Owl';
    kitchen: 'Pure Veg' | 'Eggetarian' | 'Non-Veg Friendly';
    work: 'WFH Mostly' | 'Hybrid' | 'Office Daily';
    cleanliness: 'Neat Freak' | 'Tidy' | 'Relaxed';
    social: 'Quiet Sanctuary' | 'Balanced' | 'Social Host';
    maxBudget: number;
    petFriendly: boolean;
    nonSmoker: boolean;
  };
}

export interface AccountResponse {
  user: {id: string; email: string};
  profile: AccountProfile;
}

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {'Content-Type': 'application/json', ...init.headers},
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null) as {error?: {message?: string}} | null;
  if (!response.ok) throw new ApiRequestError(body?.error?.message ?? 'The request could not be completed.', response.status);
  return body as T;
}

export async function getCurrentAccount(signal?: AbortSignal) {
  return apiRequest<AccountResponse>('/auth/me', {signal});
}

export async function getApiHealth(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/health`, {signal});
  const payload: unknown = await response.json();
  const parsed = healthResponseSchema.safeParse(payload);

  if (!parsed.success) throw new Error('The API returned an invalid health response.');
  return {httpOk: response.ok, ...parsed.data};
}
