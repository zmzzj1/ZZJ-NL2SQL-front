import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Cable, Loader2, Plug, RefreshCw, Trash2, WifiOff } from 'lucide-react';
import type { McpServerInput, McpServerView } from '../api/contract';
import {
  connectMcpServer,
  createMcpServer,
  deleteMcpServer,
  disconnectMcpServer,
  listMcpServers,
  refreshMcpServerStatus,
  updateMcpServer,
} from '../api/tool';
import { describeError } from '../api/http';
import { EmptyState } from '../components/ui/EmptyState';
import { notifyToolCatalogChanged } from '../features/agent/toolCatalog';

/** 把「键=值」多行文本解析为受控环境元数据；重复键以最后一次为准。 */
function parseEnv(text: string): Record<string, string> | undefined {
  const env: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.length === 0) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;
    env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return Object.keys(env).length > 0 ? env : undefined;
}

/**
 * P14-E E07：用户级 MCP 服务管理。
 *
 * <p>状态语义严格区分：`status` 是配置是否启用的持久意图，`connected` 只代表真实运行事实。
 * 保存成功但连接失败时提示「已保存，连接未成功」，绝不显示为已连接。
 * 环境键值只接受非敏感元数据（secret/token 由后端拒绝并回显明确原因）。</p>
 */
export function McpServersPage() {
  const [servers, setServers] = useState<McpServerView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const [editing, setEditing] = useState<McpServerView | 'new' | null>(null);
  const [name, setName] = useState('');
  const [transportType, setTransportType] = useState<'STDIO' | 'SSE'>('STDIO');
  const [endpoint, setEndpoint] = useState('');
  const [envText, setEnvText] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setServers(await listMcpServers());
      setError(null);
    } catch (loadError) {
      setError(describeError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const startCreate = () => {
    setEditing('new');
    setName('');
    setTransportType('STDIO');
    setEndpoint('');
    setEnvText('');
    setFormError(null);
    setNotice(null);
  };

  const startEdit = (server: McpServerView) => {
    setEditing(server);
    setName(server.name);
    setTransportType(server.transportType);
    setEndpoint(server.endpoint);
    // 后端不回传环境元数据，编辑时留空表示不修改既有非敏感键值。
    setEnvText('');
    setFormError(null);
    setNotice(null);
  };

  const save = async () => {
    const current = editing;
    if (current === null) return;
    if (name.trim().length === 0 || endpoint.trim().length === 0) {
      setFormError('名称与 endpoint 均不能为空');
      return;
    }
    const input: McpServerInput = {
      name: name.trim(),
      transportType,
      endpoint: endpoint.trim(),
      env: parseEnv(envText),
    };
    setSaving(true);
    setFormError(null);
    try {
      const saved = current === 'new' ? await createMcpServer(input) : await updateMcpServer(current.id, input);
      setEditing(null);
      setNotice(
        saved.connected
          ? `已保存并连接，发现 ${saved.toolCount} 个工具`
          : `已保存，连接未成功：${saved.error ?? '服务端未返回连通'}（可稍后重试连接）`,
      );
      await reload();
      notifyToolCatalogChanged();
    } catch (saveError) {
      setFormError(describeError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: number, action: () => Promise<McpServerView>, successText: string) => {
    setBusyId(id);
    setNotice(null);
    try {
      const result = await action();
      setNotice(
        result.connected
          ? `${successText}，当前发现 ${result.toolCount} 个工具`
          : `${successText}，但连接未成功：${result.error ?? '服务端未返回连通'}`,
      );
      await reload();
      notifyToolCatalogChanged();
    } catch (actionError) {
      setError(describeError(actionError));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: number) => {
    setBusyId(id);
    setNotice(null);
    try {
      await deleteMcpServer(id);
      setConfirmDeleteId(null);
      setNotice('已删除该 MCP 服务，其工具已从目录移除');
      await reload();
      notifyToolCatalogChanged();
    } catch (deleteError) {
      setError(describeError(deleteError));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">MCP 服务</h1>
          <p className="text-xs text-ink-muted">
            仅管理你本人的连接；保存只代表配置已落库，连接状态来自服务端真实探测。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-muted px-3 py-1.5 text-xs" onClick={() => void reload()}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            刷新
          </button>
          <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={startCreate}>
            <Plug className="h-3.5 w-3.5" aria-hidden="true" />
            新建服务
          </button>
        </div>
      </header>

      {error ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="rounded-lg border border-line bg-panel-muted px-3 py-2 text-xs text-ink">
          {notice}
        </p>
      ) : null}

      {editing !== null ? (
        <section className="space-y-3 rounded-xl border border-line bg-panel p-4">
          <h2 className="text-sm font-semibold text-ink">
            {editing === 'new' ? '新建 MCP 服务' : `编辑「${editing.name}」`}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[11px] text-ink-muted" htmlFor="mcp-name">
              名称
              <input
                id="mcp-name"
                className="input-field py-1"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={saving}
                maxLength={100}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-ink-muted" htmlFor="mcp-transport">
              传输类型
              <select
                id="mcp-transport"
                className="input-field py-1"
                value={transportType}
                onChange={(event) => setTransportType(event.target.value === 'SSE' ? 'SSE' : 'STDIO')}
                disabled={saving}
              >
                <option value="STDIO">STDIO（受白名单服务名）</option>
                <option value="SSE">SSE（受信远程地址）</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-ink-muted sm:col-span-2" htmlFor="mcp-endpoint">
              endpoint
              <input
                id="mcp-endpoint"
                className="input-field py-1 font-mono"
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                placeholder={transportType === 'STDIO' ? '白名单服务名，例如 demo-mcp' : 'https://…'}
                disabled={saving}
                maxLength={300}
              />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-ink-muted sm:col-span-2" htmlFor="mcp-env">
              非敏感环境键值（每行 KEY=VALUE，secret/token 会被拒绝）
              <textarea
                id="mcp-env"
                className="input-field font-mono"
                rows={3}
                value={envText}
                onChange={(event) => setEnvText(event.target.value)}
                disabled={saving}
              />
            </label>
          </div>
          {formError ? (
            <p role="alert" className="text-xs text-danger">
              {formError}
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-primary px-3 py-1.5 text-xs"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              保存
            </button>
            <button
              type="button"
              className="btn-muted px-3 py-1.5 text-xs"
              onClick={() => setEditing(null)}
              disabled={saving}
            >
              取消
            </button>
          </div>
        </section>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-xs text-ink-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          正在加载 MCP 服务…
        </p>
      ) : servers.length === 0 ? (
        <EmptyState
          title="还没有 MCP 服务"
          description="新建并连接后，服务端会真实执行 tools/list，发现到的工具才会出现在 Agent 工具目录中。"
          icon={Plug}
        />
      ) : (
        <ul className="space-y-2">
          {servers.map((server) => {
            const busy = busyId === server.id;
            return (
              <li key={server.id} className="rounded-xl border border-line bg-panel p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      {server.name}
                      {server.connected ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                          <Cable className="h-3 w-3" aria-hidden="true" />
                          已连接 · {server.toolCount} 个工具
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-panel-muted px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                          <WifiOff className="h-3 w-3" aria-hidden="true" />
                          未连接
                        </span>
                      )}
                    </p>
                    <p className="mt-1 truncate font-mono text-[11px] text-ink-muted">
                      {server.transportType} · {server.endpoint}
                    </p>
                    {!server.connected && server.error ? (
                      <p className="mt-1 text-[11px] text-danger">连接失败：{server.error}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      className="btn-muted px-2 py-1 text-[11px]"
                      onClick={() => void runAction(server.id, () => connectMcpServer(server.id), '连接已刷新')}
                      disabled={busy}
                    >
                      连接
                    </button>
                    <button
                      type="button"
                      className="btn-muted px-2 py-1 text-[11px]"
                      onClick={() => void runAction(server.id, () => disconnectMcpServer(server.id), '已断开')}
                      disabled={busy || !server.connected}
                    >
                      断开
                    </button>
                    <button
                      type="button"
                      className="btn-muted px-2 py-1 text-[11px]"
                      onClick={() => void runAction(server.id, () => refreshMcpServerStatus(server.id), '状态已刷新')}
                      disabled={busy}
                    >
                      状态
                    </button>
                    <button
                      type="button"
                      className="btn-muted px-2 py-1 text-[11px]"
                      onClick={() => startEdit(server)}
                      disabled={busy}
                    >
                      编辑
                    </button>
                    {confirmDeleteId === server.id ? (
                      <>
                        <button
                          type="button"
                          className="btn-muted px-2 py-1 text-[11px] text-danger"
                          onClick={() => void remove(server.id)}
                          disabled={busy}
                        >
                          确认删除
                        </button>
                        <button
                          type="button"
                          className="btn-muted px-2 py-1 text-[11px]"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn-muted px-2 py-1 text-[11px] text-danger"
                        onClick={() => setConfirmDeleteId(server.id)}
                        disabled={busy}
                        aria-label={`删除 ${server.name}`}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
