import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Trash2 } from 'lucide-react';
import type { QueryHistoryItem } from '../api/contract';
import { deleteQueryHistory, fetchQueryHistory, listQueryHistory } from '../api/history';
import { describeError } from '../api/http';
import { EmptyState } from '../components/ui/EmptyState';
import { SqlBlock } from '../components/ui/SqlBlock';
import { useConnections } from '../features/connections/useConnections';

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<QueryHistoryItem['status'], string> = {
  SUCCESS: '成功',
  FAILED: '失败',
};

const STATUS_CLASS: Record<QueryHistoryItem['status'], string> = {
  SUCCESS: 'border-success/40 bg-success/10 text-success',
  FAILED: 'border-danger/40 bg-danger/10 text-danger',
};

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface HistoryPageProps {
  fontSize: number;
}

/**
 * 真实查询历史：由后端在执行流程中写入，页面只读取与管理。
 * 不保存结果行，因此详情只展示 SQL、耗时、行数与脱敏错误。
 */
export function HistoryPage({ fontSize }: HistoryPageProps) {
  const { connections } = useConnections();
  const [items, setItems] = useState<QueryHistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterId, setFilterId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<QueryHistoryItem | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const loadPage = useCallback(
    async (cursor: string | null) => {
      setLoading(true);
      try {
        const page = await listQueryHistory({
          limit: PAGE_SIZE,
          cursor,
          connectionId: filterId,
        });
        setItems((current) => (cursor ? [...current, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
        setError(null);
      } catch (loadError) {
        setError(describeError(loadError));
      } finally {
        setLoading(false);
      }
    },
    [filterId],
  );

  useEffect(() => {
    setSelectedId(null);
    setDetail(null);
    void loadPage(null);
  }, [loadPage]);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    if (selectedId === null || !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  useEffect(() => {
    setConfirmDelete(false);
    if (selectedId === null) {
      setDetail(null);
      return;
    }
    const cached = items.find((item) => item.id === selectedId);
    if (cached) {
      setDetail(cached);
      setDetailError(null);
    }
    let active = true;
    fetchQueryHistory(selectedId)
      .then((record) => {
        if (active) {
          setDetail(record);
          setDetailError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (active) setDetailError(describeError(loadError));
      });
    return () => {
      active = false;
    };
  }, [selectedId, items]);

  const removeSelected = async () => {
    if (!detail) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteQueryHistory(detail.id);
      setItems((current) => current.filter((item) => item.id !== detail.id));
      setSelectedId(null);
      setDetail(null);
    } catch (deleteError) {
      setDetailError(describeError(deleteError));
    }
  };

  const hasFilter = filterId !== null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
            真实记录
          </span>
          <p className="text-xs text-ink-muted">仅记录你显式执行过的只读查询，不保存结果行。</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="history-connection" className="text-xs text-ink-muted">
            数据源
          </label>
          <select
            id="history-connection"
            className="input-field max-w-[220px] py-1.5 text-xs"
            value={filterId ?? ''}
            onChange={(event) => setFilterId(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">全部数据源</option>
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-muted px-2 py-1 text-xs"
            onClick={() => void loadPage(null)}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            刷新
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          加载查询历史失败：{error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <section aria-label="查询历史列表" className="card overflow-hidden">
          <div className="border-b border-line px-4 py-2.5">
            <p className="text-[11px] text-ink-muted">共 {items.length} 条已加载记录</p>
          </div>

          {loading && items.length === 0 ? (
            <p className="flex items-center gap-2 p-4 text-xs text-ink-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              正在加载查询历史…
            </p>
          ) : items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={hasFilter ? '该数据源还没有查询记录' : '还没有真实查询记录'}
                description={
                  hasFilter
                    ? '切换数据源筛选，或到工作台执行一次只读查询。'
                    : '在工作台执行一次只读查询后，这里会自动出现后端写入的记录。'
                }
              />
            </div>
          ) : (
            <>
              <ul className="divide-y divide-line">
                {items.map((item) => {
                  const active = item.id === selectedId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        aria-current={active ? 'true' : undefined}
                        className={`w-full px-4 py-3 text-left transition-colors ${
                          active ? 'bg-accent-soft' : 'hover:bg-panel-muted'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-ink">
                            {item.sql.replace(/\s+/g, ' ').slice(0, 80)}
                          </span>
                          <span className="shrink-0 text-[11px] text-ink-muted">{formatDateTime(item.executedAt)}</span>
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[item.status]}`}
                          >
                            {STATUS_LABEL[item.status]}
                          </span>
                          <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted">
                            {item.connectionName}
                          </span>
                          <span className="text-[11px] text-ink-muted">
                            {item.durationMs} ms
                            {item.rowCount != null ? ` · ${item.rowCount} 行` : ''}
                            {item.truncated ? ' · 已截断' : ''}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {nextCursor ? (
                <div className="border-t border-line p-3">
                  <button
                    type="button"
                    className="btn-secondary w-full py-1.5 text-xs"
                    onClick={() => void loadPage(nextCursor)}
                    disabled={loading}
                  >
                    {loading ? '加载中…' : '加载更多'}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section aria-label="记录详情" className="card p-4">
          <h2 className="text-sm font-semibold text-ink">记录详情</h2>

          {detailError ? (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              {detailError}
            </p>
          ) : null}

          {detail ? (
            <div className="mt-3 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[detail.status]}`}
                >
                  {STATUS_LABEL[detail.status]}
                </span>
                <span className="text-[11px] text-ink-muted">
                  #{detail.id} · {formatDateTime(detail.executedAt)}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="field-label">数据源</dt>
                  <dd className="text-ink">{detail.connectionName}</dd>
                </div>
                <div>
                  <dt className="field-label">耗时</dt>
                  <dd className="text-ink">{detail.durationMs} ms</dd>
                </div>
                <div>
                  <dt className="field-label">返回行数</dt>
                  <dd className="text-ink">{detail.rowCount ?? '未返回'}</dd>
                </div>
                <div>
                  <dt className="field-label">结果截断</dt>
                  <dd className="text-ink">{detail.truncated ? '是' : '否'}</dd>
                </div>
              </dl>

              {detail.status === 'FAILED' ? (
                <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                  <p className="font-semibold">{detail.errorCode ?? 'SQL_EXECUTION_ERROR'}</p>
                  <p className="mt-1 leading-relaxed">{detail.errorMessage ?? '执行失败'}</p>
                </div>
              ) : null}

              <div>
                <p className="field-label mb-2">SQL</p>
                <SqlBlock sql={detail.sql} fontSize={fontSize} title={`history-${detail.id}.sql`} />
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-ink-muted">
                  历史仅保存元数据；重新执行请回到工作台重新生成并确认数据源。
                </p>
                <button type="button" className="btn-secondary text-danger" onClick={() => void removeSelected()}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {confirmDelete ? '确认删除' : '删除记录'}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <EmptyState title="未选择记录" description="点击左侧任意一条真实查询记录查看 SQL、耗时与执行状态。" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
