import { useCallback, useEffect, useState } from 'react';
import { Brain, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';
import type { LongTermMemory, MemoryConfidence, MemoryScope, MemoryType } from '../api/contract';
import { createMemory, deleteMemory, disableMemory, listMemories, searchMemories, updateMemory } from '../api/memory';
import { describeError } from '../api/http';
import { EmptyState } from '../components/ui/EmptyState';

const TYPE_LABEL: Record<MemoryType, string> = {
  PROFILE: '偏好',
  TASK: '任务习惯',
  FACT: '业务事实',
  EPISODIC: '会话事件',
};

const CONFIDENCE_LABEL: Record<MemoryConfidence, string> = {
  UNVERIFIED: '未核验',
  VERIFIED: '已核验',
  REJECTED: '已拒绝',
};

/**
 * 长期 Memory 管理：类型化、有来源、可去重、有权限。
 * 个人记忆默认私有；工作空间记忆按成员权限访问。
 */
export function MemoryPage() {
  const [memories, setMemories] = useState<LongTermMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MemoryType | ''>('');
  const [editing, setEditing] = useState<LongTermMemory | 'new' | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<MemoryType>('FACT');
  const [scope, setScope] = useState<MemoryScope>('PERSONAL');
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState('');
  const [searchScope, setSearchScope] = useState<MemoryScope>('PERSONAL');
  const [searchResults, setSearchResults] = useState<LongTermMemory[]>([]);
  const [searching, setSearching] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listMemories(filter || undefined);
      setMemories(items);
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

  const startEdit = (memory: LongTermMemory) => {
    setEditing(memory);
    setTitle(memory.title);
    setContent(memory.content);
    setType(memory.memoryType);
    setScope(memory.scope);
  };

  const startCreate = () => {
    setEditing('new');
    setTitle('');
    setContent('');
    setType('FACT');
    setScope('PERSONAL');
  };

  const save = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      if (editing !== null && editing !== 'new') {
        await updateMemory(editing.id, title.trim(), content.trim(), 'VERIFIED');
      } else {
        await createMemory({
          type,
          scope,
          title: title.trim(),
          content: content.trim(),
          confidence: 'UNVERIFIED',
        });
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
      await deleteMemory(id);
      if (editing !== null && editing !== 'new' && editing.id === id) setEditing(null);
      await reload();
    } catch (deleteError) {
      setError(describeError(deleteError));
    }
  };

  const toggle = async (memory: LongTermMemory) => {
    try {
      if (memory.status === 'ACTIVE') {
        await disableMemory(memory.id);
      }
      await reload();
    } catch (toggleError) {
      setError(describeError(toggleError));
    }
  };

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const items = await searchMemories(query.trim(), searchScope);
      setSearchResults(items);
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
          <Brain className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">长期记忆</h2>
          <span className="text-xs text-ink-muted">
            个人记忆默认私有；工作空间记忆按成员权限访问，均有来源与核验状态。
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="memory-filter" className="text-xs text-ink-muted">
            类型
          </label>
          <select
            id="memory-filter"
            className="input-field py-1.5 text-xs"
            value={filter}
            onChange={(event) => setFilter(event.target.value as MemoryType | '')}
          >
            <option value="">全部</option>
            <option value="PROFILE">偏好</option>
            <option value="TASK">任务习惯</option>
            <option value="FACT">业务事实</option>
            <option value="EPISODIC">会话事件</option>
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
            新增记忆
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <section aria-label="记忆列表" className="card overflow-hidden">
          {loading && memories.length === 0 ? (
            <p className="flex items-center gap-2 p-4 text-xs text-ink-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              正在加载记忆…
            </p>
          ) : memories.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="还没有长期记忆"
                description="记录经验证的业务事实或偏好，Agent 在后续对话中按权限检索。"
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {memories.map((memory) => (
                <li key={memory.id}>
                  <button
                    type="button"
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      editing !== null && editing !== 'new' && editing.id === memory.id
                        ? 'bg-accent-soft'
                        : 'hover:bg-panel-muted'
                    }`}
                    onClick={() => startEdit(memory)}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{memory.title}</span>
                      <span className="shrink-0 text-[11px] text-ink-muted">
                        {memory.status === 'ACTIVE' ? '启用' : '停用'}
                      </span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
                      <span className="rounded-full border border-line px-2 py-0.5">
                        {TYPE_LABEL[memory.memoryType]}
                      </span>
                      <span className="rounded-full border border-line px-2 py-0.5">
                        {memory.scope === 'PERSONAL' ? '个人' : '工作空间'}
                      </span>
                      <span>{CONFIDENCE_LABEL[memory.confidence]}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="记忆编辑" className="card space-y-3 p-4">
          {editing === null ? (
            <div>
              <p className="text-xs text-ink-muted">
                点击左侧记忆编辑，或新增。记忆作为低信任上下文注入，不覆盖 SQL 审批与工具权限。
              </p>
              <div className="mt-4 border-t border-line pt-3">
                <label htmlFor="memory-search" className="field-label">
                  检索预览
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="memory-search"
                    className="input-field"
                    placeholder="例如：有效订单"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                  <select
                    className="input-field py-1.5 text-xs"
                    value={searchScope}
                    onChange={(event) => setSearchScope(event.target.value as MemoryScope)}
                  >
                    <option value="PERSONAL">个人</option>
                    <option value="WORKSPACE">工作空间</option>
                  </select>
                  <button type="button" className="btn-secondary" onClick={() => void runSearch()} disabled={searching}>
                    <Search className="h-3.5 w-3.5" aria-hidden="true" />
                    检索
                  </button>
                </div>
                {searchResults.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {searchResults.map((memory) => (
                      <li key={memory.id} className="rounded-lg border border-line px-2 py-1.5 text-[11px]">
                        <span className="font-semibold text-ink">
                          [{memory.memoryType}] {memory.title}
                        </span>
                        <p className="mt-0.5 text-ink-muted">{memory.content}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-ink">{editing === 'new' ? '新增记忆' : '编辑记忆'}</h3>
              <div>
                <label htmlFor="memory-title" className="field-label">
                  标题
                </label>
                <input
                  id="memory-title"
                  className="input-field mt-1"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label htmlFor="memory-type" className="field-label">
                    类型
                  </label>
                  <select
                    id="memory-type"
                    className="input-field mt-1"
                    value={type}
                    onChange={(event) => setType(event.target.value as MemoryType)}
                    disabled={editing !== 'new'}
                  >
                    <option value="PROFILE">偏好</option>
                    <option value="TASK">任务习惯</option>
                    <option value="FACT">业务事实</option>
                    <option value="EPISODIC">会话事件</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label htmlFor="memory-scope" className="field-label">
                    作用域
                  </label>
                  <select
                    id="memory-scope"
                    className="input-field mt-1"
                    value={scope}
                    onChange={(event) => setScope(event.target.value as MemoryScope)}
                    disabled={editing !== 'new'}
                  >
                    <option value="PERSONAL">个人</option>
                    <option value="WORKSPACE">工作空间</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="memory-content" className="field-label">
                  内容
                </label>
                <textarea
                  id="memory-content"
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
                    <>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void toggle(editing)}
                        disabled={saving}
                      >
                        {editing.status === 'ACTIVE' ? '停用' : '启用'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-danger"
                        onClick={() => void remove(editing.id)}
                        disabled={saving}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        删除
                      </button>
                    </>
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
