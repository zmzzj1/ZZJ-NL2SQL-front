import { useEffect, useState } from 'react';
import { Database, Loader2, RefreshCw, Settings2 } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { useConnections } from '../features/connections/useConnections';
import { ChatPanel } from '../features/sql-workspace/ChatPanel';
import { ResultPanel } from '../features/sql-workspace/ResultPanel';
import { SqlPanel } from '../features/sql-workspace/SqlPanel';
import { useSqlWorkspace } from '../features/sql-workspace/useSqlWorkspace';

interface DashboardPageProps {
  fontSize: number;
  onGoToDatabase: () => void;
}

/**
 * SQL 工作台页面：选择真实数据源后，生成/执行都绑定同一个 connectionId。
 */
export function DashboardPage({ fontSize, onGoToDatabase }: DashboardPageProps) {
  const { connections, loading, error, reload } = useConnections();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (connections.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !connections.some((item) => item.id === selectedId)) {
      setSelectedId(connections[0].id);
    }
  }, [connections, selectedId]);

  const selected = connections.find((item) => item.id === selectedId) ?? null;
  const workspace = useSqlWorkspace(selectedId);

  if (loading && connections.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        正在加载数据源…
      </div>
    );
  }

  if (error && connections.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-3 py-10">
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          加载数据源失败：{error}
        </p>
        <button type="button" className="btn-secondary" onClick={() => void reload()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          重试
        </button>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <EmptyState
          icon={Database}
          title="还没有可用的数据源"
          description="SQL 生成与执行都需要绑定一个真实数据源。请先在「数据库连接」页创建并测试 MySQL 连接。"
        >
          <button type="button" className="btn-primary mt-2" onClick={onGoToDatabase}>
            <Database className="h-4 w-4" aria-hidden="true" />
            去创建连接
          </button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <section
        aria-label="数据源选择"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel px-4 py-2.5"
      >
        <label htmlFor="dashboard-connection" className="text-xs font-semibold text-ink-muted">
          数据源
        </label>
        <select
          id="dashboard-connection"
          className="input-field max-w-[280px] py-1.5"
          value={selectedId ?? ''}
          onChange={(event) => setSelectedId(Number(event.target.value))}
        >
          {connections.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {connection.name} · {connection.database}
            </option>
          ))}
        </select>
        {selected ? (
          <span className="font-mono text-[11px] text-ink-muted">
            {selected.host}:{selected.port}/{selected.database} · {selected.username}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="btn-muted px-2 py-1 text-xs"
            onClick={() => void reload()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            刷新
          </button>
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={onGoToDatabase}>
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            管理连接
          </button>
        </div>
      </section>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <ChatPanel
          messages={workspace.messages}
          input={workspace.input}
          generating={workspace.generation.status === 'streaming'}
          canSend={workspace.canSend}
          onInputChange={workspace.setInput}
          onSend={workspace.sendMessage}
          onCancel={workspace.cancelGeneration}
          onClear={workspace.clearAll}
        />

        <section
          aria-label="SQL 与结果预览"
          className="flex min-w-0 flex-col gap-4 lg:h-full lg:w-[58%] lg:overflow-y-auto"
        >
          <SqlPanel
            generation={workspace.generation}
            canExecute={workspace.canExecute}
            executing={workspace.execution.status === 'running'}
            sqlLooksReadOnly={workspace.sqlLooksReadOnly}
            canRetry={workspace.canRetryGeneration}
            fontSize={fontSize}
            onExecute={() => void workspace.runQuery()}
            onRetry={workspace.retryGeneration}
          />
          <ResultPanel execution={workspace.execution} onRetry={() => void workspace.runQuery()} />

          <p className="rounded-xl border border-line bg-panel-muted px-4 py-3 text-[11px] leading-relaxed text-ink-muted">
            当前数据源：<span className="font-mono">{selected?.database}</span> · 只读账号查询 · 模型输出不会自动执行 ·
            界面不展示连接密码或模型密钥。
          </p>
        </section>
      </div>
    </div>
  );
}
