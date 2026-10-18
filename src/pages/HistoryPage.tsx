import { useState } from 'react';
import { RotateCcw, Search, Trash2 } from 'lucide-react';
import { mockHistory } from '../mocks/history';
import type { QueryHistoryItem } from '../types';
import { DemoBadge } from '../components/ui/DemoBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { SqlBlock } from '../components/ui/SqlBlock';

const STATUS_LABEL: Record<QueryHistoryItem['demoStatus'], string> = {
  'example-success': '演示 · 成功样例',
  'example-failed': '演示 · 失败样例',
};

interface HistoryPageProps {
  fontSize: number;
}

/**
 * History 页：搜索过滤与详情切换都是真实的前端状态变化，
 * 「重新执行」明确标注待后端接入，不伪装成数据库操作。
 */
export function HistoryPage({ fontSize }: HistoryPageProps) {
  const [items, setItems] = useState<QueryHistoryItem[]>(mockHistory);
  const [keyword, setKeyword] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(mockHistory[0].id);
  const [removedTitle, setRemovedTitle] = useState<string | null>(null);

  const normalizedKeyword = keyword.trim().toLowerCase();
  const visibleItems = normalizedKeyword
    ? items.filter((item) => `${item.title} ${item.prompt} ${item.sql}`.toLowerCase().includes(normalizedKeyword))
    : items;

  const selected = visibleItems.find((item) => item.id === selectedId) ?? null;

  const removeSelected = () => {
    if (!selected) return;
    setItems((current) => current.filter((item) => item.id !== selected.id));
    setRemovedTitle(selected.title);
    setSelectedId(null);
  };

  const restoreDemoData = () => {
    setItems(mockHistory);
    setSelectedId(mockHistory[0].id);
    setKeyword('');
    setRemovedTitle(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <DemoBadge>演示记录</DemoBadge>
          <p className="text-xs text-ink-muted">以下记录为固定演示数据，不读取任何数据库。</p>
        </div>
        <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" onClick={restoreDemoData}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          恢复演示数据
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <section aria-label="演示历史列表" className="card overflow-hidden">
          <div className="border-b border-line p-3">
            <label className="sr-only" htmlFor="history-search">
              搜索演示记录
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <input
                id="history-search"
                type="search"
                className="input-field pl-9"
                placeholder="按标题、提问或 SQL 片段搜索"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </div>
            <p className="mt-2 text-[11px] text-ink-muted">
              共 {visibleItems.length} 条{items.length !== visibleItems.length ? ` / ${items.length} 条` : ''}
            </p>
          </div>

          {visibleItems.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={items.length === 0 ? '演示记录为空' : '没有匹配的演示记录'}
                description={
                  items.length === 0
                    ? '刚才删除了全部演示记录，可点击右上角「恢复演示数据」。'
                    : `没有包含「${keyword.trim()}」的记录，试试其他关键词。`
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {visibleItems.map((item) => {
                const active = item.id === selected?.id;
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
                        <span className="truncate text-sm font-semibold text-ink">{item.title}</span>
                        <span className="shrink-0 text-[11px] text-ink-muted">{item.createdAt}</span>
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted">
                          {STATUS_LABEL[item.demoStatus]}
                        </span>
                      </span>
                      <code className="mt-2 block truncate font-mono text-[11px] text-ink-muted">
                        {item.sql.replace(/\s+/g, ' ')}
                      </code>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="记录详情" className="card p-4">
          <h2 className="text-sm font-semibold text-ink">记录详情</h2>

          {selected ? (
            <div className="mt-3 space-y-4">
              <div>
                <p className="text-sm font-semibold text-ink">{selected.title}</p>
                <p className="mt-1 text-[11px] text-ink-muted">
                  {selected.id} · {selected.createdAt}
                </p>
              </div>

              <div>
                <p className="field-label">原始提问</p>
                <p className="rounded-lg border border-line bg-panel-muted px-3 py-2 text-xs leading-relaxed text-ink">
                  {selected.prompt}
                </p>
              </div>

              <div>
                <p className="field-label mb-2">SQL</p>
                <SqlBlock sql={selected.sql} fontSize={fontSize} title={`${selected.id}.sql`} />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn-secondary" disabled title="待后端接入">
                  重新执行（待后端接入）
                </button>
                <button type="button" className="btn-secondary text-danger" onClick={removeSelected}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  移除该演示记录
                </button>
              </div>

              <p role="status" aria-live="polite" className="text-[11px] text-ink-muted">
                {removedTitle ? `已从演示列表移除「${removedTitle}」，刷新页面可恢复初始数据。` : ''}
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <EmptyState
                title="未选择记录"
                description="点击左侧任意一条演示记录查看详情；删除与重新执行都不会产生真实数据库操作。"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
