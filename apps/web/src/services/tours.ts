import {
  tourRequestDtoSchema,
  tourRequestPageSchema,
  type TourRequestDto,
  type TourTimeSlot,
} from '@other-half/contracts';
import {apiRequest} from './api';

function parsePage(payload: unknown) {
  const result = tourRequestPageSchema.safeParse(payload);
  if (!result.success) throw new Error('The visit request service returned an invalid response.');
  return result.data;
}

function parseItem(payload: unknown): TourRequestDto {
  const result = tourRequestDtoSchema.safeParse((payload as {item?: unknown} | null)?.item);
  if (!result.success) throw new Error('The visit request service returned an invalid response.');
  return result.data;
}

export async function createTourRequest(listingId: string, input: {
  scheduledDate: string;
  timeSlot: TourTimeSlot;
  note: string;
}) {
  return parseItem(await apiRequest<unknown>(`/listings/${encodeURIComponent(listingId)}/tour-requests`, {
    method: 'POST', body: JSON.stringify(input),
  }));
}

export async function getTourRequests(direction: 'incoming' | 'outgoing', cursor?: string, signal?: AbortSignal) {
  const query = new URLSearchParams({direction});
  if (cursor) query.set('cursor', cursor);
  return parsePage(await apiRequest<unknown>(`/tour-requests?${query}`, {signal}));
}

export async function resolveTourRequest(id: string, decision: 'CONFIRM' | 'DECLINE') {
  return parseItem(await apiRequest<unknown>(`/tour-requests/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify({decision}),
  }));
}

export async function cancelTourRequest(id: string) {
  await apiRequest<void>(`/tour-requests/${encodeURIComponent(id)}/cancel`, {method: 'POST'});
}
