import {
  discoveryActionResponseSchema,
  discoveryPageSchema,
  matchPageSchema,
  type MatchDto,
  type PublicProfileDto,
} from '@other-half/contracts';
import {apiRequest} from './api';

function parsePage(payload: unknown) {
  const result = discoveryPageSchema.safeParse(payload);
  if (!result.success) throw new Error('The discovery service returned an invalid response.');
  return result.data;
}
export async function getDiscoveryProfiles(cityId: string, cursor?: string, signal?: AbortSignal) {
  const query = new URLSearchParams({cityId});
  if (cursor) query.set('cursor', cursor);
  return parsePage(await apiRequest<unknown>(`/discovery/profiles?${query}`, {signal}));
}
export async function sendDiscoveryAction(targetUserId: string, action: 'PASS' | 'LIKE' | 'SUPER_LIKE') {
  const payload = await apiRequest<unknown>('/discovery/actions', {method: 'POST', body: JSON.stringify({targetUserId, action})});
  const result = discoveryActionResponseSchema.safeParse(payload);
  if (!result.success) throw new Error('The discovery service returned an invalid response.');
  return result.data;
}
export async function getMatches(signal?: AbortSignal): Promise<MatchDto[]> {
  const payload = await apiRequest<unknown>('/matches', {signal});
  const result = matchPageSchema.safeParse(payload);
  if (!result.success) throw new Error('The matching service returned an invalid response.');
  return result.data.items;
}
export async function openMatchConversation(matchId: string) {
  const result = await apiRequest<{id: string}>(`/matches/${encodeURIComponent(matchId)}/conversation`, {method: 'POST'});
  if (typeof result.id !== 'string') throw new Error('The conversation service returned an invalid response.');
  return result.id;
}
export type {PublicProfileDto};
