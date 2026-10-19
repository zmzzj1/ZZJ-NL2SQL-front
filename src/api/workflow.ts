import type { Workflow, WorkflowRequest, WorkflowRun } from './contract';
import { API_BASE, ApiError, csrfHeaders, notifyUnauthorized, requestJson, toApiError } from './http';
import { createSseParser } from './sse';

export type WorkflowEventHandler = (event: string, data: Record<string, unknown>) => void;

export async function listWorkflows(): Promise<Workflow[]> {
  return requestJson<Workflow[]>('/v1/workflows');
}

export async function createWorkflow(body: WorkflowRequest): Promise<Workflow> {
  return requestJson<Workflow>('/v1/workflows', { method: 'POST', body: JSON.stringify(body) });
}

export async function fetchWorkflow(id: number): Promise<Workflow> {
  return requestJson<Workflow>(`/v1/workflows/${id}`);
}

export async function updateWorkflow(id: number, revision: number, body: WorkflowRequest): Promise<Workflow> {
  return requestJson<Workflow>(`/v1/workflows/${id}?revision=${revision}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteWorkflow(id: number): Promise<void> {
  await requestJson<void>(`/v1/workflows/${id}`, { method: 'DELETE' });
}

export async function streamRunWorkflow(
  id: number,
  body: { connectionId: number; conversationId?: number | null; userInput: string },
  onEvent: WorkflowEventHandler,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE}/v1/workflows/${id}/runs/stream`, {
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
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const frame of parser.push(decoder.decode(value, { stream: true }))) {
        onEvent(frame.event, JSON.parse(frame.data) as Record<string, unknown>);
      }
    }
    for (const frame of [...parser.push(decoder.decode()), ...parser.flush()]) {
      onEvent(frame.event, JSON.parse(frame.data) as Record<string, unknown>);
    }
  } finally {
    reader.releaseLock();
  }
}

export async function approveWorkflowNode(runId: number, nodeId: string): Promise<Response> {
  return fetch(`${API_BASE}/v1/workflows/runs/${runId}/nodes/${nodeId}/approve/stream`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      ...(await csrfHeaders()),
    },
  });
}

export async function fetchWorkflowRun(runId: number): Promise<WorkflowRun> {
  return requestJson<WorkflowRun>(`/v1/workflows/runs/${runId}`);
}

export async function cancelWorkflowRun(runId: number): Promise<void> {
  await requestJson<void>(`/v1/workflows/runs/${runId}/cancel`, { method: 'POST' });
}
