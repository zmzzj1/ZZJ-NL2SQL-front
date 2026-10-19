import type { AnalysisRun, CreateAnalysisRunRequest } from './contract';
import { API_BASE, ApiError, csrfHeaders, notifyUnauthorized, requestJson, toApiError } from './http';
import { createSseParser } from './sse';

export type AnalysisEventHandler = (event: string, data: Record<string, unknown>) => void;

/** 创建分析运行：SSE 流式返回 analysis.started/completed/failed。 */
export async function streamCreateAnalysisRun(
  body: CreateAnalysisRunRequest,
  onEvent: AnalysisEventHandler,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE}/v1/analysis/runs/stream`, {
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

export async function fetchAnalysisRun(id: number): Promise<AnalysisRun> {
  return requestJson<AnalysisRun>(`/v1/analysis/runs/${id}`);
}

export async function cancelAnalysisRun(id: number): Promise<void> {
  await requestJson<void>(`/v1/analysis/runs/${id}/cancel`, { method: 'POST' });
}
