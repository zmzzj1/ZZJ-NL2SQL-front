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
  | 'CONVERSATION_NOT_FOUND'
  | 'HISTORY_NOT_FOUND'
  | 'AGENT_RUN_NOT_FOUND'
  | 'AGENT_STEP_NOT_FOUND'
  | 'AGENT_STATE_CONFLICT'
  | 'AGENT_PLAN_INVALID'
  | 'AGENT_STEP_FAILED'
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
  /** 可选：绑定到已授权的会话。 */
  conversationId?: number | null;
  strategyName: 'default';
}

export type MessageRole = 'USER' | 'ASSISTANT';
export type MessageStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELED';
export type QueryStatus = 'SUCCESS' | 'FAILED';

export interface ConversationSummary {
  id: number;
  title: string;
  connectionId: number | null;
  connectionName: string;
  createdAt: string;
  lastActivityAt: string;
}

export interface ConversationMessage {
  id: number;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  createdAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationMessage[];
  /** 消息超过服务端上限时只返回最近部分。 */
  messagesTruncated: boolean;
}

export interface CreateConversationRequest {
  connectionId: number;
  title?: string;
}

/** 游标分页：nextCursor 为 null 表示没有更多。 */
export interface PageResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export type KnowledgeType = 'GLOSSARY' | 'VERIFIED_SQL_EXAMPLE';

export interface KnowledgeEntry {
  id: number;
  sourceType: KnowledgeType;
  title: string;
  content: string;
  connectionId: number | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeEntryInput {
  sourceType: KnowledgeType;
  title: string;
  content: string;
  connectionId?: number | null;
}

export interface KnowledgeHit {
  id: number;
  sourceType: KnowledgeType;
  title: string;
  version: number;
  score: number;
  snippet: string;
}

export interface KnowledgeSearchResponse {
  items: KnowledgeHit[];
  retrievalMode: string;
}

export interface QueryHistoryItem {
  id: number;
  runId: number | null;
  stepId: number | null;
  conversationId: number | null;
  connectionId: number | null;
  connectionName: string;
  sql: string;
  status: QueryStatus;
  executedAt: string;
  durationMs: number;
  rowCount: number | null;
  truncated: boolean | null;
  errorCode: ErrorCode | null;
  errorMessage: string | null;
}

export type AgentRunStatus =
  'PLANNING' | 'WAITING_APPROVAL' | 'RUNNING' | 'CLARIFYING' | 'COMPLETED' | 'FAILED' | 'CANCELED';

export type AgentRoute = 'CHITCHAT' | 'CLARIFY' | 'KNOWLEDGE' | 'SIMPLE' | 'COMPLEX';

export interface RoleActivity {
  role: string;
  status: string;
}

export interface KnowledgeSourceRef {
  id: number;
  sourceType: string;
  title: string;
  version: number;
}

export type AgentStepStatus = 'PENDING' | 'WAITING_APPROVAL' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

export type AgentApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AgentStep {
  id: number;
  sequence: number;
  objective: string;
  dependsOn: number | null;
  status: AgentStepStatus;
  sql: string | null;
  sqlVersion: number;
  agentRole: string | null;
  approvalStatus: AgentApprovalStatus;
  repairCount: number;
  rowCount: number | null;
  truncated: boolean | null;
  errorCode: ErrorCode | null;
  errorMessage: string | null;
  resultSummary: string | null;
}

export interface AgentRun {
  id: number;
  conversationId: number;
  connectionId: number | null;
  connectionName: string;
  question: string;
  status: AgentRunStatus;
  route: AgentRoute | null;
  roleActivities: RoleActivity[];
  knowledgeSources: KnowledgeSourceRef[];
  llmCallCount: number;
  summary: string | null;
  errorCode: ErrorCode | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  steps: AgentStep[];
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
