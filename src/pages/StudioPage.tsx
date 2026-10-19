import { useCallback, useEffect, useState } from 'react';
import { Archive, Bot, Loader2, Play, RefreshCw, Rocket, RotateCcw } from 'lucide-react';
import type { Agent, AgentInput, AgentVersion, ToolDescriptor } from '../api/contract';
import {
  archiveAgent,
  createAgent,
  listAgents,
  listAgentVersions,
  publishAgent,
  rollbackAgent,
  testAgent,
  updateAgent,
} from '../api/studio';
import { fetchTools } from '../api/tool';
import { listSkills } from '../api/skill';
import type { Skill } from '../api/contract';
import { describeError } from '../api/http';
import { EmptyState } from '../components/ui/EmptyState';
import { useConnections } from '../features/connections/useConnections';

const STATUS_LABEL: Record<string, string> = { DRAFT: '草稿', ARCHIVED: '已归档' };

/**
 * Agent Studio：创建、配置、预览、发布与管理 Agent。
 * 工具白名单、RAG/Memory、Skill 绑定在发布时生成不可变快照，运行层按快照执行。
 */
export function StudioPage() {
  const { connections } = useConnections();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tools, setTools] = useState<ToolDescriptor[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Agent | 'new' | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [ragEnabled, setRagEnabled] = useState(true);
  const [ragTopK, setRagTopK] = useState(5);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryBudget, setMemoryBudget] = useState(2000);
  const [selectedSkills, setSelectedSkills] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [versionNote, setVersionNote] = useState('');
  const [busy, setBusy] = useState(false);

  // 测试运行面板
  const [testConnectionId, setTestConnectionId] = useState('');
  const [testInput, setTestInput] = useState('');
  const [testEvents, setTestEvents] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [agentItems, toolItems, skillItems] = await Promise.all([listAgents(), fetchTools(), listSkills()]);
      setAgents(agentItems);
      setTools(toolItems);
      setSkills(skillItems);
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

  const startEdit = (agent: Agent) => {
    setEditing(agent);
    setName(agent.name);
    setDescription(agent.description);
    setSystemPrompt(agent.content.systemPrompt);
    setSelectedTools(new Set(agent.content.tools));
    setRagEnabled(agent.content.rag.enabled);
    setRagTopK(agent.content.rag.topK);
    setMemoryEnabled(agent.content.memory.enabled);
    setMemoryBudget(agent.content.memory.contextBudget);
    setSelectedSkills(new Set(agent.content.skillIds));
    setVersions([]);
  };

  const startCreate = () => {
    setEditing('new');
    setName('');
    setDescription('');
    setSystemPrompt('');
    setSelectedTools(new Set());
    setRagEnabled(true);
    setRagTopK(5);
    setMemoryEnabled(true);
    setMemoryBudget(2000);
    setSelectedSkills(new Set());
    setVersions([]);
  };

  const toggleTool = (toolName: string) => {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolName)) next.delete(toolName);
      else next.add(toolName);
      return next;
    });
  };

  const toggleSkill = (skillId: number) => {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  };

  const buildInput = (): AgentInput => ({
    name: name.trim(),
    description: description.trim(),
    systemPrompt,
    tools: Array.from(selectedTools),
    rag: { enabled: ragEnabled, topK: ragTopK },
    memory: { enabled: memoryEnabled, contextBudget: memoryBudget },
    skillIds: Array.from(selectedSkills),
  });

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing !== null && editing !== 'new') {
        await updateAgent(editing.id, editing.draftRevision, buildInput());
      } else {
        await createAgent(buildInput());
      }
      setEditing(null);
      await reload();
    } catch (saveError) {
      setError(describeError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const archive = async (id: number) => {
    try {
      await archiveAgent(id);
      await reload();
    } catch (archiveError) {
      setError(describeError(archiveError));
    }
  };

  const publish = async (agent: Agent) => {
    setBusy(true);
    try {
      await publishAgent(agent.id, agent.draftRevision, versionNote);
      setVersionNote('');
      await reload();
      setError(null);
    } catch (publishError) {
      setError(describeError(publishError));
    } finally {
      setBusy(false);
    }
  };

  const loadVersions = async (id: number) => {
    try {
      setVersions(await listAgentVersions(id));
    } catch (versionError) {
      setError(describeError(versionError));
    }
  };

  const rollback = async (agent: Agent, sourceVersionId: number) => {
    setBusy(true);
    try {
      await rollbackAgent(agent.id, sourceVersionId, agent.draftRevision);
      await reload();
      setError(null);
    } catch (rollbackError) {
      setError(describeError(rollbackError));
    } finally {
      setBusy(false);
    }
  };

  const runTest = async (agent: Agent) => {
    if (!testConnectionId || !testInput.trim()) return;
    setTesting(true);
    setTestEvents([]);
    const controller = new AbortController();
    try {
      await testAgent(
        agent.id,
        { conversationId: 0, connectionId: Number(testConnectionId), userInput: testInput.trim() },
        (event, data) => {
          setTestEvents((prev) => [...prev, `${event} ${JSON.stringify(data)}`]);
        },
        controller.signal,
      );
    } catch (testError) {
      setTestEvents((prev) => [...prev, `错误：${describeError(testError)}`]);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Agent Studio</h2>
          <span className="text-xs text-ink-muted">配置真正影响运行：工具白名单、RAG/Memory、Skill 绑定。</span>
        </div>
        <div className="flex items-center gap-2">
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
            创建 Agent
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
        <section aria-label="Agent 列表" className="card overflow-hidden">
          {loading && agents.length === 0 ? (
            <p className="flex items-center gap-2 p-4 text-xs text-ink-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              正在加载 Agent…
            </p>
          ) : agents.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="还没有 Agent"
                description="创建并配置你的分析 Agent，发布后即可在 Dashboard 和 Workflow 中使用。"
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {agents.map((agent) => (
                <li key={agent.id}>
                  <div
                    className={`px-4 py-3 transition-colors ${
                      editing !== null && editing !== 'new' && editing.id === agent.id
                        ? 'bg-accent-soft'
                        : 'hover:bg-panel-muted'
                    }`}
                  >
                    <button type="button" className="w-full text-left" onClick={() => startEdit(agent)}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{agent.name}</span>
                        <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted">
                          {STATUS_LABEL[agent.status] ?? agent.status}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-ink-muted">{agent.description}</span>
                      <span className="mt-1 block text-[11px] text-ink-muted">
                        {agent.publishedVersionId ? `已发布版本 #${agent.publishedVersionId}` : '尚未发布'} · 工具{' '}
                        {agent.content.tools.length} · Skill {agent.content.skillIds.length}
                      </span>
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="btn-secondary px-2 py-0.5 text-[11px]"
                        onClick={() => void publish(agent)}
                        disabled={busy}
                      >
                        <Rocket className="h-3 w-3" aria-hidden="true" /> 发布
                      </button>
                      <button
                        type="button"
                        className="btn-muted px-2 py-0.5 text-[11px]"
                        onClick={() => void loadVersions(agent.id)}
                      >
                        版本历史
                      </button>
                      <button
                        type="button"
                        className="btn-muted px-2 py-0.5 text-[11px]"
                        onClick={() => {
                          void startEdit(agent);
                        }}
                      >
                        <Play className="h-3 w-3" aria-hidden="true" /> 测试
                      </button>
                      <button
                        type="button"
                        className="btn-muted px-2 py-0.5 text-[11px] text-danger"
                        onClick={() => void archive(agent.id)}
                        disabled={agent.status === 'ARCHIVED'}
                      >
                        <Archive className="h-3 w-3" aria-hidden="true" /> 归档
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Agent 配置" className="card space-y-3 p-4">
          {editing === null ? (
            <div className="space-y-3">
              <p className="text-xs text-ink-muted">
                点击左侧 Agent 配置，或右上角创建。发布后生成不可变版本，运行按版本快照执行。
              </p>
              {versions.length > 0 ? (
                <div className="border-t border-line pt-3">
                  <h3 className="text-sm font-semibold text-ink">版本历史</h3>
                  <ul className="mt-2 space-y-1.5">
                    {versions.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between rounded-lg border border-line px-2 py-1.5 text-[11px]"
                      >
                        <span>
                          <span className="font-semibold text-ink">v{v.versionNo}</span>
                          <span className="ml-2 text-ink-muted">{v.publishedAt}</span>
                          <span className="ml-2 text-ink-muted">工具 {v.toolIds.length}</span>
                        </span>
                        <button
                          type="button"
                          className="btn-muted px-2 py-0.5 text-[11px]"
                          onClick={() => {
                            const agent = agents.find((a) => a.id === v.agentId);
                            if (agent) void rollback(agent, v.id);
                          }}
                          disabled={busy}
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden="true" /> 回滚
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-ink">{editing === 'new' ? '创建 Agent' : '配置 Agent'}</h3>
              <div>
                <label htmlFor="agent-name" className="field-label">
                  名称
                </label>
                <input
                  id="agent-name"
                  className="input-field mt-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="agent-desc" className="field-label">
                  说明
                </label>
                <input
                  id="agent-desc"
                  className="input-field mt-1"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="agent-prompt" className="field-label">
                  系统提示词（补充要求，不覆盖平台安全约束）
                </label>
                <textarea
                  id="agent-prompt"
                  className="input-field mt-1 h-20 resize-none"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">工具白名单（未勾选的工具运行时被服务端拒绝）</label>
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  {tools.map((tool) => (
                    <label
                      key={tool.name}
                      className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTools.has(tool.name)}
                        onChange={() => toggleTool(tool.name)}
                      />
                      <span className="truncate">{tool.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="field-label">Skill 绑定（仅已发布 Skill 可绑定）</label>
                <div className="mt-1 grid grid-cols-1 gap-1.5">
                  {skills
                    .filter((s) => s.publishedVersionId != null)
                    .map((skill) => (
                      <label
                        key={skill.id}
                        className="flex items-center gap-2 rounded-lg border border-line px-2 py-1.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSkills.has(skill.id)}
                          onChange={() => toggleSkill(skill.id)}
                        />
                        <span className="truncate">{skill.name}</span>
                      </label>
                    ))}
                  {skills.filter((s) => s.publishedVersionId != null).length === 0 ? (
                    <span className="text-[11px] text-ink-muted">暂无已发布 Skill</span>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-line p-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={ragEnabled} onChange={(e) => setRagEnabled(e.target.checked)} />
                    启用业务知识检索
                  </label>
                  <label htmlFor="agent-topk" className="mt-1 block text-[11px] text-ink-muted">
                    Top-K
                  </label>
                  <input
                    id="agent-topk"
                    type="number"
                    min={1}
                    max={10}
                    className="input-field mt-0.5"
                    value={ragTopK}
                    onChange={(e) => setRagTopK(Number(e.target.value))}
                  />
                </div>
                <div className="rounded-lg border border-line p-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={memoryEnabled}
                      onChange={(e) => setMemoryEnabled(e.target.checked)}
                    />
                    启用会话记忆
                  </label>
                  <label htmlFor="agent-budget" className="mt-1 block text-[11px] text-ink-muted">
                    上下文预算
                  </label>
                  <input
                    id="agent-budget"
                    type="number"
                    min={500}
                    max={8000}
                    step={500}
                    className="input-field mt-0.5"
                    value={memoryBudget}
                    onChange={(e) => setMemoryBudget(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* 测试运行面板 */}
              {editing !== 'new' ? (
                <div className="border-t border-line pt-3">
                  <h4 className="text-xs font-semibold text-ink">草稿测试运行（真实 Agent Run，SQL 需人工审批）</h4>
                  <div className="mt-1 flex gap-2">
                    <select
                      className="input-field py-1 text-xs"
                      value={testConnectionId}
                      onChange={(e) => setTestConnectionId(e.target.value)}
                    >
                      <option value="">选择数据源</option>
                      {connections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.database}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input-field flex-1 py-1 text-xs"
                      placeholder="例如：计算有效成交额"
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-secondary px-2 py-1 text-xs"
                      onClick={() => void runTest(editing)}
                      disabled={testing || !testConnectionId}
                    >
                      {testing ? '运行中…' : '运行'}
                    </button>
                  </div>
                  {testEvents.length > 0 ? (
                    <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-panel-muted p-2 text-[10px] text-ink-muted">
                      {testEvents.join('\n')}
                    </pre>
                  ) : null}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2">
                <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                  取消
                </button>
                <div className="flex items-center gap-2">
                  {editing !== 'new' ? (
                    <>
                      <input
                        className="input-field py-1 text-xs"
                        placeholder="版本说明（可选）"
                        value={versionNote}
                        onChange={(e) => setVersionNote(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void publish(editing)}
                        disabled={busy}
                      >
                        <Rocket className="h-3.5 w-3.5" aria-hidden="true" /> 发布
                      </button>
                    </>
                  ) : null}
                  <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}>
                    {saving ? '保存中…' : '保存草稿'}
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
