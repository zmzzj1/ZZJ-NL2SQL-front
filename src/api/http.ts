import type { ApiErrorBody, CsrfResponse, ErrorCode } from './contract';

/** 所有请求共用同一前缀，开发期由 Vite 代理到后端 8080。 */
export const API_BASE = '/api';

let csrfToken: string | null = null;
let csrfHeaderName = 'X-XSRF-TOKEN';

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

/** 获取/刷新 CSRF Token；Cookie 由服务端写入，Token 只保存在内存。 */
export async function ensureCsrfToken(force = false): Promise<string> {
  if (csrfToken && !force) return csrfToken;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/v1/auth/csrf`, { headers: { Accept: 'application/json' } });
  } catch (error) {
    throw normalizeNetworkError(error);
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  const payload = (await response.json()) as CsrfResponse;
  csrfToken = payload.token;
  csrfHeaderName = payload.headerName || csrfHeaderName;
  return csrfToken;
}

/** 非安全方法与 SSE 请求共用的 CSRF 请求头。 */
export async function csrfHeaders(): Promise<Record<string, string>> {
  return { [csrfHeaderName]: await ensureCsrfToken() };
}

/**
 * 统一 JSON 请求：附带 CSRF、401 广播、403 单次重试与契约错误解析。
 * 仅在 `api/` 内的接口模块使用，页面和功能组件不直接调用。
 */
export async function requestJson<T>(path: string, init: RequestInit = {}, retryOnForbidden = true): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body) {
    headers['Content-Type'] = 'application/json';
  }
  if (method !== 'GET' && method !== 'HEAD') {
    Object.assign(headers, await csrfHeaders());
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, method, headers });
  } catch (error) {
    throw normalizeNetworkError(error);
  }

  if (response.status === 401) {
    notifyUnauthorized();
    throw await toApiError(response);
  }
  if (response.status === 403 && method !== 'GET' && retryOnForbidden) {
    await ensureCsrfToken(true);
    return requestJson<T>(path, init, false);
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** 把非 2xx 响应转换为带契约错误码的 ApiError。 */
export async function toApiError(response: Response): Promise<ApiError> {
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

/** 会话失效时广播，由 App 统一退回登录页。 */
export function notifyUnauthorized() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('qf:unauthorized'));
  }
}

/** 把 fetch 抛出的 TypeError 归一为 NETWORK_ERROR；取消信号保持原样。 */
export function normalizeNetworkError(error: unknown): unknown {
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
    switch (error.code) {
      case 'MODEL_NOT_CONFIGURED':
        return '后端未配置模型密钥，SQL 生成不可用；可继续使用执行功能验证当前数据源。';
      case 'NETWORK_ERROR':
        return '无法连接后端服务，请确认已启动 Spring Boot（默认 8080 端口）后重试。';
      case 'UNAUTHENTICATED':
        return error.message;
      case 'CONNECTION_NOT_FOUND':
        return '数据源不存在或无权访问，请刷新连接列表。';
      case 'CONNECTION_FAILED':
        return '无法连接该数据源，请检查主机、端口、账号与密码。';
      default:
        return error.message;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return '发生未知错误';
}
