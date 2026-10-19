import type { PageResponse, QueryHistoryItem } from './contract';
import { requestJson } from './http';

export interface QueryHistoryQuery {
  limit?: number;
  cursor?: string | null;
  connectionId?: number | null;
}

export async function listQueryHistory(query: QueryHistoryQuery = {}): Promise<PageResponse<QueryHistoryItem>> {
  const params = new URLSearchParams({ limit: String(query.limit ?? 20) });
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.connectionId != null) params.set('connectionId', String(query.connectionId));
  return requestJson<PageResponse<QueryHistoryItem>>(`/v1/query-history?${params.toString()}`);
}

export async function fetchQueryHistory(id: number): Promise<QueryHistoryItem> {
  return requestJson<QueryHistoryItem>(`/v1/query-history/${id}`);
}

export async function deleteQueryHistory(id: number): Promise<void> {
  await requestJson<void>(`/v1/query-history/${id}`, { method: 'DELETE' });
}
