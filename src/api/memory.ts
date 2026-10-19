import type { LongTermMemory, MemoryConfidence, MemoryScope, MemoryType } from './contract';
import { requestJson } from './http';

export async function listMemories(type?: MemoryType): Promise<LongTermMemory[]> {
  const query = type ? `?type=${type}` : '';
  return requestJson<LongTermMemory[]>(`/v1/memories${query}`);
}

export interface CreateMemoryInput {
  type: MemoryType;
  scope: MemoryScope;
  workspaceId?: number | null;
  title: string;
  content: string;
  sourceRef?: string;
  confidence?: MemoryConfidence;
}

export async function createMemory(input: CreateMemoryInput): Promise<LongTermMemory> {
  return requestJson<LongTermMemory>('/v1/memories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateMemory(
  id: number,
  title: string,
  content: string,
  confidence?: MemoryConfidence,
): Promise<LongTermMemory> {
  return requestJson<LongTermMemory>(`/v1/memories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title, content, confidence }),
  });
}

export async function disableMemory(id: number): Promise<void> {
  await requestJson<void>(`/v1/memories/${id}/disable`, { method: 'POST' });
}

export async function deleteMemory(id: number): Promise<void> {
  await requestJson<void>(`/v1/memories/${id}`, { method: 'DELETE' });
}

export async function searchMemories(
  query: string,
  scope: MemoryScope,
  workspaceId?: number,
): Promise<LongTermMemory[]> {
  const body = { query, scope, workspaceId };
  const result = await requestJson<{ items: LongTermMemory[] }>('/v1/memories/search', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return result.items;
}
