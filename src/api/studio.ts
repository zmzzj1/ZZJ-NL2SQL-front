import type { Agent, AgentInput, AgentVersion } from './contract';
import { API_BASE, ApiError, csrfHeaders, notifyUnauthorized, requestJson, toApiError } from './http';
import { createSseParser } from './sse';

export type StudioEventPayload = Record<string, unknown>;
export type StudioEventHandler = (event: string, data: StudioEventPayload) => void;

export async function listAgents(status?: string): Promise<Agent[]> {
  const query = status ? `?status=${status}` : '';
  return requestJson<Agent[]>(`/v1/studio/agents${query}`);
}

export async function createAgent(input: AgentInput): Promise<Agent> {
  return requestJson<Agent>('/v1/studio/agents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getAgent(id: number): Promise<Agent> {
  return requestJson<Agent>(`/v1/studio/agents/${id}`);
}

export async function updateAgent(id: number, expectedRevision: number, input: AgentInput): Promise<Agent> {
  return requestJson<Agent>(`/v1/studio/agents/${id}?expectedRevision=${expectedRevision}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function archiveAgent(id: number): Promise<void> {
  await requestJson<void>(`/v1/studio/agents/${id}`, { method: 'DELETE' });
}

export async function listAgentVersions(id: number): Promise<AgentVersion[]> {
  return requestJson<AgentVersion[]>(`/v1/studio/agents/${id}/versions`);
}

export async function publishAgent(id: number, expectedRevision: number, versionNote?: string): Promise<AgentVersion> {
  return requestJson<AgentVersion>(`/v1/studio/agents/${id}/publish?expectedRevision=${expectedRevision}`, {
    method: 'POST',
    body: JSON.stringify({ versionNote: versionNote ?? '' }),
  });
}

export async function rollbackAgent(
  id: number,
  sourceVersionId: number,
  expectedRevision: number,
): Promise<AgentVersion> {
  return requestJson<AgentVersion>(
    `/v1/studio/agents/${id}/rollback?sourceVersionId=${sourceVersionId}&expectedRevision=${expectedRevision}`,
    { method: 'POST' },
  );
}

/** Studio 测试运行：读取草稿快照，走真实 Agent Run/SSE（SQL 仍需人工审批）。 */
export async function testAgent(
  id: number,
  request: { conversationId: number; connectionId: number; userInput: string },
  onEvent: StudioEventHandler,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE}/v1/studio/agents/${id}/test/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(await csrfHeaders()),
    },
    body: JSON.stringify(request),
    signal,
  });
  if (response.status === 401) notifyUnauthorized();
  if (!response.ok) throw await toApiError(response);
  if (!response.body) {
    throw new ApiError('SERVICE_UNAVAILABLE', '浏览器未提供可读取的流式响应', response.status);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  const parser = createSseParser();
  const emit = (event: string, rawData: string) => {
    let payload: unknown;
    try {
      payload = JSON.parse(rawData);
    } catch {
      return;
    }
    if (payload && typeof payload === 'object') {
      onEvent(event, payload as StudioEventPayload);
    }
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
        emit(frame.event, frame.data);
      }
    }
    for (const frame of [...parser.push(decoder.decode()), ...parser.flush()]) {
      emit(frame.event, frame.data);
    }
  } finally {
    reader.releaseLock();
  }
}
