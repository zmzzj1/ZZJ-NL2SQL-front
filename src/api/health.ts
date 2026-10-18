import type { HealthResponse } from './contract';
import { API_BASE, ApiError } from './http';

/** 顶栏连接状态探测；不走 requestJson，避免 401/CSRF 逻辑影响探活。 */
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
