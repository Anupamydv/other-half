import {conversationMessagePageSchema, conversationPageSchema, conversationMessageSchema, type ConversationDto, type ConversationMessageDto} from '@other-half/contracts';
import {apiRequest} from './api';

function parsePage(payload: unknown) {
  const result = conversationPageSchema.safeParse(payload);
  if (!result.success) throw new Error('The conversation service returned an invalid response.');
  return result.data.items;
}
function parseMessages(payload: unknown) {
  const result = conversationMessagePageSchema.safeParse(payload);
  if (!result.success) throw new Error('The message service returned an invalid response.');
  return result.data;
}
function parseMessage(payload: unknown): ConversationMessageDto {
  const result = conversationMessageSchema.safeParse((payload as {item?: unknown} | null)?.item);
  if (!result.success) throw new Error('The message service returned an invalid response.');
  return result.data;
}
export async function getConversations(signal?: AbortSignal): Promise<ConversationDto[]> {
  return parsePage(await apiRequest<unknown>('/conversations', {signal}));
}
export async function getMessages(id: string, cursor?: string, signal?: AbortSignal) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return parseMessages(await apiRequest<unknown>(`/conversations/${encodeURIComponent(id)}/messages${query}`, {signal}));
}
export async function startConversationForTour(tourId: string) {
  const result = await apiRequest<{id: string}>(`/tour-requests/${encodeURIComponent(tourId)}/conversation`, {method: 'POST'});
  return result.id;
}
export async function sendConversationMessage(id: string, body: string) {
  return parseMessage(await apiRequest<unknown>(`/conversations/${encodeURIComponent(id)}/messages`, {method: 'POST', body: JSON.stringify({body})}));
}
export async function markConversationRead(id: string, throughMessageId: string) {
  await apiRequest<void>(`/conversations/${encodeURIComponent(id)}/read`, {method: 'POST', body: JSON.stringify({throughMessageId})});
}
export async function setConversationBlocked(id: string, blocked: boolean) {
  await apiRequest<void>(`/conversations/${encodeURIComponent(id)}/block`, {method: blocked ? 'PUT' : 'DELETE'});
}
