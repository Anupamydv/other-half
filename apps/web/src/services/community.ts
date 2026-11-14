import {
  communityPostCreateSchema,
  communityPostDtoSchema,
  communityPostPageSchema,
  type CommunityPostDto,
  type CommunityPostInput,
} from '@other-half/contracts';
import {apiRequest} from './api';

function parseItem(payload: unknown) {
  const parsed = communityPostDtoSchema.safeParse((payload as {item?: unknown} | null)?.item);
  if (!parsed.success) throw new Error('The community service returned an invalid post.');
  return parsed.data;
}

export async function getCommunityPosts(filters: {cityId: string; neighborhood?: string; cursor?: string; savedOnly?: boolean}, signal?: AbortSignal) {
  const query = new URLSearchParams({cityId: filters.cityId});
  if (filters.neighborhood) query.set('neighborhood', filters.neighborhood);
  if (filters.savedOnly) query.set('savedOnly', 'true');
  if (filters.cursor) query.set('cursor', filters.cursor);
  const result = communityPostPageSchema.safeParse(await apiRequest<unknown>(`/community/posts?${query}`, {signal}));
  if (!result.success) throw new Error('The community service returned an invalid feed.');
  return result.data;
}

export async function createCommunityPost(input: CommunityPostInput): Promise<CommunityPostDto> {
  const checked = communityPostCreateSchema.safeParse(input);
  if (!checked.success) throw new Error(checked.error.issues[0]?.message ?? 'Review your post details.');
  return parseItem(await apiRequest<unknown>('/community/posts', {method: 'POST', body: JSON.stringify(checked.data)}));
}

export async function setCommunityPostLike(postId: string, liked: boolean) {
  await apiRequest<void>(`/community/posts/${encodeURIComponent(postId)}/like`, {method: liked ? 'PUT' : 'DELETE'});
}

export async function setCommunityPostSaved(postId: string, saved: boolean) {
  await apiRequest<void>(`/community/posts/${encodeURIComponent(postId)}/save`, {method: saved ? 'PUT' : 'DELETE'});
}

export async function getCommunityComments(postId: string, cursor?: string, signal?: AbortSignal) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const response = await apiRequest<{items: CommunityPostDto['comments']; nextCursor: string | null}>(`/community/posts/${encodeURIComponent(postId)}/comments${query}`, {signal});
  return response;
}

export async function createCommunityComment(postId: string, body: string) {
  const response = await apiRequest<{item: CommunityPostDto['comments'][number]}>(`/community/posts/${encodeURIComponent(postId)}/comments`, {
    method: 'POST', body: JSON.stringify({body}),
  });
  return response.item;
}

export async function removeCommunityPost(postId: string) {
  await apiRequest<void>(`/community/posts/${encodeURIComponent(postId)}`, {method: 'DELETE'});
}
