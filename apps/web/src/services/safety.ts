import {
  blockedUsersSchema,
  myReportsSchema,
  moderationReportDtoSchema,
  reportListSchema,
  userReportDtoSchema,
  type ModerationReportDto,
  type UserReportDto,
} from '@other-half/contracts';
import {apiRequest} from './api';

export async function getBlockedMembers(signal?: AbortSignal) {
  const parsed = blockedUsersSchema.safeParse(await apiRequest<unknown>('/blocks', {signal}));
  if (!parsed.success) throw new Error('The safety service returned an invalid block list.');
  return parsed.data.items;
}
export async function blockMember(userId: string) {
  await apiRequest<void>(`/users/${encodeURIComponent(userId)}/block`, {method: 'PUT'});
}
export async function unblockMember(userId: string) {
  await apiRequest<void>(`/blocks/${encodeURIComponent(userId)}`, {method: 'DELETE'});
}
export async function reportMember(userId: string, input: {reason: string; details: string}): Promise<UserReportDto> {
  const payload = await apiRequest<unknown>(`/users/${encodeURIComponent(userId)}/reports`, {method: 'POST', body: JSON.stringify(input)});
  const parsed = userReportDtoSchema.safeParse((payload as {item?: unknown} | null)?.item);
  if (!parsed.success) throw new Error('The safety service returned an invalid report.');
  return parsed.data;
}
export async function getMyReports(signal?: AbortSignal) {
  const parsed = myReportsSchema.safeParse(await apiRequest<unknown>('/reports/mine', {signal}));
  if (!parsed.success) throw new Error('The safety service returned an invalid report list.');
  return parsed.data.items;
}
export async function getModerationReports(signal?: AbortSignal): Promise<ModerationReportDto[]> {
  const parsed = reportListSchema.safeParse(await apiRequest<unknown>('/moderation/reports', {signal}));
  if (!parsed.success) throw new Error('The moderation service returned an invalid queue.');
  return parsed.data.items;
}
export async function updateReportStatus(id: string, status: 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED') {
  const payload = await apiRequest<unknown>(`/moderation/reports/${encodeURIComponent(id)}`, {method: 'PATCH', body: JSON.stringify({status})});
  const parsed = moderationReportDtoSchema.safeParse((payload as {item?: unknown} | null)?.item);
  if (!parsed.success) throw new Error('The moderation service returned an invalid report.');
  return parsed.data;
}
