import {healthResponseSchema} from '@other-half/contracts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export async function getApiHealth(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/health`, {signal});
  const payload: unknown = await response.json();
  const parsed = healthResponseSchema.safeParse(payload);

  if (!parsed.success) throw new Error('The API returned an invalid health response.');
  return {httpOk: response.ok, ...parsed.data};
}
