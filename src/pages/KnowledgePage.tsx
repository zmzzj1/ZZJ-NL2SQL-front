import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';
import type { KnowledgeEntry, KnowledgeHit, KnowledgeType } from '../api/contract';
import {
  createKnowledgeEntry,
  deleteKnowledgeEntry,
  listKnowledgeEntries,
  searchKnowledge,
  updateKnowledgeEntry,
} from '../api/knowledge';
import { describeError } from '../api/http';
import { EmptyState } from '../components/ui/EmptyState';
import { useConnections } from '../features/connections/useConnections';

const TYPE_LABEL: Record<KnowledgeType, string> = {
  GLOSSARY: '业务术语',
  VERIFIED_SQL_EXAMPLE: '审核 SQL 示例',
};

/**
 * 业务知识维护：术语与审核 SQL 示例的持久化 CRUD + 服务端鉴权检索预览。
 * 检索当前为明确标注的关键词相关性（向量语义检索需要 Embedding 环境）。
 */
export function KnowledgePage() {
  const { connections } = useConnections();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<KnowledgeType | ''>('');
  const [editing, setEditing] = useState<KnowledgeEntry | 'new' | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<KnowledgeType>('GLOSSARY');
  const [scope, setScope] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<KnowledgeHit[]>([]);
  const [searchMode, setSearchMode] = useState('');
  const [searching, setSearching] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listKnowledgeEntries(filter || undefined);
      setEntries(items);
      setError(null);
    } catch (loadError) {
      setError(describeError(loadError));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const startEdit = (entry: KnowledgeEntry) => {
    setEditing(entry);
    setTitle(entry.title);
    setContent(entry.content);
    setType(entry.sourceType);
    setScope(entry.connectionId == null ? '' : String(entry.connectionId));
  };

  const startCreate = () => {
    setEditing('new');
    setTitle('');
    setContent('');
    setType('GLOSSARY');
    setScope('');
  };

  const save = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const input = {
        sourceType: type,
        title: title.trim(),
        content: content.trim(),
        connectionId: scope ? Number(scope) : null,
      };
      if (editing !== null && editing !== 'new') {
        await updateKnowledgeEntry(editing.id, input);
      } else {
        await createKnowledgeEntry(input);
      }
      setEditing(null);
      await reload();
    } catch (saveError) {
      setError(describeError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await deleteKnowledgeEntry(id);
      if (editing !== null && editing !== 'new' && editing.id === id) setEditing(null);
      await reload();
    } catch (deleteError) {
      setError(describeError(deleteError));
    }
  };

  const runSearch = async () => {
    const keyword = query.trim();
    if (!keyword || connections.length === 0) return;
    setSearching(true);
    try {
      const result = await searchKnowledge(connections[0].id, keyword);
      setHits(result.items);
      setSearchMode(result.retrievalMode);
      setError(null);
    } catch (searchError) {
      setError(describeError(searchError));
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">业务知识</h2>
          <span className="text-xs text-ink-muted">术语与审核示例只属于当前用户；检索仅在授权数据源作用域内命中。</span>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="knowledge-filter" className="text-xs text-ink-muted">
            类型
          </label>
          <select
            id="knowledge-filter"
            className="input-field py-1.5 text-xs"
            value={filter}
            onChange={(event) => setFilter(event.target.value as KnowledgeType | '')}
          >
            <option value="">全部</option>
            <option value="GLOSSARY">业务术语</option>
            <option value="VERIFIED_SQL_EXAMPLE">审核 SQL 示例</option>
          </select>
          <button
            type="button"
            className="btn-muted px-2 py-1 text-xs"
            onClick={() => void reload()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            刷新
          </button>
          <button type="button" className="btn-primary px-2 py-1 text-xs" onClick={startCreate}>
            新增条目
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <section aria-label="知识条目列表" className="card overflow-hidden">
          {loading && entries.length === 0 ? (
            <p className="flex items-center gap-2 p-4 text-xs text-ink-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              正在加载知识条目…
            </p>
          ) : entries.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="还没有业务知识"
                description="维护业务术语（如“有效订单”的定义）或经过审核的 SQL 示例，Agent 生成时会检索并展示来源。"
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      editing !== null && editing !== 'new' && editing.id === entry.id
                        ? 'bg-accent-soft'
                        : 'hover:bg-panel-muted'
                    }`}
                    onClick={() => startEdit(entry)}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{entry.title}</span>
                      <span className="shrink-0 text-[11px] text-ink-muted">v{entry.version}</span>
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-[11px] text-ink-muted">
                      <span className="rounded-full border border-line px-2 py-0.5">
                        {TYPE_LABEL[entry.sourceType]}
                      </span>
                      <span>{entry.connectionId == null ? '用户级' : `数据源 #${entry.connectionId}`}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="条目编辑" className="card space-y-3 p-4">
          {editing === null ? (
            <div>
              <p className="text-xs text-ink-muted">
                点击左侧条目编辑，或点击右上角「新增条目」。知识只作为生成参考证据，不能绕过 SQL 校验与用户确认。
              </p>
              <div className="mt-4 border-t border-line pt-3">
                <label htmlFor="knowledge-search" className="field-label">
                  检索预览（使用第一个数据源的作用域）
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="knowledge-search"
                    className="input-field"
                    placeholder="例如：有效订单"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void runSearch()}
                    disabled={searching || connections.length === 0}
                  >
                    <Search className="h-3.5 w-3.5" aria-hidden="true" />
                    检索
                  </button>
                </div>
                {searchMode ? (
                  <p className="mt-1 text-[11px] text-ink-muted">检索模式：{searchMode}（关键词相关性）</p>
                ) : null}
                {hits.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {hits.map((hit) => (
                      <li key={hit.id} className="rounded-lg border border-line px-2 py-1.5 text-[11px]">
                        <span className="font-semibold text-ink">
                          #{hit.id} {hit.title} v{hit.version}
                        </span>
                        <span className="ml-2 text-ink-muted">score={hit.score.toFixed(2)}</span>
                        <p className="mt-0.5 text-ink-muted">{hit.snippet}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-ink">{editing === 'new' ? '新增条目' : '编辑条目'}</h3>
              <div>
                <label htmlFor="knowledge-title" className="field-label">
                  标题
                </label>
                <input
                  id="knowledge-title"
                  className="input-field mt-1"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="knowledge-type" className="field-label">
                  类型
                </label>
                <select
                  id="knowledge-type"
                  className="input-field mt-1"
                  value={type}
                  onChange={(event) => setType(event.target.value as KnowledgeType)}
                >
                  <option value="GLOSSARY">业务术语</option>
                  <option value="VERIFIED_SQL_EXAMPLE">审核 SQL 示例</option>
                </select>
              </div>
              <div>
                <label htmlFor="knowledge-scope" className="field-label">
                  作用域（空 = 用户级全部数据源）
                </label>
                <select
                  id="knowledge-scope"
                  className="input-field mt-1"
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                >
                  <option value="">用户级</option>
                  {connections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.name} · {connection.database}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="knowledge-content" className="field-label">
                  内容
                </label>
                <textarea
                  id="knowledge-content"
                  className="input-field mt-1 h-28 resize-none"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                  取消
                </button>
                <div className="flex items-center gap-2">
                  {editing !== 'new' ? (
                    <button
                      type="button"
                      className="btn-secondary text-danger"
                      onClick={() => void remove(editing.id)}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      删除
                    </button>
                  ) : null}
                  <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}>
                    {saving ? '保存中…' : '保存'}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
