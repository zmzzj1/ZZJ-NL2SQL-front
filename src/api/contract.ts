/**
 * 前后端共享契约的 TypeScript 映射，字段名与
 * frontend/docs/P0-FB01-fullstack-collaboration-guide.md 第 4 节逐字一致。
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'SQL_NOT_ALLOWED'
  | 'SQL_EXECUTION_ERROR'
  | 'MODEL_NOT_CONFIGURED'
  | 'LLM_UPSTREAM_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  /** 仅前端使用：请求未到达后端（断网、后端关闭、代理失败）。 */
  | 'NETWORK_ERROR';

export interface HealthResponse {
  status: 'UP';
}

export interface GenerateSqlRequest {
  userInput: string;
  schemaContext: string;
  strategyName: 'default';
}

export interface StartEventData {
  requestId: string;
}

export interface DeltaEventData {
  text: string;
}

export interface CompleteEventData {
  requestId: string;
}

export interface ErrorEventData {
  code: ErrorCode;
  message: string;
  requestId: string;
}

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  requestId: string;
}

/** rows 中每个对象按 columns 顺序写入，值类型来自 JSON。 */
export type QueryCell = string | number | boolean | null;

export interface ExecutionResult {
  columns: string[];
  rows: Record<string, QueryCell>[];
  rowCount: number;
  truncated: boolean;
}
