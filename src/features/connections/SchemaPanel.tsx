import { Loader2, RefreshCw, Table2 } from 'lucide-react';
import type { SchemaResponse } from '../../api/contract';
import { EmptyState } from '../../components/ui/EmptyState';

interface SchemaPanelProps {
  schema: SchemaResponse | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
}

/** 真实表结构：来自 JDBC 元数据，不是前端 Mock。 */
export function SchemaPanel({ schema, loading, error, onRefresh }: SchemaPanelProps) {
  return (
    <section aria-label="表结构" className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">表结构</h2>
        <button type="button" className="btn-muted px-2 py-1 text-xs" onClick={onRefresh} disabled={loading}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          刷新
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {!schema && !loading && !error ? (
        <div className="mt-3">
          <EmptyState title="尚未读取表结构" description="选择连接后会自动读取；也可以点击刷新重新读取。" />
        </div>
      ) : null}

      {schema ? (
        <div className="mt-3 space-y-3">
          <p className="text-[11px] text-ink-muted">
            数据库 <span className="font-mono text-ink">{schema.database}</span> · {schema.tables.length} 张表
          </p>
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {schema.tables.map((table) => (
              <details key={table.name} className="rounded-lg border border-line bg-panel-muted/60 px-3 py-2" open>
                <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-ink">
                  <Table2 className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                  {table.name}
                  <span className="text-[11px] font-normal text-ink-muted">{table.columns.length} 列</span>
                </summary>
                <ul className="mt-2 space-y-1">
                  {table.columns.map((column) => (
                    <li key={column.name} className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="font-mono text-ink">{column.name}</span>
                      <span className="text-ink-muted">{column.type}</span>
                      <span className="text-ink-muted">{column.nullable ? 'NULL' : 'NOT NULL'}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
