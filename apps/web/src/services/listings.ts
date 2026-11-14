import {
  listingDtoSchema,
  listingPageSchema,
  type ListingDto,
  type ListingAmenity,
  type ListingInput,
} from '@other-half/contracts';
import {apiRequest} from './api';

function parsePage(payload: unknown) {
  const result = listingPageSchema.safeParse(payload);
  if (!result.success) throw new Error('The listings service returned an invalid response.');
  return result.data;
}

function parseItem(payload: unknown) {
  const result = listingDtoSchema.safeParse((payload as {item?: unknown} | null)?.item);
  if (!result.success) throw new Error('The listings service returned an invalid response.');
  return result.data;
}

export async function getListings(filters: {
  cityId: string;
  neighborhood?: string;
  maxRent?: number;
  listingType?: ListingDto['listingType'];
  availableBy?: string;
  amenities?: ListingAmenity[];
  cursor?: string;
  limit?: number;
}, signal?: AbortSignal) {
  const query = new URLSearchParams({cityId: filters.cityId});
  if (filters.neighborhood) query.set('neighborhood', filters.neighborhood);
  if (filters.maxRent) query.set('maxRent', String(filters.maxRent));
  if (filters.listingType) query.set('listingType', filters.listingType);
  if (filters.availableBy) query.set('availableBy', filters.availableBy);
  if (filters.amenities?.length) query.set('amenities', filters.amenities.join(','));
  if (filters.cursor) query.set('cursor', filters.cursor);
  if (filters.limit) query.set('limit', String(filters.limit));
  return parsePage(await apiRequest<unknown>(`/listings?${query}`, {signal}));
}

export async function getMyListings(filters: {
  status?: 'ACTIVE' | 'ARCHIVED';
  cursor?: string;
}, signal?: AbortSignal) {
  const query = new URLSearchParams();
  if (filters.status) query.set('status', filters.status);
  if (filters.cursor) query.set('cursor', filters.cursor);
  const suffix = query.size ? `?${query}` : '';
  return parsePage(await apiRequest<unknown>(`/listings/mine${suffix}`, {signal}));
}

export async function getSavedListings(filters: {cursor?: string}, signal?: AbortSignal) {
  const query = new URLSearchParams();
  if (filters.cursor) query.set('cursor', filters.cursor);
  const suffix = query.size ? `?${query}` : '';
  return parsePage(await apiRequest<unknown>(`/listings/saved${suffix}`, {signal}));
}

export async function createListing(input: ListingInput) {
  return parseItem(await apiRequest<unknown>('/listings', {method: 'POST', body: JSON.stringify(input)}));
}

export async function updateListing(id: string, input: ListingInput) {
  return parseItem(await apiRequest<unknown>(`/listings/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(input),
  }));
}

export async function archiveListing(id: string) {
  await apiRequest<void>(`/listings/${encodeURIComponent(id)}/archive`, {method: 'POST'});
}

export async function saveListing(id: string) {
  await apiRequest<void>(`/listings/${encodeURIComponent(id)}/save`, {method: 'PUT'});
}

export async function unsaveListing(id: string) {
  await apiRequest<void>(`/listings/${encodeURIComponent(id)}/save`, {method: 'DELETE'});
}

export async function uploadListingPhoto(listingId: string, file: File, altText = '') {
  const intent = await apiRequest<{mediaId: string; uploadUrl: string; expiresInSeconds: number}>(
    `/listings/${encodeURIComponent(listingId)}/media/uploads`,
    {method: 'POST', body: JSON.stringify({contentType: file.type, byteSize: file.size, altText})},
  );
  try {
    const result = await fetch(intent.uploadUrl, {method: 'PUT', headers: {'Content-Type': file.type}, body: file});
    if (!result.ok) throw new Error('The photo could not be uploaded to storage. Check that MinIO is running and retry.');
    await apiRequest<void>(`/listings/${encodeURIComponent(listingId)}/media/${encodeURIComponent(intent.mediaId)}/complete`, {method: 'POST'});
  } catch (cause) {
    await apiRequest<void>(`/listings/${encodeURIComponent(listingId)}/media/${encodeURIComponent(intent.mediaId)}`, {method: 'DELETE'}).catch(() => undefined);
    throw cause;
  }
}

export async function deleteListingPhoto(listingId: string, mediaId: string) {
  await apiRequest<void>(`/listings/${encodeURIComponent(listingId)}/media/${encodeURIComponent(mediaId)}`, {method: 'DELETE'});
}
