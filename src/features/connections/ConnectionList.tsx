import { Plus, RefreshCw } from 'lucide-react';
import type { Connection } from '../../api/contract';
import { EmptyState } from '../../components/ui/EmptyState';

interface ConnectionListProps {
  connections: Connection[];
  selectedId: number | null;
  loading: boolean;
  error: string;
  onSelect: (connection: Connection) => void;
  onCreate: () => void;
  onReload: () => void;
}

export function ConnectionList({
  connections,
  selectedId,
  loading,
  error,
  onSelect,
  onCreate,
  onReload,
}: ConnectionListProps) {
  return (
    <section aria-label="连接列表" className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold text-ink">我的连接（{connections.length}）</h2>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-muted px-2 py-1 text-xs" onClick={onReload} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            刷新
          </button>
          <button type="button" className="btn-primary px-2 py-1 text-xs" onClick={onCreate}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            新增
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="border-b border-danger/30 bg-danger/10 px-4 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {connections.length === 0 && !loading ? (
        <div className="p-4">
          <EmptyState title="还没有数据源" description="新增一个 MySQL 连接后，才能在 Dashboard 选择数据源并生成 SQL。">
            <button type="button" className="btn-primary mt-2" onClick={onCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              新增连接
            </button>
          </EmptyState>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {connections.map((connection) => {
            const active = connection.id === selectedId;
            return (
              <li key={connection.id}>
                <button
                  type="button"
                  onClick={() => onSelect(connection)}
                  aria-current={active ? 'true' : undefined}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    active ? 'bg-accent-soft' : 'hover:bg-panel-muted'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">{connection.name}</span>
                    <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted">
                      {connection.engine}
                    </span>
                  </span>
                  <span className="mt-1 block truncate font-mono text-[11px] text-ink-muted">
                    {connection.host}:{connection.port}/{connection.database}
                  </span>
                  <span className="mt-1 block text-[11px] text-ink-muted">用户：{connection.username}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
