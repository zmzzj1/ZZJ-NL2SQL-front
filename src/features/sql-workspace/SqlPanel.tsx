import { Loader2, Play, RotateCcw, TriangleAlert } from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { SqlBlock } from '../../components/ui/SqlBlock';
import type { GenerationState } from './useSqlWorkspace';

interface SqlPanelProps {
  generation: GenerationState;
  canExecute: boolean;
  executing: boolean;
  sqlLooksReadOnly: boolean;
  canRetry: boolean;
  fontSize: number;
  onExecute: () => void;
  onRetry: () => void;
}

/** 右侧 SQL 预览：模型生成与执行是两个独立操作。 */
export function SqlPanel({
  generation,
  canExecute,
  executing,
  sqlLooksReadOnly,
  canRetry,
  fontSize,
  onExecute,
  onRetry,
}: SqlPanelProps) {
  const streaming = generation.status === 'streaming';

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">生成的 SQL</h2>
        {streaming ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-line bg-panel-muted px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
            生成中
          </span>
        ) : null}
      </div>

      {generation.sql ? (
        <SqlBlock
          sql={generation.sql}
          fontSize={fontSize}
          title="generated.sql"
          badge={
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
              {streaming ? '流式输出' : '模型生成'}
            </span>
          }
        />
      ) : (
        <EmptyState
          title={generation.status === 'error' ? '生成失败' : '还没有 SQL'}
          description={
            generation.status === 'error'
              ? '本次请求未产生可展示的 SQL，具体原因见下方错误提示。'
              : '在左侧输入问题并发送，SQL 会在这里逐字出现；本阶段不会自动执行。'
          }
        />
      )}

      {generation.status === 'error' ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold">SQL 生成失败</p>
            <p className="mt-0.5 break-words">{generation.errorMessage}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn-primary" onClick={onExecute} disabled={!canExecute}>
          {executing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
          执行查询
        </button>
        {generation.status === 'error' && canRetry ? (
          <button type="button" className="btn-secondary" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            重试生成
          </button>
        ) : null}
        <p className="text-[11px] text-ink-muted">
          {generation.status === 'done' && !sqlLooksReadOnly
            ? '返回内容不像只读 SELECT，执行按钮已禁用。'
            : '生成与执行是两个独立操作；执行只读演示库。'}
        </p>
      </div>
    </div>
  );
}
