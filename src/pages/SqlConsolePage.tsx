import { useEffect, useState } from 'react';
import { Download, Loader2, Play, Plus, RefreshCw, Table2, X } from 'lucide-react';
import type { SchemaTable } from '../api/contract';
import { EmptyState } from '../components/ui/EmptyState';
import { ResultTable } from '../components/ui/ResultTable';
import { useConnections } from '../features/connections/useConnections';
import { downloadText, toCsv } from '../features/sql-console/csv';
import { useSqlConsoleTabs } from '../features/sql-console/useSqlConsoleTabs';

/**
 * P10 C3：多标签 SQL Console。每个标签独立保存 SQL、绑定连接与结果，
 * 执行复用 /v1/sql/execute（服务端只读 Guard + 权限校验），结果可安全导出 CSV。
 * 说明：未引入 Monaco——现有 textarea 已满足单步 SQL 编辑需求，引入会带来额外
 * 构建体积与 web worker 配置，且与当前轻量组件体系不匹配（见 tech-decisions）。
 */
export function SqlConsolePage() {
  const { connections, loading: loadingConnections, error: connectionsError } = useConnections();
  const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [activeTable, setActiveTable] = useState<SchemaTable | null>(null);

  const console = useSqlConsoleTabs(selectedConnectionId);

  // 首个连接就绪时，把默认连接绑定到尚未绑定的当前标签并加载 Schema。
  useEffect(() => {
    if (connections.length === 0 || selectedConnectionId !== null) return;
    const first = connections[0].id;
    setSelectedConnectionId(first);
    if (console.activeTab.connectionId === null) {
      console.setActiveConnection(first);
      void console.loadSchema(first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connections, selectedConnectionId]);

  const handleConnectionChange = (value: string) => {
    const id = Number(value);
    setSelectedConnectionId(id);
    console.setActiveConnection(id);
    void console.loadSchema(id);
  };

  const runQuery = () => {
    void console.runActive();
  };

  const exportCsv = () => {
    const result = console.activeTab.execution.result;
    if (!result) return;
    const title = console.activeTab.title.replace(/[^\w\u4e00-\u9fa5-]+/g, '_');
    downloadText(`${title}.csv`, toCsv(result));
  };

  if (loadingConnections && connections.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        正在加载数据源…
      </div>
    );
  }

  if (connectionsError && connections.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          加载数据源失败：{connectionsError}
        </p>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <EmptyState
          icon={Table2}
          title="还没有可用的数据源"
          description="SQL Console 需要绑定真实数据源。请先在「数据库连接」页创建并测试 MySQL 连接。"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <section
        aria-label="连接与标签"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel px-4 py-2.5"
      >
        <label htmlFor="console-connection" className="text-xs font-semibold text-ink-muted">
          数据源
        </label>
        <select
          id="console-connection"
          className="input-field max-w-[280px] py-1.5"
          value={selectedConnectionId ?? ''}
          onChange={(event) => handleConnectionChange(event.target.value)}
        >
          {connections.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {connection.name} · {connection.database}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => console.addTab()}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            新建标签
          </button>
          <button
            type="button"
            className={`btn-muted px-2 py-1 text-xs ${schemaOpen ? 'btn-primary' : ''}`}
            onClick={() => setSchemaOpen((open) => !open)}
          >
            <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
            Schema
          </button>
        </div>
      </section>

      <div className="flex min-h-0 flex-1 gap-4">
        {schemaOpen ? (
          <aside
            aria-label="Schema 浏览"
            className="w-64 shrink-0 overflow-y-auto rounded-xl border border-line bg-panel p-3"
          >
            <h3 className="mb-2 text-xs font-semibold text-ink">表结构</h3>
            {console.activeTab.schemaError ? (
              <p className="text-[11px] text-danger">{console.activeTab.schemaError}</p>
            ) : !console.activeTab.schema ? (
              <p className="text-[11px] text-ink-muted">加载中…</p>
            ) : console.activeTab.schema.tables.length === 0 ? (
              <p className="text-[11px] text-ink-muted">当前连接没有可读取的表</p>
            ) : (
              <ul className="space-y-1">
                {console.activeTab.schema.tables.map((table) => (
                  <li key={table.name}>
                    <button
                      type="button"
                      className="w-full rounded-lg px-2 py-1 text-left text-xs text-ink hover:bg-panel-muted"
                      onClick={() => setActiveTable(table)}
                    >
                      {table.name}
                      <span className="ml-1 text-[10px] text-ink-muted">({table.columns.length})</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {activeTable ? (
              <div className="mt-3 border-t border-line pt-2">
                <p className="mb-1 text-xs font-semibold text-ink">{activeTable.name}</p>
                <ul className="space-y-0.5">
                  {activeTable.columns.map((column) => (
                    <li key={column.name} className="flex items-center gap-1 text-[11px]">
                      <span className="font-mono text-ink">{column.name}</span>
                      <span className="text-ink-muted">{column.type}</span>
                      {column.nullable ? <span className="text-[10px] text-ink-muted">NULL</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        ) : null}

        <section aria-label="SQL 编辑与结果" className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-line bg-panel px-2 py-1.5">
            {console.tabs.map((tab) => (
              <div
                key={tab.id}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${
                  tab.id === console.activeId ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-panel-muted'
                }`}
              >
                <button type="button" className="whitespace-nowrap" onClick={() => console.setActiveId(tab.id)}>
                  {tab.title}
                </button>
                {console.tabs.length > 1 ? (
                  <button
                    type="button"
                    className="text-ink-muted hover:text-danger"
                    onClick={() => console.closeTab(tab.id)}
                    aria-label={`关闭 ${tab.title}`}
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <textarea
            className="input-field min-h-[160px] flex-1 resize-y font-mono text-xs leading-relaxed"
            value={console.activeTab.sql}
            onChange={(event) => console.setActiveSql(event.target.value)}
            placeholder={'-- 输入只读 SQL（SELECT），点击「执行查询」\nSELECT * FROM shop_orders LIMIT 20;'}
            spellCheck={false}
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={runQuery}
              disabled={
                console.activeTab.connectionId === null ||
                !console.activeTab.sql.trim() ||
                console.activeTab.execution.status === 'running'
              }
            >
              {console.activeTab.execution.status === 'running' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
              执行查询
            </button>
            <button
              type="button"
              className="btn-secondary px-2 py-1 text-xs"
              onClick={() => void console.loadSchema(console.activeTab.connectionId)}
              disabled={console.activeTab.connectionId === null}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              刷新 Schema
            </button>
            {console.activeTab.execution.status === 'done' && console.activeTab.execution.result ? (
              <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                导出 CSV
              </button>
            ) : null}
            <p className="text-[11px] text-ink-muted">执行走服务端只读 Guard；结果不缓存，导出重新鉴权执行。</p>
          </div>

          {console.activeTab.execution.status === 'error' ? (
            <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              执行失败：{console.activeTab.execution.errorMessage}
            </p>
          ) : null}

          <div className="rounded-xl border border-line bg-panel p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink">查询结果</h2>
              {console.activeTab.execution.status === 'done' ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                  真实查询
                </span>
              ) : null}
            </div>
            {console.activeTab.execution.status === 'running' ? (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-line bg-panel-muted px-3 py-6 text-xs text-ink-muted">
                <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
                正在当前数据源上执行查询…
              </div>
            ) : null}
            {console.activeTab.execution.status === 'done' && console.activeTab.execution.result ? (
              <ResultTable result={console.activeTab.execution.result} />
            ) : null}
            {console.activeTab.execution.status === 'idle' ? (
              <EmptyState
                icon={Table2}
                title="尚未执行 SQL"
                description="在编辑器中输入只读 SQL，点击「执行查询」，这里会展示真实列与行。"
              />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
