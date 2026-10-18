import { useMemo, useState } from 'react';
import { Info, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { createEmptyConnectionDraft, mockConnections } from '../mocks/connections';
import type { ConnectionDraft, ConnectionEngine, ConnectionEntry } from '../types';
import { DemoBadge } from '../components/ui/DemoBadge';
import { EmptyState } from '../components/ui/EmptyState';

const STATUS_LABEL: Record<ConnectionEntry['demoStatus'], string> = {
  'sample-active': '示例 · 活跃',
  'sample-idle': '示例 · 空闲',
};

interface ActionFeedback {
  tone: 'info' | 'success';
  message: string;
}

function sameDraft(a: ConnectionDraft, b: ConnectionDraft): boolean {
  return (
    a.name === b.name &&
    a.engine === b.engine &&
    a.host === b.host &&
    a.port === b.port &&
    a.username === b.username &&
    a.database === b.database
  );
}

/**
 * Database 页：演示连接列表 + 可编辑详情。
 * 所有修改只存在于内存中的演示列表，刷新页面后回到初始 Mock 数据。
 */
export function DatabasePage() {
  const [connections, setConnections] = useState<ConnectionEntry[]>(mockConnections);
  const [selectedId, setSelectedId] = useState(mockConnections[0].id);
  const [drafts, setDrafts] = useState<Record<string, ConnectionDraft>>({});
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  const selected = useMemo(
    () => connections.find((connection) => connection.id === selectedId),
    [connections, selectedId],
  );

  if (!selected) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="演示连接列表为空"
          description="刚才的操作移除或清空了内存中的演示连接，可以恢复初始演示数据继续查看。"
        >
          <button type="button" className="btn-secondary mt-2" onClick={() => setConnections(mockConnections)}>
            恢复演示数据
          </button>
        </EmptyState>
      </div>
    );
  }

  const draft = drafts[selected.id] ?? selected.draft;
  const dirty = !sameDraft(draft, selected.draft);

  const updateDraft = <K extends keyof ConnectionDraft>(key: K, value: ConnectionDraft[K]) => {
    setDrafts((current) => ({ ...current, [selected.id]: { ...draft, [key]: value } }));
    setFeedback(null);
  };

  const saveDraft = () => {
    setConnections((current) =>
      current.map((connection) =>
        connection.id === selected.id
          ? {
              ...connection,
              name: draft.name,
              engine: draft.engine,
              host: draft.host,
              port: draft.port,
              draft,
            }
          : connection,
      ),
    );
    setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== selected.id)));
    setFeedback({
      tone: 'success',
      message: `已更新「${draft.name}」的演示数据（仅本次会话有效）`,
    });
  };

  const resetDraft = () => {
    setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== selected.id)));
    setFeedback({ tone: 'info', message: '已放弃未保存的修改，回到演示数据原值' });
  };

  const addConnection = () => {
    const id = `conn-${Date.now()}`;
    const entry = createEmptyConnectionDraft(id);
    setConnections((current) => [...current, entry]);
    setSelectedId(id);
    setFeedback({
      tone: 'success',
      message: '已在演示列表中新增一条连接（未做任何真实连通性处理）',
    });
  };

  const removeSelected = () => {
    const remaining = connections.filter((connection) => connection.id !== selected.id);
    setConnections(remaining);
    setSelectedId(remaining[0]?.id ?? '');
    setFeedback({ tone: 'info', message: `已从演示列表移除「${selected.name}」` });
  };

  const testConnection = () => {
    setFeedback({
      tone: 'info',
      message: '本阶段尚未接入数据库，未执行任何真实连接检测；这里没有成功或失败的连接结果。',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel-muted px-4 py-3">
        <div className="flex items-center gap-2">
          <DemoBadge>演示连接</DemoBadge>
          <p className="text-xs text-ink-muted">列表中的连接均为虚构示例，不保存任何凭据，也不建立真实连接。</p>
        </div>
        <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" onClick={addConnection}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          新增演示连接
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
        <section aria-label="演示连接列表" className="card overflow-hidden">
          <h2 className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
            连接列表（{connections.length}）
          </h2>
          <ul className="divide-y divide-line">
            {connections.map((connection) => {
              const active = connection.id === selected.id;
              return (
                <li key={connection.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(connection.id)}
                    aria-current={active ? 'true' : undefined}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      active ? 'bg-accent-soft' : 'hover:bg-panel-muted'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{connection.name}</span>
                      <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted">
                        {STATUS_LABEL[connection.demoStatus]}
                      </span>
                    </span>
                    <span className="mt-1 block truncate font-mono text-[11px] text-ink-muted">
                      {connection.engine} · {connection.host}:{connection.port}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="连接详情" className="card p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">连接详情</h2>
              <p className="text-[11px] text-ink-muted">修改仅保存在内存，刷新页面即回到初始演示值。</p>
            </div>
            {dirty ? <DemoBadge variant="neutral">有未保存修改</DemoBadge> : null}
          </div>

          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
            <div>
              <label className="field-label" htmlFor="conn-name">
                连接名称
              </label>
              <input
                id="conn-name"
                className="input-field"
                value={draft.name}
                onChange={(event) => updateDraft('name', event.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="conn-engine">
                引擎类型
              </label>
              <select
                id="conn-engine"
                className="input-field"
                value={draft.engine}
                onChange={(event) => updateDraft('engine', event.target.value as ConnectionEngine)}
              >
                <option value="mysql">MySQL</option>
                <option value="postgresql">PostgreSQL</option>
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="conn-host">
                主机
              </label>
              <input
                id="conn-host"
                className="input-field font-mono"
                value={draft.host}
                onChange={(event) => updateDraft('host', event.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="conn-port">
                端口
              </label>
              <input
                id="conn-port"
                type="number"
                className="input-field font-mono"
                value={Number.isNaN(draft.port) ? '' : draft.port}
                onChange={(event) => updateDraft('port', Number(event.target.value))}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="conn-username">
                用户名（示例值）
              </label>
              <input
                id="conn-username"
                className="input-field font-mono"
                value={draft.username}
                onChange={(event) => updateDraft('username', event.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="conn-database">
                目标数据库
              </label>
              <input
                id="conn-database"
                className="input-field font-mono"
                value={draft.database}
                onChange={(event) => updateDraft('database', event.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="conn-password">
                密码
              </label>
              <input
                id="conn-password"
                type="password"
                className="input-field font-mono"
                value="placeholder-not-stored"
                readOnly
                aria-readonly="true"
              />
              <p className="mt-1.5 text-[11px] text-ink-muted">虚构占位符：此页不读取、不保存、不发送任何真实凭据。</p>
            </div>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <button type="button" className="btn-primary" onClick={saveDraft} disabled={!dirty}>
              <Save className="h-4 w-4" aria-hidden="true" />
              保存演示数据
            </button>
            <button type="button" className="btn-secondary" onClick={resetDraft} disabled={!dirty}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              放弃修改
            </button>
            <button type="button" className="btn-muted" onClick={testConnection}>
              测试连接
            </button>
            <button type="button" className="btn-secondary ml-auto text-danger" onClick={removeSelected}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              移除该演示连接
            </button>
          </div>

          <p role="status" aria-live="polite" className="mt-3 min-h-5 text-xs text-ink-muted">
            {feedback ? (
              <span className={feedback.tone === 'success' ? 'text-success' : 'text-ink-muted'}>
                {feedback.message}
              </span>
            ) : null}
          </p>
        </section>
      </div>

      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        真实连接、Schema 探查与 SQL 执行将在 P0-B01 后端阶段之后接入。
      </p>
    </div>
  );
}
