import { useCallback, useEffect, useState } from 'react';
import { Activity, KeyRound, LayoutDashboard, RefreshCw, Server, ShieldCheck, Users } from 'lucide-react';
import type { ModelProfile, ModelProvider } from '../api/contract';
import {
  adminDashboard,
  adminModelUsage,
  adminOverview,
  adminUsers,
  createProfile,
  createProvider,
  grantModel,
  listProfiles,
  listProviders,
  testProvider,
  updateProvider,
  upsertQuota,
} from '../api/model';
import type { AdminDashboard, AdminUserPage } from '../api/model';
import { describeError } from '../api/http';
import { EmptyState } from '../components/ui/EmptyState';

type Tab = 'providers' | 'profiles' | 'monitor' | 'quota' | 'users' | 'dashboard';

/**
 * P9 平台管理后台：模型供应商、模型能力档案、LLM 监控、配额治理。
 * P13-M3A 新增「用户」「概览」两个只读视图（数据由独立管理服务经 RPC 提供）。
 * 全部操作要求平台管理员；Key 只写不回读。
 */
export function AdminPage() {
  const [tab, setTab] = useState<Tab>('providers');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);

  const [overview, setOverview] = useState<{ totalCalls: number; failedCalls: number; activeModels: number } | null>(
    null,
  );
  const [usage, setUsage] = useState<{ models: unknown[]; failures: unknown[] } | null>(null);

  const [newProvider, setNewProvider] = useState({ name: '', baseUrl: '', apiKey: '' });
  const [newProfile, setNewProfile] = useState({
    providerId: 0,
    modelId: '',
    modelType: 'CHAT',
    supportsStreaming: true,
    supportsToolCalls: false,
    supportsJson: false,
    contextLimit: 8192,
    outputLimit: 2048,
  });
  const [grantInput, setGrantInput] = useState({ profileId: 0, grantType: 'USER', granteeId: 0 });
  const [quotaInput, setQuotaInput] = useState({ scopeType: 'USER', scopeId: 0, requestsLimit: 0, tokenLimit: 0 });

  // P13-M3A：独立管理服务的只读视图，按需加载，避免非管理员进入页面时被无关错误打扰。
  const [userPage, setUserPage] = useState<AdminUserPage | null>(null);
  const [dash, setDash] = useState<AdminDashboard | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [userQuery, setUserQuery] = useState({ page: 1, size: 20, keyword: '' });
  const [keywordDraft, setKeywordDraft] = useState('');

  const loadUsers = useCallback(async () => {
    setAdminLoading(true);
    try {
      setUserPage(await adminUsers(userQuery));
      setError(null);
    } catch (loadError) {
      setUserPage(null);
      setError(describeError(loadError));
    } finally {
      setAdminLoading(false);
    }
  }, [userQuery]);

  const loadDashboard = useCallback(async () => {
    setAdminLoading(true);
    try {
      setDash(await adminDashboard());
      setError(null);
    } catch (loadError) {
      setDash(null);
      setError(describeError(loadError));
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setProviders(await listProviders());
      setProfiles(await listProfiles());
      setOverview(await adminOverview());
      setUsage(await adminModelUsage(60));
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

  useEffect(() => {
    if (tab === 'users') void loadUsers();
  }, [tab, loadUsers]);

  useEffect(() => {
    if (tab === 'dashboard') void loadDashboard();
  }, [tab, loadDashboard]);

  const submitProvider = async () => {
    if (!newProvider.name.trim() || !newProvider.baseUrl.trim() || !newProvider.apiKey.trim()) return;
    try {
      await createProvider({ ...newProvider, protocol: 'OPENAI_COMPAT' });
      setNewProvider({ name: '', baseUrl: '', apiKey: '' });
      await reload();
    } catch (submitError) {
      setError(describeError(submitError));
    }
  };

  const submitProfile = async () => {
    if (!newProfile.providerId || !newProfile.modelId.trim()) return;
    try {
      await createProfile(newProfile);
      setNewProfile({ ...newProfile, modelId: '' });
      await reload();
    } catch (submitError) {
      setError(describeError(submitError));
    }
  };

  const submitGrant = async () => {
    if (!grantInput.profileId || !grantInput.granteeId) return;
    try {
      await grantModel(grantInput.profileId, grantInput.grantType, grantInput.granteeId);
      setError(null);
    } catch (submitError) {
      setError(describeError(submitError));
    }
  };

  const submitQuota = async () => {
    if (!quotaInput.scopeId) return;
    try {
      await upsertQuota({
        scopeType: quotaInput.scopeType,
        scopeId: quotaInput.scopeId,
        requestsLimit: quotaInput.requestsLimit || undefined,
        tokenLimit: quotaInput.tokenLimit || undefined,
      });
      setError(null);
    } catch (submitError) {
      setError(describeError(submitError));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">平台管理</h2>
          <span className="text-xs text-ink-muted">模型供应商、路由、监控与配额（仅平台管理员）</span>
        </div>
        <button type="button" className="btn-muted px-2 py-1 text-xs" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          刷新
        </button>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex gap-1 border-b border-line">
        {(
          [
            ['providers', '供应商', Server],
            ['profiles', '模型', Activity],
            ['monitor', 'LLM 监控', Activity],
            ['quota', '配额', KeyRound],
            ['users', '用户', Users],
            ['dashboard', '概览', LayoutDashboard],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium ${
              tab === key ? 'border-b-2 border-accent text-ink' : 'text-ink-muted hover:text-ink'
            }`}
            onClick={() => setTab(key)}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'providers' ? (
        <section className="card space-y-4 p-4">
          <h3 className="text-sm font-semibold text-ink">模型供应商</h3>
          {providers.length === 0 ? (
            <EmptyState title="还没有供应商" description="新增受信任的模型供应商连接，Key 加密保存、永不回传。" />
          ) : (
            <ul className="divide-y divide-line">
              {providers.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
                    <span className="text-sm font-medium text-ink">{p.name}</span>
                    <span className="text-xs text-ink-muted">{p.baseUrl}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        p.enabled ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                      }`}
                    >
                      {p.enabled ? '启用' : '停用'}
                    </span>
                    <button
                      type="button"
                      className="btn-muted px-2 py-0.5 text-[11px]"
                      onClick={() => void testProvider(p.id).then((r) => setError(r.ok ? null : '连接测试失败'))}
                    >
                      测试
                    </button>
                    <button
                      type="button"
                      className="btn-muted px-2 py-0.5 text-[11px]"
                      onClick={() => void updateProvider(p.id, { enabled: !p.enabled }).then(() => reload())}
                    >
                      {p.enabled ? '停用' : '启用'}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              className="input-field"
              placeholder="名称"
              value={newProvider.name}
              onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
            />
            <input
              className="input-field"
              placeholder="Base URL（https://…/v1）"
              value={newProvider.baseUrl}
              onChange={(e) => setNewProvider({ ...newProvider, baseUrl: e.target.value })}
            />
            <input
              className="input-field"
              type="password"
              placeholder="API Key（只写不回读）"
              value={newProvider.apiKey}
              onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
            />
          </div>
          <button type="button" className="btn-primary px-3 py-1 text-xs" onClick={() => void submitProvider()}>
            新增供应商
          </button>
        </section>
      ) : null}

      {tab === 'profiles' ? (
        <section className="card space-y-4 p-4">
          <h3 className="text-sm font-semibold text-ink">模型能力档案</h3>
          {profiles.length === 0 ? (
            <EmptyState title="还没有模型档案" description="为供应商注册模型 ID 与能力声明（流式/工具调用/JSON）。" />
          ) : (
            <ul className="divide-y divide-line">
              {profiles.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-sm font-medium text-ink">
                    #{p.id} {p.modelId}
                    <span className="ml-2 text-xs text-ink-muted">
                      {p.modelType} · stream={p.supportsStreaming ? 'Y' : 'N'} · tool={p.supportsToolCalls ? 'Y' : 'N'}
                    </span>
                  </span>
                  <span className="text-xs text-ink-muted">{p.status}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-4">
            <input
              className="input-field"
              type="number"
              placeholder="Provider ID"
              value={newProfile.providerId || ''}
              onChange={(e) => setNewProfile({ ...newProfile, providerId: Number(e.target.value) })}
            />
            <input
              className="input-field"
              placeholder="模型 ID"
              value={newProfile.modelId}
              onChange={(e) => setNewProfile({ ...newProfile, modelId: e.target.value })}
            />
            <select
              className="input-field"
              value={newProfile.modelType}
              onChange={(e) => setNewProfile({ ...newProfile, modelType: e.target.value })}
            >
              <option value="CHAT">CHAT</option>
              <option value="EMBEDDING">EMBEDDING</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={newProfile.supportsToolCalls}
                onChange={(e) => setNewProfile({ ...newProfile, supportsToolCalls: e.target.checked })}
              />
              工具调用
            </label>
          </div>
          <button type="button" className="btn-primary px-3 py-1 text-xs" onClick={() => void submitProfile()}>
            新增模型档案
          </button>

          <div className="border-t border-line pt-3">
            <h4 className="text-xs font-semibold text-ink">授权</h4>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <input
                className="input-field"
                type="number"
                placeholder="Profile ID"
                value={grantInput.profileId || ''}
                onChange={(e) => setGrantInput({ ...grantInput, profileId: Number(e.target.value) })}
              />
              <select
                className="input-field"
                value={grantInput.grantType}
                onChange={(e) => setGrantInput({ ...grantInput, grantType: e.target.value })}
              >
                <option value="USER">USER</option>
                <option value="WORKSPACE">WORKSPACE</option>
                <option value="AGENT">AGENT</option>
              </select>
              <input
                className="input-field"
                type="number"
                placeholder="授权对象 ID"
                value={grantInput.granteeId || ''}
                onChange={(e) => setGrantInput({ ...grantInput, granteeId: Number(e.target.value) })}
              />
            </div>
            <button type="button" className="btn-primary mt-2 px-3 py-1 text-xs" onClick={() => void submitGrant()}>
              授权
            </button>
          </div>
        </section>
      ) : null}

      {tab === 'monitor' ? (
        <section className="card space-y-4 p-4">
          <h3 className="text-sm font-semibold text-ink">LLM 监控</h3>
          {overview ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-line p-3">
                <p className="text-xs text-ink-muted">近 1h 调用数</p>
                <p className="text-lg font-semibold text-ink">{overview.totalCalls}</p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-xs text-ink-muted">失败数</p>
                <p className="text-lg font-semibold text-danger">{overview.failedCalls}</p>
              </div>
              <div className="rounded-lg border border-line p-3">
                <p className="text-xs text-ink-muted">活跃模型</p>
                <p className="text-lg font-semibold text-ink">{overview.activeModels}</p>
              </div>
            </div>
          ) : null}
          {usage && Array.isArray(usage.models) && usage.models.length > 0 ? (
            <div>
              <h4 className="text-xs font-semibold text-ink">模型用量</h4>
              <table className="mt-2 w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-ink-muted">
                    <th className="py-1">模型</th>
                    <th className="py-1">调用</th>
                    <th className="py-1">成功率</th>
                    <th className="py-1">Token</th>
                    <th className="py-1">平均延迟</th>
                  </tr>
                </thead>
                <tbody>
                  {(usage.models as Array<Record<string, unknown>>).map((m, i) => (
                    <tr key={i} className="border-b border-line">
                      <td className="py-1 text-ink">{String(m.modelId)}</td>
                      <td className="py-1">{String(m.totalCalls)}</td>
                      <td className="py-1">{Number(m.successRate ?? 0).toFixed(2)}</td>
                      <td className="py-1">{String(m.totalTokens)}</td>
                      <td className="py-1">{Number(m.avgLatencyMs ?? 0).toFixed(0)}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-ink-muted">暂无调用记录。</p>
          )}
        </section>
      ) : null}

      {tab === 'quota' ? (
        <section className="card space-y-4 p-4">
          <h3 className="text-sm font-semibold text-ink">配额治理</h3>
          <div className="grid gap-2 sm:grid-cols-4">
            <select
              className="input-field"
              value={quotaInput.scopeType}
              onChange={(e) => setQuotaInput({ ...quotaInput, scopeType: e.target.value })}
            >
              <option value="USER">USER</option>
              <option value="WORKSPACE">WORKSPACE</option>
              <option value="AGENT">AGENT</option>
              <option value="MODEL">MODEL</option>
            </select>
            <input
              className="input-field"
              type="number"
              placeholder="Scope ID"
              value={quotaInput.scopeId || ''}
              onChange={(e) => setQuotaInput({ ...quotaInput, scopeId: Number(e.target.value) })}
            />
            <input
              className="input-field"
              type="number"
              placeholder="每分钟请求上限"
              value={quotaInput.requestsLimit || ''}
              onChange={(e) => setQuotaInput({ ...quotaInput, requestsLimit: Number(e.target.value) })}
            />
            <input
              className="input-field"
              type="number"
              placeholder="Token 预算上限"
              value={quotaInput.tokenLimit || ''}
              onChange={(e) => setQuotaInput({ ...quotaInput, tokenLimit: Number(e.target.value) })}
            />
          </div>
          <button type="button" className="btn-primary px-3 py-1 text-xs" onClick={() => void submitQuota()}>
            设置配额
          </button>
        </section>
      ) : null}

      {tab === 'users' ? (
        <section className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">用户</h3>
            <span className="text-xs text-ink-muted">
              {userPage ? `共 ${userPage.total} 个账号 · 第 ${userPage.page} 页 / 每页 ${userPage.size}` : ''}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input-field max-w-56"
              placeholder="按邮箱或昵称搜索"
              value={keywordDraft}
              onChange={(e) => setKeywordDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setUserQuery({ page: 1, size: userQuery.size, keyword: keywordDraft.trim() });
              }}
            />
            <button
              type="button"
              className="btn-muted px-2 py-1 text-xs"
              onClick={() => setUserQuery({ page: 1, size: userQuery.size, keyword: keywordDraft.trim() })}
            >
              搜索
            </button>
            <button
              type="button"
              className="btn-muted px-2 py-1 text-xs"
              disabled={adminLoading || (userPage?.page ?? 1) <= 1}
              onClick={() => setUserQuery({ ...userQuery, page: (userPage?.page ?? 1) - 1 })}
            >
              上一页
            </button>
            <button
              type="button"
              className="btn-muted px-2 py-1 text-xs"
              disabled={adminLoading || !userPage || userPage.page * userPage.size >= userPage.total}
              onClick={() => setUserQuery({ ...userQuery, page: (userPage?.page ?? 1) + 1 })}
            >
              下一页
            </button>
          </div>
          {userPage && userPage.items.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line text-ink-muted">
                  <th className="py-1">ID</th>
                  <th className="py-1">邮箱</th>
                  <th className="py-1">昵称</th>
                  <th className="py-1">角色</th>
                  <th className="py-1">注册时间</th>
                </tr>
              </thead>
              <tbody>
                {userPage.items.map((u) => (
                  <tr key={u.id} className="border-b border-line">
                    <td className="py-1 text-ink-muted">{u.id}</td>
                    <td className="py-1 text-ink">{u.email}</td>
                    <td className="py-1 text-ink">{u.displayName}</td>
                    <td className="py-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          u.role === 'ADMIN' ? 'bg-accent/10 text-accent' : 'text-ink-muted'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-1 text-ink-muted">{u.createdAt ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState
              title={adminLoading ? '加载中…' : '没有匹配的账号'}
              description="仅展示账号元数据（邮箱、昵称、角色、注册时间），不展示任何凭据。"
            />
          )}
        </section>
      ) : null}

      {tab === 'dashboard' ? (
        <section className="card space-y-3 p-4">
          <h3 className="text-sm font-semibold text-ink">平台概览</h3>
          {dash ? (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  ['用户总数', dash.userTotal],
                  ['管理员数', dash.adminTotal],
                  ['24h 活跃用户', dash.activeUsers24h],
                  ['SQL 执行总量', dash.queryExecutionsTotal],
                  ['24h SQL 执行', dash.queryExecutions24h],
                  ['24h 失败执行', dash.failedExecutions24h],
                  ['Agent 运行总量', dash.agentRunsTotal],
                  ['24h Agent 运行', dash.agentRuns24h],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-line p-3">
                    <p className="text-xs text-ink-muted">{String(label)}</p>
                    <p className="text-lg font-semibold text-ink">{Number(value)}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-ink-muted">统计生成时间：{dash.generatedAt}</p>
            </>
          ) : (
            <EmptyState
              title={adminLoading ? '加载中…' : '暂无统计数据'}
              description="统计来自真实业务数据，不做占位填充。"
            />
          )}
        </section>
      ) : null}
    </div>
  );
}
