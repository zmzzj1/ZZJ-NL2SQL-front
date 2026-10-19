import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, RefreshCw, Users } from 'lucide-react';
import type { ResourceGrant, ResourceType, Workspace, WorkspaceMember, WorkspaceRole } from '../api/contract';
import {
  addMember,
  createWorkspace,
  grantResource,
  listGrants,
  listMembers,
  listWorkspaces,
  removeMember,
  revokeResource,
} from '../api/workspace';
import { describeError } from '../api/http';
import { EmptyState } from '../components/ui/EmptyState';

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  OWNER: '所有者',
  ADMIN: '管理员',
  EDITOR: '编辑者',
  VIEWER: '查看者',
};

const RESOURCE_LABEL: Record<ResourceType, string> = {
  AGENT: 'Agent',
  KNOWLEDGE: '知识',
  REPORT: '报告',
  CONNECTION: '数据源',
};

/**
 * Workspace 管理：空间列表、成员与角色、资源授权。
 * 权限由服务端决定；成员资格不自动授权 SQL 执行或数据源。
 */
export function WorkspacePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [grants, setGrants] = useState<ResourceGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState<WorkspaceRole>('VIEWER');
  const [grantType, setGrantType] = useState<ResourceType>('KNOWLEDGE');
  const [grantId, setGrantId] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listWorkspaces();
      setWorkspaces(items);
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

  const reloadDetail = useCallback(async (workspace: Workspace) => {
    try {
      const [memberList, grantList] = await Promise.all([listMembers(workspace.id), listGrants(workspace.id)]);
      setMembers(memberList);
      setGrants(grantList);
    } catch (detailError) {
      setError(describeError(detailError));
    }
  }, []);

  const select = (workspace: Workspace) => {
    setSelected(workspace);
    void reloadDetail(workspace);
  };

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const workspace = await createWorkspace(newName.trim(), newDesc.trim() || undefined);
      setNewName('');
      setNewDesc('');
      await reload();
      setSelected(workspace);
      await reloadDetail(workspace);
    } catch (createError) {
      setError(describeError(createError));
    } finally {
      setCreating(false);
    }
  };

  const addUser = async () => {
    if (!selected || !memberUserId.trim()) return;
    try {
      await addMember(selected.id, Number(memberUserId), memberRole);
      setMemberUserId('');
      await reloadDetail(selected);
    } catch (addError) {
      setError(describeError(addError));
    }
  };

  const removeUser = async (userId: number) => {
    if (!selected) return;
    try {
      await removeMember(selected.id, userId);
      await reloadDetail(selected);
    } catch (removeError) {
      setError(describeError(removeError));
    }
  };

  const grant = async () => {
    if (!selected || !grantId.trim()) return;
    try {
      await grantResource(selected.id, grantType, Number(grantId), 'READ');
      setGrantId('');
      await reloadDetail(selected);
    } catch (grantError) {
      setError(describeError(grantError));
    }
  };

  const revoke = async (resourceType: ResourceType, resourceId: number) => {
    if (!selected) return;
    try {
      await revokeResource(selected.id, resourceType, resourceId);
      await reloadDetail(selected);
    } catch (revokeError) {
      setError(describeError(revokeError));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">工作空间</h2>
          <span className="text-xs text-ink-muted">
            成员角色与资源授权由服务端判定，不自动共享数据源与 SQL 执行权。
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input-field py-1.5 text-xs"
            placeholder="新空间名称"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <button
            type="button"
            className="btn-primary px-2 py-1 text-xs"
            onClick={() => void create()}
            disabled={creating}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            创建
          </button>
          <button
            type="button"
            className="btn-muted px-2 py-1 text-xs"
            onClick={() => void reload()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            刷新
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <section aria-label="空间列表" className="card overflow-hidden">
          {loading && workspaces.length === 0 ? (
            <p className="flex items-center gap-2 p-4 text-xs text-ink-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              正在加载空间…
            </p>
          ) : workspaces.length === 0 ? (
            <div className="p-4">
              <EmptyState title="还没有工作空间" description="创建空间后可邀请成员、共享知识与 Agent。" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {workspaces.map((workspace) => (
                <li key={workspace.id}>
                  <button
                    type="button"
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      selected?.id === workspace.id ? 'bg-accent-soft' : 'hover:bg-panel-muted'
                    }`}
                    onClick={() => select(workspace)}
                  >
                    <span className="block truncate text-sm font-semibold text-ink">{workspace.name}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-muted">
                      {workspace.description || '无描述'} · 所有者 #{workspace.ownerId}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="空间详情" className="space-y-4">
          {!selected ? (
            <div className="card p-4">
              <p className="text-xs text-ink-muted">选择左侧空间查看成员与资源授权。</p>
            </div>
          ) : (
            <>
              <div className="card space-y-3 p-4">
                <h3 className="text-sm font-semibold text-ink">成员</h3>
                <ul className="space-y-1.5">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
                    >
                      <span className="text-xs text-ink">
                        用户 #{member.userId}
                        <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted">
                          {ROLE_LABEL[member.role]}
                        </span>
                      </span>
                      {member.role !== 'OWNER' ? (
                        <button
                          type="button"
                          className="text-[11px] text-danger hover:underline"
                          onClick={() => void removeUser(member.userId)}
                        >
                          移除
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <input
                    className="input-field flex-1 text-xs"
                    placeholder="成员用户 ID"
                    value={memberUserId}
                    onChange={(event) => setMemberUserId(event.target.value)}
                  />
                  <select
                    className="input-field py-1.5 text-xs"
                    value={memberRole}
                    onChange={(event) => setMemberRole(event.target.value as WorkspaceRole)}
                  >
                    <option value="VIEWER">查看者</option>
                    <option value="EDITOR">编辑者</option>
                    <option value="ADMIN">管理员</option>
                  </select>
                  <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => void addUser()}>
                    邀请
                  </button>
                </div>
              </div>

              <div className="card space-y-3 p-4">
                <h3 className="text-sm font-semibold text-ink">资源授权</h3>
                <ul className="space-y-1.5">
                  {grants.length === 0 ? (
                    <li className="text-xs text-ink-muted">暂无共享资源。共享知识不会附赠数据源或 SQL 执行权。</li>
                  ) : (
                    grants.map((grantItem) => (
                      <li
                        key={grantItem.id}
                        className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
                      >
                        <span className="text-xs text-ink">
                          {RESOURCE_LABEL[grantItem.resourceType]} #{grantItem.resourceId}
                          <span className="ml-2 text-[11px] text-ink-muted">{grantItem.scope}</span>
                        </span>
                        <button
                          type="button"
                          className="text-[11px] text-danger hover:underline"
                          onClick={() => void revoke(grantItem.resourceType, grantItem.resourceId)}
                        >
                          撤销
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                <div className="flex gap-2">
                  <select
                    className="input-field py-1.5 text-xs"
                    value={grantType}
                    onChange={(event) => setGrantType(event.target.value as ResourceType)}
                  >
                    <option value="KNOWLEDGE">知识</option>
                    <option value="AGENT">Agent</option>
                    <option value="REPORT">报告</option>
                    <option value="CONNECTION">数据源</option>
                  </select>
                  <input
                    className="input-field flex-1 text-xs"
                    placeholder="资源 ID"
                    value={grantId}
                    onChange={(event) => setGrantId(event.target.value)}
                  />
                  <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => void grant()}>
                    共享
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
