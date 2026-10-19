import type {
  CompleteEventData,
  DeltaEventData,
  ErrorEventData,
  ExecutionResult,
  GenerateSqlRequest,
  StartEventData,
} from './contract';
import {
  API_BASE,
  ApiError,
  csrfHeaders,
  ensureCsrfToken,
  normalizeNetworkError,
  notifyUnauthorized,
  requestJson,
  toApiError,
} from './http';
import { createSseParser } from './sse';

export interface StreamHandlers {
  onStart?: (requestId: string) => void;
  onDelta: (text: string) => void;
  onComplete?: (requestId: string) => void;
}

/**
 * POST + ReadableStream 读取 SSE。原生 EventSource 不支持 POST，故不使用。
 * 抛出 AbortError 表示调用方主动取消，其余异常统一为 ApiError。
 */
export async function streamSqlGeneration(
  request: GenerateSqlRequest,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  const send = async () =>
    fetch(`${API_BASE}/v1/sql/generate/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(await csrfHeaders()),
      },
      body: JSON.stringify(request),
      signal,
    });

  let response: Response;
  try {
    response = await send();
    // CSRF Cookie 过期时强制刷新一次；其余 403 直接按错误处理。
    if (response.status === 403) {
      await ensureCsrfToken(true);
      response = await send();
    }
  } catch (error) {
    throw normalizeNetworkError(error);
  }

  if (response.status === 401) {
    notifyUnauthorized();
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  if (!response.body) {
    throw new ApiError('SERVICE_UNAVAILABLE', '浏览器未提供可读取的流式响应', response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  const parser = createSseParser();
  let completed = false;

  const handleFrame = (event: string, rawData: string) => {
    let payload: unknown;
    try {
      payload = JSON.parse(rawData);
    } catch {
      throw new ApiError('LLM_UPSTREAM_ERROR', '收到无法解析的流式数据');
    }

    if (event === 'start') {
      handlers.onStart?.((payload as StartEventData).requestId);
      return;
    }
    if (event === 'delta') {
      const text = (payload as DeltaEventData).text;
      if (typeof text === 'string' && text.length > 0) handlers.onDelta(text);
      return;
    }
    if (event === 'complete') {
      completed = true;
      handlers.onComplete?.((payload as CompleteEventData).requestId);
      return;
    }
    if (event === 'error') {
      const data = payload as ErrorEventData;
      throw new ApiError(data.code, data.message, response.status, data.requestId);
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const frame of parser.push(text)) {
        handleFrame(frame.event, frame.data);
      }
    }
    const tail = decoder.decode();
    for (const frame of [...parser.push(tail), ...parser.flush()]) {
      handleFrame(frame.event, frame.data);
    }
  } catch (error) {
    throw normalizeNetworkError(error);
  } finally {
    reader.releaseLock();
  }

  if (!completed) {
    throw new ApiError('LLM_UPSTREAM_ERROR', '流式连接在完成事件前中断');
  }
}

/** 取消生成：按 requestId 幂等收敛服务端消息状态，重复调用无副作用。 */
export async function cancelSqlGeneration(requestId: string): Promise<void> {
  await requestJson<void>(`/v1/sql/generate/${encodeURIComponent(requestId)}/cancel`, {
    method: 'POST',
  });
}

export async function executeSql(
  connectionId: number,
  sql: string,
  conversationId?: number | null,
  signal?: AbortSignal,
): Promise<ExecutionResult> {
  const result = await requestJson<ExecutionResult>('/v1/sql/execute', {
    method: 'POST',
    body: JSON.stringify({ connectionId, sql, conversationId: conversationId ?? null }),
    signal,
  });
  if (!Array.isArray(result.columns) || !Array.isArray(result.rows)) {
    throw new ApiError('INTERNAL_ERROR', '后端返回的结果结构不符合契约', 200);
  }
  return result;
}
