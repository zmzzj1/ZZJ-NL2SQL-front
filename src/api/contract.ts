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
  | 'TOOL_NOT_FOUND'
  | 'TOOL_FORBIDDEN'
  | 'TOOL_INVALID_ARGUMENT'
  | 'TOOL_EXECUTION_ERROR'
  | 'ANALYSIS_RUN_NOT_FOUND'
  | 'ANALYSIS_SANDBOX_UNAVAILABLE'
  | 'ANALYSIS_EXECUTION_ERROR'
  | 'REPORT_NOT_FOUND'
  | 'MCP_SERVER_NOT_FOUND'
  | 'MCP_UNSUPPORTED'
  | 'MCP_CALL_ERROR'
  | 'WORKFLOW_NOT_FOUND'
  | 'WORKFLOW_INVALID_GRAPH'
  | 'WORKFLOW_STATE_CONFLICT'
  | 'WORKFLOW_RUN_NOT_FOUND'
  | 'AGENT_NOT_FOUND'
  | 'AGENT_VERSION_NOT_FOUND'
  | 'AGENT_CONFLICT'
  | 'AGENT_NOT_PUBLISHED'
  | 'SKILL_NOT_FOUND'
  | 'SKILL_VERSION_NOT_FOUND'
  | 'SKILL_NOT_PUBLISHED'
  | 'SKILL_TEMPLATE_TOO_LONG'
  | 'SKILL_TEMPLATE_INVALID'
  | 'SKILL_INVALID_REFERENCE'
  | 'TOOL_NOT_IN_AGENT_WHITELIST'
  | 'MODEL_UNAVAILABLE'
  | 'WORKSPACE_NOT_FOUND'
  | 'WORKSPACE_FORBIDDEN'
  | 'MEMORY_NOT_FOUND'
  | 'INDEX_NOT_READY'
  | 'EMBEDDING_UNAVAILABLE'
  | 'PROVIDER_NOT_FOUND'
  | 'MODEL_PROFILE_NOT_FOUND'
  | 'MODEL_INCOMPATIBLE'
  | 'ROUTE_POLICY_NOT_FOUND'
  | 'ROUTE_POLICY_CONFLICT'
  | 'ROUTE_POLICY_NOT_PUBLISHED'
  | 'RATE_LIMITED'
  | 'BUDGET_EXCEEDED'
  | 'MODEL_CIRCUIT_OPEN'
  | 'QUOTA_NOT_FOUND'
  | 'ADMIN_FORBIDDEN'
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

/** P6：结构化图表 schema。 */
export type ChartType = 'table' | 'bar' | 'line' | 'pie';

export interface ChartColumn {
  name: string;
  dataType: string;
}

export interface TypedChart {
  chartType: ChartType;
  title: string;
  xLabel?: string;
  yLabel?: string;
  columns?: ChartColumn[];
  data?: unknown[][];
  categories?: string[];
  labels?: string[];
  values?: number[];
}

export interface AnalysisRun {
  id: number;
  queryHistoryId: number | null;
  conversationId: number | null;
  connectionId: number | null;
  agentRunId: number | null;
  agentStepId: number | null;
  engine: string;
  status: string;
  inputRowCount: number;
  chartType: ChartType | null;
  charts: TypedChart[];
  summary: string | null;
  errorCode: ErrorCode | null;
  errorMessage: string | null;
  exitCode: number;
  durationMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnalysisRunRequest {
  queryHistoryId: number;
  code?: string;
  chartType?: ChartType;
}

export interface Report {
  id: number;
  analysisRunId: number | null;
  connectionId: number | null;
  agentRunId: number | null;
  title: string;
  status: string;
  htmlContent: string;
  sizeBytes: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportRequest {
  analysisRunId: number;
  title?: string;
}

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  readOnly: boolean;
}

export interface McpServer {
  name: string;
  transport: string;
  command: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** P6：工作流 DAG。 */
export type WorkflowNodeType = 'START' | 'END' | 'SQL_AGENT' | 'PYTHON_ANALYSIS' | 'REPORT' | 'MCP_TOOL';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  config?: WorkflowNodeConfig | null;
}

export interface WorkflowNodeConfig {
  objective?: string;
  connectionId?: number | null;
  toolName?: string;
  chartType?: ChartType;
  code?: string;
}

export interface WorkflowEdge {
  from: string;
  to: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface Workflow {
  id: number;
  name: string;
  description: string | null;
  definition: WorkflowGraph;
  revision: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRequest {
  name: string;
  description?: string;
  definition: WorkflowGraph;
}

export interface WorkflowNodeState {
  nodeId: string;
  nodeType: WorkflowNodeType;
  sequence: number;
  status: string;
  outputSummary: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface WorkflowRun {
  id: number;
  workflowId: number;
  workflowRevision: number;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  nodes: WorkflowNodeState[];
  createdAt: string;
  updatedAt: string;
}

/** P7：Agent Studio 与 Skill Registry。 */
export interface AgentRagConfig {
  enabled: boolean;
  topK: number;
}

export interface AgentMemoryConfig {
  enabled: boolean;
  contextBudget: number;
}

export interface AgentConfigContent {
  name: string;
  description: string;
  systemPrompt: string;
  model: string | null;
  tools: string[];
  rag: AgentRagConfig;
  memory: AgentMemoryConfig;
  skillIds: number[];
}

export type AgentStatus = 'DRAFT' | 'ARCHIVED';

export interface Agent {
  id: number;
  name: string;
  description: string;
  status: AgentStatus;
  draftRevision: number;
  content: AgentConfigContent;
  publishedVersionId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentInput {
  name: string;
  description?: string;
  systemPrompt?: string;
  model?: string | null;
  tools?: string[];
  rag?: AgentRagConfig;
  memory?: AgentMemoryConfig;
  skillIds?: number[];
}

export interface AgentVersion {
  id: number;
  agentId: number;
  versionNo: number;
  content: AgentConfigContent;
  toolIds: string[];
  modelRef: string | null;
  contentHash: string;
  publishedAt: string;
}

export interface SkillContent {
  triggerScenes: string;
  guidanceTemplate: string;
  parameterSchema: string;
  tags: string[];
}

export type SkillStatus = 'DRAFT' | 'PUBLISHED' | 'DISABLED';

export interface Skill {
  id: number;
  name: string;
  slug: string;
  description: string;
  status: SkillStatus;
  draftRevision: number;
  content: SkillContent;
  publishedVersionId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkillInput {
  name: string;
  slug: string;
  description?: string;
  triggerScenes: string;
  guidanceTemplate: string;
  parameterSchema?: string;
  tags?: string[];
}

export interface SkillVersion {
  id: number;
  skillId: number;
  versionNo: number;
  contentHash: string;
  publishedAt: string;
}

/** P8：Workspace、成员、资源授权与长期 Memory。 */
export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';

export type WorkspaceStatus = 'ACTIVE' | 'DISABLED';

export interface Workspace {
  id: number;
  ownerId: number;
  name: string;
  description: string | null;
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: number;
  workspaceId: number;
  userId: number;
  role: WorkspaceRole;
  status: string;
  grantedBy: number;
  grantedAt: string;
}

export type ResourceType = 'AGENT' | 'KNOWLEDGE' | 'REPORT' | 'CONNECTION';

export type GrantScope = 'READ' | 'EDIT';

export interface ResourceGrant {
  id: number;
  resourceType: ResourceType;
  resourceId: number;
  resourceOwner: number;
  workspaceId: number;
  scope: GrantScope;
  status: string;
  grantedBy: number;
  grantedAt: string;
}

export type MemoryType = 'PROFILE' | 'TASK' | 'FACT' | 'EPISODIC';

export type MemoryScope = 'PERSONAL' | 'WORKSPACE';

export type MemoryConfidence = 'UNVERIFIED' | 'VERIFIED' | 'REJECTED';

export interface LongTermMemory {
  id: number;
  ownerId: number;
  workspaceId: number | null;
  memoryType: MemoryType;
  scope: MemoryScope;
  title: string;
  content: string;
  sourceRef: string | null;
  confidence: MemoryConfidence;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModelProvider {
  id: number;
  name: string;
  protocol: string;
  baseUrl: string;
  enabled: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export type ModelType = 'CHAT' | 'EMBEDDING';

export interface ModelProfile {
  id: number;
  providerId: number;
  modelId: string;
  modelType: ModelType;
  supportsStreaming: boolean;
  supportsToolCalls: boolean;
  supportsJson: boolean;
  contextLimit: number;
  outputLimit: number;
  embeddingDim: number | null;
  status: string;
  capabilitiesVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RouteStrategy = 'ROUND_ROBIN' | 'LATENCY_FIRST' | 'SUCCESS_RATE_FIRST' | 'SMART_WEIGHTED';

export interface RoutePolicyVersion {
  id: number;
  policyId: number;
  versionNo: number;
  strategy: RouteStrategy;
  candidates: string;
  fallbackChain: string;
  weights: string | null;
  affinityTtlSeconds: number;
  status: string;
  publishedAt: string | null;
  createdAt: string;
}
