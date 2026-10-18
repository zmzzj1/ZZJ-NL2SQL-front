/**
 * 前后端共享契约的 TypeScript 映射，字段名与
 * frontend/docs/P2-FB02-fullstack-development-guide.md 第 4 节一致。
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'DUPLICATE_EMAIL'
  | 'CONNECTION_NOT_FOUND'
  | 'CONNECTION_FAILED'
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

export interface User {
  id: number;
  email: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  displayName: string;
  password: string;
}

export interface CsrfResponse {
  token: string;
  headerName: string;
}

export type ConnectionEngine = 'mysql';

export interface Connection {
  id: number;
  name: string;
  engine: ConnectionEngine;
  host: string;
  port: number;
  database: string;
  username: string;
  hasPassword: boolean;
}

export interface ConnectionInput {
  name: string;
  engine: ConnectionEngine;
  host: string;
  port: number;
  database: string;
  username: string;
  /** 修改时留空表示沿用原密码。 */
  password?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
}

export interface SchemaResponse {
  database: string;
  tables: SchemaTable[];
}

export interface GenerateSqlRequest {
  userInput: string;
  connectionId: number;
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
