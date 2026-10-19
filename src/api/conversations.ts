import type { ConversationDetail, ConversationSummary, CreateConversationRequest, PageResponse } from './contract';
import { requestJson } from './http';

export async function createConversation(input: CreateConversationRequest): Promise<ConversationSummary> {
  return requestJson<ConversationSummary>('/v1/conversations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listConversations(
  limit = 20,
  cursor?: string | null,
): Promise<PageResponse<ConversationSummary>> {
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  return requestJson<PageResponse<ConversationSummary>>(`/v1/conversations?${query.toString()}`);
}

export async function fetchConversation(id: number): Promise<ConversationDetail> {
  return requestJson<ConversationDetail>(`/v1/conversations/${id}`);
}

export async function deleteConversation(id: number): Promise<void> {
  await requestJson<void>(`/v1/conversations/${id}`, { method: 'DELETE' });
}
