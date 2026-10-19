import { Loader2, ShieldCheck, XCircle } from 'lucide-react';
import type { AgentRun, AgentRunStatus, AgentStep, AgentStepStatus } from '../../api/contract';
import { EmptyState } from '../../components/ui/EmptyState';

const RUN_LABEL: Record<AgentRunStatus, string> = {
  PLANNING: '规划中',
  CLARIFYING: '等待澄清',
  WAITING_APPROVAL: '等待确认',
  RUNNING: '执行中',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELED: '已取消',
};

const STEP_LABEL: Record<AgentStepStatus, string> = {
  PENDING: '待执行',
  WAITING_APPROVAL: '待确认',
  RUNNING: '执行中',
  SUCCEEDED: '成功',
  FAILED: '失败',
  CANCELED: '已取消',
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

interface AgentTimelineProps {
  run: AgentRun | null;
  loading: boolean;
  streaming: boolean;
  error: string | null;
  onApprove: (step: AgentStep) => void;
  onReject: (step: AgentStep) => void;
  onCancel: () => void;
  onReload: () => void;
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
  onCancel,
  onReload,
}: AgentTimelineProps) {
  const active = run != null && ['PLANNING', 'WAITING_APPROVAL', 'RUNNING'].includes(run.status);

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
              {run.route ? ` · 路由：${run.route}` : ''} · LLM 调用 {run.llmCallCount} 次
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
          </div>

          {run.steps.length > 0 ? (
            <ol className="space-y-2">
              {run.steps.map((step) => {
                const waiting = step.status === 'WAITING_APPROVAL' && !streaming;
                return (
                  <li key={step.id} className="rounded-xl border border-line bg-panel p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                        {step.sequence}
                      </span>
                      <p className="min-w-0 flex-1 text-xs font-semibold text-ink">{step.objective}</p>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chipClass(step.status)}`}
                      >
                        {STEP_LABEL[step.status]}
                      </span>
                    </div>

                    {step.repairCount > 0 ? (
                      <p className="mt-1.5 text-[11px] text-danger">
                        已自动修复 {step.repairCount} 次，修复后的 SQL 需要重新确认。
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
        </div>
      ) : null}
    </section>
  );
}
