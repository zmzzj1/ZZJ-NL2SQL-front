import { useState } from 'react';
import { BarChart3, CheckCircle2, ClipboardList, FileText, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import type {
  AgentConfigResolved,
  AgentRoute,
  AgentRun,
  AgentRunStatus,
  AgentStep,
  AgentStepStatus,
  ContextCompactedMeta,
  GraphNodeName,
  GraphNodeState,
  PlanReviewView,
  SqlCandidateSummary,
  WorkerProgress,
} from '../../api/contract';
import { EmptyState } from '../../components/ui/EmptyState';

const RUN_LABEL: Record<AgentRunStatus, string> = {
  PLANNING: '规划中',
  CLARIFYING: '等待澄清',
  WAITING_APPROVAL: '等待确认',
  WAITING_PLAN_REVIEW: '等待计划审核',
  RUNNING: '执行中',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELED: '已取消',
};

/** P14-A：Manager 路由中文标签（含 MEDIUM 降级与 TOOL_INVOCATION 快捷路径）。 */
const ROUTE_LABEL: Record<AgentRoute, string> = {
  CHITCHAT: '闲聊',
  CLARIFY: '待澄清',
  KNOWLEDGE: '知识解释',
  SIMPLE: '单步查询',
  COMPLEX: '多步分析',
  MEDIUM: '分类降级',
  TOOL_INVOCATION: '显式工具',
};

const STEP_LABEL: Record<AgentStepStatus, string> = {
  PENDING: '待执行',
  WAITING_APPROVAL: '待确认',
  RUNNING: '执行中',
  SUCCEEDED: '成功',
  FAILED: '失败',
  CANCELED: '已取消',
};

/** P11：统一状态图节点中文标签（指南 §4.1）。 */
const NODE_LABEL: Record<GraphNodeName, string> = {
  ROUTING: '路由',
  PLANNING: '规划',
  CONTEXT_BUILDING: '构建上下文',
  RUNNING: '执行',
  SQL_GENERATION: '生成 SQL',
  SQL_EXECUTION: '执行 SQL',
  TOOL_INVOCATION: '调用工具',
  CODE_ANALYSIS: '代码分析',
  REPORT_GENERATION: '生成报告',
  WAITING_CLARIFICATION: '等待澄清',
  WAITING_SQL_APPROVAL: '等待 SQL 审批',
  /** P14-D：计划级风险审核门禁。 */
  HITL_GATE: '计划风险门禁',
  /** P14-D：等待人工审核计划。 */
  WAITING_PLAN_REVIEW: '等待计划审核',
  KNOWLEDGE: '知识检索',
  COMPLETED: '完成',
  FAILED: '失败',
  CANCELED: '已取消',
};

/** 专业角色中文标签（指南 §6）。 */
const ROLE_LABEL: Record<string, string> = {
  MANAGER: 'Manager',
  PLANNER: 'Planner',
  SQL_ANALYST: '数据分析师',
  CODE_ANALYST: '代码分析师',
  TOOL_ASSISTANT: '工具助手',
  REPORT_ASSISTANT: '报告助手',
  KNOWLEDGE: '知识检索',
  DATA_ANALYST: '数据分析师',
};

function chipClass(status: AgentRunStatus | AgentStepStatus): string {
  if (status === 'COMPLETED' || status === 'SUCCEEDED') {
    return 'border-success/40 bg-success/10 text-success';
  }
  if (status === 'FAILED') {
    return 'border-danger/40 bg-danger/10 text-danger';
  }
  if (status === 'WAITING_APPROVAL' || status === 'RUNNING' || status === 'PLANNING' || status === 'CLARIFYING') {
    return 'border-accent/40 bg-accent-soft text-accent';
  }
  return 'border-line bg-panel-muted text-ink-muted';
}

function graphNodeChipClass(status: GraphNodeState['status']): string {
  if (status === 'COMPLETED') {
    return 'border-success/40 bg-success/10 text-success';
  }
  if (status === 'WAITING_APPROVAL') {
    return 'border-warning/40 bg-warning/10 text-warning';
  }
  return 'border-accent/40 bg-accent-soft text-accent';
}

/** 把后端快照的 JSON 字符串解析为可读对象（失败则原样回退）。 */
function parseGraphState(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** P11：统一状态图轨迹（由 SSE node.* 累积），展示可追踪的运行链（指南 §4.1 / P1131）。 */
function GraphStateFlow({ nodes }: { nodes: GraphNodeState[] }) {
  if (nodes.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-[11px] font-semibold text-ink-muted">状态图轨迹</p>
      <ol className="mt-1 flex flex-wrap items-center gap-1.5">
        {nodes.map((entry, index) => (
          <li key={`${entry.node}-${index}`} className="flex items-center gap-1.5">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${graphNodeChipClass(entry.status)}`}
              title={`${entry.node} · ${entry.status}${entry.revision ? ` · rev ${entry.revision}` : ''}`}
            >
              {NODE_LABEL[entry.node] ?? entry.node}
            </span>
            {index < nodes.length - 1 ? <span className="text-ink-muted/50">→</span> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** P11：分层上下文压缩的脱敏元数据（指南 §7.2 / P1126，不展示用户私有原文）。 */
function ContextCompactionView({ meta }: { meta: ContextCompactedMeta }) {
  return (
    <div className="mt-2 rounded-lg border border-line bg-panel-muted px-3 py-2">
      <p className="text-[11px] font-semibold text-ink-muted">上下文压缩（L1–L4）</p>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-ink-muted sm:grid-cols-3">
        <div className="flex gap-1">
          <dt>输入 Token 估算</dt>
          <dd className="text-ink">{meta.inputTokensEstimate}</dd>
        </div>
        <div className="flex gap-1">
          <dt>保留来源</dt>
          <dd className="text-ink">{meta.retainedSources}</dd>
        </div>
        <div className="flex gap-1">
          <dt>丢弃片段</dt>
          <dd className="text-ink">{meta.droppedSegments}</dd>
        </div>
        <div className="flex gap-1">
          <dt>历史预算</dt>
          <dd className="text-ink">{meta.historyBudget}</dd>
        </div>
        <div className="col-span-2 flex gap-1 sm:col-span-3">
          <dt>使用层次</dt>
          <dd className="text-ink">{meta.layersUsed || '—'}</dd>
        </div>
        <div className="col-span-2 flex gap-1 sm:col-span-3">
          <dt>上下文指纹</dt>
          <dd className="font-mono text-ink">{meta.contextHash || '—'}</dd>
        </div>
      </dl>
    </div>
  );
}

/** P11：本轮解析的 Agent 配置摘要（不含敏感提示词）。 */
function ConfigResolvedView({ config }: { config: AgentConfigResolved }) {
  return (
    <p className="mt-1 text-[11px] text-ink-muted">
      Agent 配置：{config.agentId != null ? `#${config.agentId}` : '默认'} · RAG {config.ragEnabled ? '开' : '关'} ·
      记忆 {config.memoryEnabled ? '开' : '关'}
    </p>
  );
}

/**
 * P14-ARCH-01：Worker 阶段徽标（Thinking/Review/Act/Verify 的真实阶段）。
 * 只显示阶段与有界尝试次数，不显示"思考内容"——没有模型推理流时不伪造任何内容。
 */
const WORKER_PHASE_LABEL: Record<string, string> = {
  thinking: 'Thinking',
  acting: 'Act',
  verified: 'Verify 通过',
  verify_failed: 'Verify 未通过',
};

export function WorkerPhaseBadge({ worker }: { worker: WorkerProgress }) {
  return (
    <span
      className="rounded-full border border-line bg-panel-muted px-1.5 py-0.5 text-[10px] text-ink-muted"
      title={`Worker ${worker.role} · ${worker.phase}${worker.attemptId ? ` · ${worker.attemptId}` : ''}`}
    >
      {WORKER_PHASE_LABEL[worker.phase] ?? worker.phase}
      {worker.attempt > 1 ? `（第 ${worker.attempt} 次尝试）` : ''}
    </span>
  );
}

/** P14-ARCH-01：Graph threadId 只做短摘要展示，不可作为权限或恢复凭证。 */
function threadLabel(threadId: string | null | undefined): string {
  if (!threadId) return '';
  return threadId.length > 8 ? `${threadId.slice(0, 8)}…` : threadId;
}

/** P14-C：非 SQL 步骤的角色徽标（Code/Report/工具），避免把分析步骤误当 SQL 查询。 */
const NON_SQL_ROLE_LABEL: Record<string, string> = {
  CODE_ANALYST: '代码分析步骤',
  REPORT_ASSISTANT: '报告步骤',
  TOOL_ASSISTANT: '非 SQL 工具步骤',
};

/** P14-B：多候选 SQL 选优摘要（脱敏计数与分值），仅一行，不影响审批按钮。 */
function CandidateSummaryView({ summary }: { summary: SqlCandidateSummary }) {
  if (summary.mode !== 'MULTI') return null;
  const method = summary.ruleFallback ? '评分不可用，按规则选优' : '规则 + 模型选优';
  const picked =
    summary.selectedCandidateIndex > 0
      ? `（选中 #${summary.selectedCandidateIndex}，综合分 ${summary.compositeScore.toFixed(3)}）`
      : '';
  return (
    <p className="mt-1.5 text-[11px] text-ink-muted">
      候选 SQL {summary.totalCandidates} 条 / 合法 {summary.validCandidates} 条 · {method}
      {picked}
    </p>
  );
}

/** P14-D：计划状态中文标签。 */
const PLAN_REVIEW_LABEL: Record<string, string> = {
  SKIPPED: '已跳过计划审核',
  NOT_REQUIRED: '评估无需人工审核',
  AWAITING: '等待人工审核',
  APPROVED: '计划已批准',
  REPLAN_REQUIRED: '需重新规划',
  REJECTED: '计划已被拒绝',
  EVAL_UNAVAILABLE: '风险 Gate 不可用（已降级放行）',
  PLAN_REVIEW_CONFLICT: '计划审核状态冲突',
};

/**
 * P14-D：计划级审核卡。仅在服务端权威状态为"等待审核"时渲染操作按钮，
 * 刷新恢复后直接来自详情接口，不依赖前端内存中的中间态。
 */
function PlanReviewCard({
  review,
  steps,
  streaming,
  onDecide,
}: {
  review: PlanReviewView;
  steps: AgentStep[];
  streaming: boolean;
  onDecide: (approved: boolean, feedback: string) => void;
}) {
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null);
  const disabled = streaming || submitting != null || !review.awaiting;

  function submit(approved: boolean) {
    setSubmitting(approved ? 'approve' : 'reject');
    onDecide(approved, feedback.trim());
  }

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/10 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardList className="h-4 w-4 text-warning" aria-hidden="true" />
        <p className="text-xs font-semibold text-ink">计划需要人工审核</p>
        <span className="rounded-full border border-line bg-panel-muted px-1.5 py-0.5 text-[10px] text-ink-muted">
          版本 v{review.hitlVersion}
        </span>
        {review.status ? (
          <span className="rounded-full border border-line bg-panel-muted px-1.5 py-0.5 text-[10px] text-ink-muted">
            {PLAN_REVIEW_LABEL[review.status] ?? review.status}
          </span>
        ) : null}
      </div>

      {review.reason ? <p className="mt-1.5 text-[11px] text-ink-muted">原因：{review.reason}</p> : null}
      <p className="mt-1 text-[11px] text-ink-muted">
        已拒绝 {review.rejectionCount} / 3 次，剩余可拒绝 {review.remainingRejections} 次。第 3 次拒绝将终结本次运行。
      </p>

      {steps.length > 0 ? (
        <ol className="mt-2 space-y-1">
          {steps.map((step) => (
            <li key={step.id} className="flex items-start gap-2 text-[11px] text-ink-muted">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-panel-muted text-[10px] font-semibold text-ink">
                {step.sequence}
              </span>
              <span className="min-w-0 flex-1">
                {step.objective}
                {step.agentRole ? (
                  <span className="ml-1 rounded border border-line px-1 py-0.5 text-[10px]">
                    {ROLE_LABEL[step.agentRole] ?? step.agentRole}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      <label className="mt-2 block text-[11px] font-semibold text-ink-muted" htmlFor="plan-review-feedback">
        拒绝时的修改意见（可选）
      </label>
      <textarea
        id="plan-review-feedback"
        className="mt-1 w-full rounded-lg border border-line bg-panel px-2 py-1.5 text-xs text-ink"
        rows={3}
        maxLength={4000}
        value={feedback}
        placeholder="例如：不要按天聚合，改为按月；只统计已支付订单。"
        onChange={(event) => setFeedback(event.target.value)}
        disabled={disabled}
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-primary px-3 py-1.5 text-xs"
          onClick={() => submit(true)}
          disabled={disabled}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          批准并执行计划
        </button>
        <button
          type="button"
          className="btn-secondary px-3 py-1.5 text-xs text-danger"
          onClick={() => submit(false)}
          disabled={disabled}
        >
          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
          拒绝并重新规划
        </button>
      </div>
    </div>
  );
}

interface AgentTimelineProps {
  run: AgentRun | null;
  loading: boolean;
  streaming: boolean;
  error: string | null;
  onApprove: (step: AgentStep) => void;
  onReject: (step: AgentStep) => void;
  /** P14-D：提交计划级审核决定；仅在服务端处于等待审核态时可用。 */
  onDecidePlan?: (approved: boolean, feedback: string) => void;
  onCancel: () => void;
  onReload: () => void;
  /** P14-C：跳转到已有图表组件查看真实分析工件（未提供时仅展示 ID）。 */
  onOpenAnalysis?: (analysisRunId: number) => void;
  /** P14-C：跳转到已有安全报告详情页（未提供时仅展示 ID）。 */
  onOpenReport?: (reportId: number) => void;
}

/** P14-C：Code 步骤的真实分析工件入口（只有真实 analysisRunId 才渲染，不显示假按钮）。 */
function AnalysisEntry({ step, onOpen }: { step: AgentStep; onOpen?: (analysisRunId: number) => void }) {
  if (step.analysisRunId == null) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-line bg-panel-muted px-1.5 py-0.5 text-[10px] text-ink-muted">
        分析运行 #{step.analysisRunId}
      </span>
      {onOpen ? (
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          onClick={() => onOpen(step.analysisRunId as number)}
        >
          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
          查看图表
        </button>
      ) : null}
    </div>
  );
}

/** P14-C：Report 步骤的真实报告入口（只有真实 reportId 才渲染，不显示假按钮）。 */
function ReportEntry({ step, onOpen }: { step: AgentStep; onOpen?: (reportId: number) => void }) {
  if (step.reportId == null) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-line bg-panel-muted px-1.5 py-0.5 text-[10px] text-ink-muted">
        报告 #{step.reportId}
      </span>
      {onOpen ? (
        <button
          type="button"
          className="btn-secondary px-2 py-1 text-xs"
          onClick={() => onOpen(step.reportId as number)}
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          查看报告
        </button>
      ) : null}
    </div>
  );
}

/**
 * Agent 执行时间线：展示计划、每步 SQL、确认状态、修复次数与真实结果摘要。
 * 只有 WAITING_APPROVAL 且当前没有流式请求时才允许确认。
 */
export function AgentTimeline({
  run,
  loading,
  streaming,
  error,
  onApprove,
  onReject,
  onDecidePlan,
  onCancel,
  onReload,
  onOpenAnalysis,
  onOpenReport,
}: AgentTimelineProps) {
  const active =
    run != null &&
    ['PLANNING', 'WAITING_APPROVAL', 'RUNNING', 'WAITING_PLAN_REVIEW', 'CLARIFYING'].includes(run.status);
  const [showGraphState, setShowGraphState] = useState(false);
  /** P14-D：等待审核时展示的计划来自服务端详情；只有 awaiting 为真才渲染操作区。 */
  const planReview = run?.planReview ?? null;
  const awaitingPlanReview = planReview?.awaiting === true && !streaming;

  return (
    <section aria-label="Agent 执行时间线" className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink">Agent 执行</h2>
          {run ? (
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${chipClass(run.status)}`}>
              {RUN_LABEL[run.status]}
            </span>
          ) : null}
          {streaming ? (
            <span className="flex items-center gap-1 text-[11px] text-ink-muted">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              处理中…
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-muted px-2 py-1 text-xs" onClick={onReload} disabled={loading}>
            刷新状态
          </button>
          {active ? (
            <button
              type="button"
              className="btn-secondary px-2 py-1 text-xs text-danger"
              onClick={onCancel}
              disabled={streaming}
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              取消运行
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {loading && !run ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          正在加载 Agent 运行…
        </p>
      ) : null}

      {!loading && !run ? (
        <div className="mt-3">
          <EmptyState
            title="还没有 Agent 运行"
            description="输入一个需要多步分析的问题，Agent 会先给出计划，再逐步生成 SQL 并等待你确认。"
          />
        </div>
      ) : null}

      {run ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-line bg-panel-muted px-3 py-2">
            <p className="text-xs font-semibold text-ink">{run.question}</p>
            <p className="mt-1 text-[11px] text-ink-muted">
              数据源：{run.connectionName || '—'} · 运行 #{run.id}
              {run.route ? ` · 路由：${ROUTE_LABEL[run.route] ?? run.route}` : ''} · LLM 调用 {run.llmCallCount} 次
              {run.threadId ? ` · Graph 线程 ${threadLabel(run.threadId)}` : ''}
            </p>
            {run.roleActivities.length > 0 ? (
              <p className="mt-1 flex flex-wrap gap-1">
                {run.roleActivities.map((activity) => (
                  <span
                    key={activity.role}
                    className="rounded-full border border-line px-1.5 py-0.5 text-[10px] text-ink-muted"
                  >
                    {activity.role}
                  </span>
                ))}
              </p>
            ) : null}
            {run.knowledgeSources.length > 0 ? (
              <p className="mt-1 text-[11px] text-ink-muted">
                知识来源：
                {run.knowledgeSources.map((source) => (
                  <span key={source.id} className="mr-1 rounded bg-accent-soft px-1 py-0.5 text-accent">
                    #{source.id} {source.title} v{source.version}
                  </span>
                ))}
              </p>
            ) : null}
            {run.configResolved ? <ConfigResolvedView config={run.configResolved} /> : null}
            {awaitingPlanReview && planReview && onDecidePlan ? (
              <PlanReviewCard review={planReview} steps={run.steps} streaming={streaming} onDecide={onDecidePlan} />
            ) : null}
            <GraphStateFlow nodes={run.graphNodes ?? []} />
            {run.contextCompacted ? <ContextCompactionView meta={run.contextCompacted} /> : null}
          </div>

          {run.steps.length > 0 ? (
            <ol className="space-y-2">
              {run.steps.map((step) => {
                // P14-C：非 SQL 步骤没有 SQL 可确认，审批按钮只对待确认的 SQL 步骤出现。
                const waiting = step.sql != null && step.status === 'WAITING_APPROVAL' && !streaming;
                return (
                  <li key={step.id} className="rounded-xl border border-line bg-panel p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                        {step.sequence}
                      </span>
                      <p className="min-w-0 flex-1 text-xs font-semibold text-ink">{step.objective}</p>
                      {step.agentRole ? (
                        <span className="rounded-full border border-line bg-panel-muted px-1.5 py-0.5 text-[10px] text-ink-muted">
                          {ROLE_LABEL[step.agentRole] ?? step.agentRole}
                        </span>
                      ) : null}
                      {!step.sql && step.agentRole && NON_SQL_ROLE_LABEL[step.agentRole] ? (
                        <span className="rounded-full border border-line bg-panel-muted px-1.5 py-0.5 text-[10px] text-ink-muted">
                          {NON_SQL_ROLE_LABEL[step.agentRole]}
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chipClass(step.status)}`}
                      >
                        {STEP_LABEL[step.status]}
                      </span>
                      {/* P14-ARCH-01：真实 Worker 阶段（阶段与尝试次数，非思考内容）。 */}
                      {step.worker ? <WorkerPhaseBadge worker={step.worker} /> : null}
                    </div>

                    {step.repairCount > 0 ? (
                      <p className="mt-1.5 text-[11px] text-danger">
                        已自动修复 {step.repairCount} 次，修复后的 SQL 需要重新确认。
                      </p>
                    ) : null}

                    {step.candidateSummary ? <CandidateSummaryView summary={step.candidateSummary} /> : null}

                    {step.repair ? (
                      <p className="mt-1.5 text-[11px] text-ink-muted">
                        工具参数修复中（第 {step.repair.attempt} 次）
                        {step.repair.diagnostic ? `：${step.repair.diagnostic}` : ''}
                        ；修复后仍需真实调用验证，成功与否以工具返回为准。
                      </p>
                    ) : null}

                    {step.sql ? (
                      <div className="mt-2">
                        <p className="text-[11px] text-ink-muted">SQL v{step.sqlVersion}</p>
                        <pre className="mt-1 max-h-48 overflow-auto rounded-lg border border-line bg-panel-muted px-3 py-2 font-mono text-xs leading-relaxed text-ink">
                          <code>{step.sql}</code>
                        </pre>
                      </div>
                    ) : null}

                    {step.resultSummary ? (
                      <p className="mt-2 rounded-lg border border-success/30 bg-success/10 px-2 py-1.5 text-[11px] text-ink">
                        {step.resultSummary}
                      </p>
                    ) : null}

                    {step.agentRole === 'CODE_ANALYST' ? <AnalysisEntry step={step} onOpen={onOpenAnalysis} /> : null}

                    {step.agentRole === 'REPORT_ASSISTANT' ? <ReportEntry step={step} onOpen={onOpenReport} /> : null}

                    {step.errorCode ? (
                      <p className="mt-2 text-[11px] text-danger">
                        {step.errorCode}：{step.errorMessage}
                      </p>
                    ) : null}

                    {waiting ? (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          className="btn-primary px-3 py-1.5 text-xs"
                          onClick={() => onApprove(step)}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          确认执行 SQL v{step.sqlVersion}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => onReject(step)}
                        >
                          拒绝
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : null}

          {run.summary ? (
            <div className="rounded-xl border border-success/30 bg-success/10 px-3 py-2">
              <p className="text-[11px] font-semibold text-success">运行结论</p>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink">{run.summary}</p>
            </div>
          ) : null}

          {run.errorCode ? (
            <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {run.errorCode}：{run.errorMessage ?? '运行失败'}
            </p>
          ) : null}

          {run.graphState ? (
            <div className="rounded-xl border border-line bg-panel p-3">
              <button
                type="button"
                className="flex w-full items-center justify-between text-[11px] font-semibold text-ink-muted"
                onClick={() => setShowGraphState((value) => !value)}
                aria-expanded={showGraphState}
              >
                <span>状态图快照（历史恢复 / P1129）</span>
                <span>{showGraphState ? '收起' : '展开'}</span>
              </button>
              {showGraphState ? (
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-line bg-panel-muted px-3 py-2 font-mono text-[11px] leading-relaxed text-ink">
                  <code>{parseGraphState(run.graphState)}</code>
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
