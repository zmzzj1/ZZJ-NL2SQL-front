import type { KnowledgeEntry, KnowledgeEntryInput, KnowledgeSearchResponse, KnowledgeType } from './contract';
import { requestJson } from './http';

export async function listKnowledgeEntries(sourceType?: KnowledgeType): Promise<KnowledgeEntry[]> {
  const query = sourceType ? `?sourceType=${sourceType}` : '';
  return requestJson<KnowledgeEntry[]>(`/v1/knowledge/entries${query}`);
}

export async function createKnowledgeEntry(input: KnowledgeEntryInput): Promise<KnowledgeEntry> {
  return requestJson<KnowledgeEntry>('/v1/knowledge/entries', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateKnowledgeEntry(id: number, input: KnowledgeEntryInput): Promise<KnowledgeEntry> {
  return requestJson<KnowledgeEntry>(`/v1/knowledge/entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteKnowledgeEntry(id: number): Promise<void> {
  await requestJson<void>(`/v1/knowledge/entries/${id}`, { method: 'DELETE' });
}

export async function searchKnowledge(connectionId: number, query: string): Promise<KnowledgeSearchResponse> {
  return requestJson<KnowledgeSearchResponse>('/v1/knowledge/search', {
    method: 'POST',
    body: JSON.stringify({ connectionId, query }),
  });
}
