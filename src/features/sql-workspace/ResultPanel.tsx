import { Loader2, RotateCcw, Table2, TriangleAlert } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { ResultTable } from '../../components/ui/ResultTable';
import type { ExecutionState } from './useSqlWorkspace';

interface ResultPanelProps {
  execution: ExecutionState;
  onRetry: () => void;
}

/** 查询结果区：只渲染真实后端返回，空结果与错误各有独立状态。 */
export function ResultPanel({ execution, onRetry }: ResultPanelProps) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">查询结果</h2>
        {execution.status === 'done' ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
            真实查询
          </span>
        ) : null}
      </div>

      {execution.status === 'running' ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-line bg-panel-muted px-3 py-6 text-xs text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
          正在当前数据源上执行查询…
        </div>
      ) : null}

      {execution.status === 'done' && execution.result ? <ResultTable result={execution.result} /> : null}

      {execution.status === 'error' ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          <span className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="break-words">查询失败：{execution.errorMessage}</span>
          </span>
          <button type="button" className="btn-secondary self-start px-2 py-1 text-[11px]" onClick={onRetry}>
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            重试执行
          </button>
        </div>
      ) : null}

      {execution.status === 'idle' ? (
        <EmptyState
          icon={Table2}
          title="尚未执行 SQL"
          description="生成 SQL 后点击「执行查询」，这里会展示当前数据源返回的真实列与行。"
        />
      ) : null}
    </div>
  );
}
