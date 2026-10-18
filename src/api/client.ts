import { createSseParser } from './sse';
import type {
  ApiErrorBody,
  CompleteEventData,
  DeltaEventData,
  ErrorCode,
  ErrorEventData,
  ExecutionResult,
  GenerateSqlRequest,
  HealthResponse,
  StartEventData,
} from './contract';

const API_BASE = '/api';

/** 前端可判定的 API 错误：携带契约 code、HTTP 状态与追踪 ID。 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly requestId?: string;

  constructor(code: ErrorCode, message: string, status = 0, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export interface StreamHandlers {
  onStart?: (requestId: string) => void;
  onDelta: (text: string) => void;
  onComplete?: (requestId: string) => void;
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE}/health`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new ApiError('SERVICE_UNAVAILABLE', '后端健康检查失败', response.status);
  }
  return (await response.json()) as HealthResponse;
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
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/v1/sql/generate/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    throw normalizeNetworkError(error);
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

export async function executeSql(sql: string, signal?: AbortSignal): Promise<ExecutionResult> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/v1/sql/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
      signal,
    });
  } catch (error) {
    throw normalizeNetworkError(error);
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  const result = (await response.json()) as ExecutionResult;
  if (!Array.isArray(result.columns) || !Array.isArray(result.rows)) {
    throw new ApiError('INTERNAL_ERROR', '后端返回的结果结构不符合契约', response.status);
  }
  return result;
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> = {};
  try {
    body = (await response.json()) as Partial<ApiErrorBody>;
  } catch {
    // 后端不可达时可能是空响应；保留状态码与兜底文案。
  }
  if (!body.code && response.status >= 500) {
    // 开发代理在后端未启动时返回空 5xx，这属于连接失败而不是业务错误。
    return new ApiError('NETWORK_ERROR', '无法连接后端服务，请确认后端已启动', response.status);
  }
  const code = (body.code ?? 'SERVICE_UNAVAILABLE') as ErrorCode;
  return new ApiError(code, body.message ?? '请求失败，请稍后重试', response.status, body.requestId);
}

function normalizeNetworkError(error: unknown): unknown {
  if (error instanceof ApiError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') return error;
  if (error instanceof TypeError) {
    return new ApiError('NETWORK_ERROR', '无法连接后端服务，请确认后端已启动');
  }
  return error;
}

/** 把错误转成用户可读文案；后端 message 已是中文，优先使用。 */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'MODEL_NOT_CONFIGURED') {
      return '后端未配置模型密钥，SQL 生成不可用；可继续使用执行功能验证演示库查询。';
    }
    if (error.code === 'NETWORK_ERROR') {
      return '无法连接后端服务，请确认已启动 Spring Boot（默认 8080 端口）后重试。';
    }
    return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return '发生未知错误';
}
