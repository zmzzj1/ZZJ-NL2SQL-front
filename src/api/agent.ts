import type { AgentRun, AgentStep } from './contract';
import { API_BASE, ApiError, csrfHeaders, notifyUnauthorized, requestJson, toApiError } from './http';
import { createSseParser } from './sse';

export type AgentEventPayload = Record<string, unknown>;
export type AgentEventHandler = (event: string, data: AgentEventPayload) => void;

interface StreamHandlers {
  onEvent: AgentEventHandler;
}

async function stream(path: string, body: unknown, handlers: StreamHandlers, signal: AbortSignal) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(await csrfHeaders()),
    },
    body: JSON.stringify(body),
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
      throw new ApiError('LLM_UPSTREAM_ERROR', '收到无法解析的 Agent 事件');
    }
    if (payload && typeof payload === 'object') {
      handlers.onEvent(event, payload as AgentEventPayload);
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

export function streamAgentRun(
  request: { conversationId: number; connectionId: number; userInput: string },
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  return stream('/v1/agent/runs/stream', request, handlers, signal);
}

export function approveAgentStep(
  runId: number,
  stepId: number,
  sqlVersion: number,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  return stream(
    `/v1/agent/runs/${runId}/steps/${stepId}/approve/stream`,
    { sqlVersion, confirm: true, clientRequestId: `web-${Date.now()}` },
    handlers,
    signal,
  );
}

export async function rejectAgentStep(runId: number, stepId: number): Promise<void> {
  await requestJson<void>(`/v1/agent/runs/${runId}/steps/${stepId}/reject`, { method: 'POST' });
}

export async function cancelAgentRun(runId: number): Promise<void> {
  await requestJson<void>(`/v1/agent/runs/${runId}/cancel`, { method: 'POST' });
}

export async function fetchAgentRun(runId: number): Promise<AgentRun> {
  return requestJson<AgentRun>(`/v1/agent/runs/${runId}`);
}

/** 没有运行记录时后端返回 204，这里归一为 null。 */
export async function fetchLatestAgentRun(conversationId: number): Promise<AgentRun | null> {
  const run = await requestJson<AgentRun | null>(`/v1/agent/runs/latest?conversationId=${conversationId}`);
  return run ?? null;
}

export type { AgentRun, AgentStep };
