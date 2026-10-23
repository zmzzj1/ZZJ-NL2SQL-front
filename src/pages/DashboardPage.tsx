import { useEffect, useState } from 'react';
import { Database, Loader2, Plus, RefreshCw, Settings2, Trash2 } from 'lucide-react';
import { ApiError, describeError } from '../api/http';
import { EmptyState } from '../components/ui/EmptyState';
import { AgentTimeline } from '../features/agent/AgentTimeline';
import { ToolPicker, type ToolPickerState } from '../features/agent/ToolPicker';
import { useAgentRun } from '../features/agent/useAgentRun';
import { useConnections } from '../features/connections/useConnections';
import { useConversations } from '../features/conversations/useConversations';
import { ChatPanel } from '../features/sql-workspace/ChatPanel';
import { ResultPanel } from '../features/sql-workspace/ResultPanel';
import { SqlPanel } from '../features/sql-workspace/SqlPanel';
import { useSqlWorkspace } from '../features/sql-workspace/useSqlWorkspace';

interface DashboardPageProps {
  fontSize: number;
  onGoToDatabase: () => void;
  /** P14-C：从时间线跳转到分析报告页查看指定真实工件。 */
  onGoToArtifact?: (kind: 'analysis' | 'report', artifactId: number) => void;
}

function formatActivity(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * SQL 工作台页面：会话与数据源共同决定生成/执行上下文。
 * 切换数据源会开启新会话；切换会话会同步其绑定的数据源。
 */
export function DashboardPage({ fontSize, onGoToDatabase, onGoToArtifact }: DashboardPageProps) {
  const { connections, loading, error, reload } = useConnections();
  const conversations = useConversations();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversationError, setConversationError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mode, setMode] = useState<'single' | 'agent'>('single');
  // P14-A：用户在输入框显式选择的工具（仅在点击发送后提交）。
  const [toolPicker, setToolPicker] = useState<ToolPickerState>({
    selection: null,
    validationError: null,
  });
  const [toolError, setToolError] = useState<string | null>(null);
  /**
   * P14-D：计划级审核开关。默认 true（跳过计划级审核，与旧行为一致），
   * 勾选"复杂计划先人工审核"后置为 false，仅对本次新建的运行生效。
   */
  const [autoConfirm, setAutoConfirm] = useState(true);

  const activeConversation = conversations.items.find((item) => item.id === conversationId) ?? null;
  const connectionMissing =
    activeConversation !== null &&
    (activeConversation.connectionId === null ||
      !connections.some((item) => item.id === activeConversation.connectionId));

  useEffect(() => {
    if (connectionMissing) return;
    if (connections.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !connections.some((item) => item.id === selectedId)) {
      setSelectedId(connections[0].id);
    }
  }, [connections, selectedId, connectionMissing]);

  useEffect(() => {
    setConfirmDelete(false);
  }, [conversationId]);

  const selected = connections.find((item) => item.id === selectedId) ?? null;

  const workspace = useSqlWorkspace({
    connectionId: selectedId,
    conversationId,
    readOnly: connectionMissing,
    ensureConversation: async (question) => {
      if (selectedId === null) {
        throw new ApiError('CONNECTION_NOT_FOUND', '请先选择数据源', 400);
      }
      const created = await conversations.create(selectedId, question.slice(0, 60));
      return created.id;
    },
    onConversationCreated: setConversationId,
    onGenerationSettled: () => {
      void conversations.reload();
    },
  });

  const agent = useAgentRun({
    conversationId,
    connectionId: selectedId,
    onSettled: () => {
      void workspace.reloadMessages();
      void conversations.reload();
    },
  });

  const startNewConversation = () => {
    workspace.startNewConversation();
    setConversationId(null);
    setConversationError(null);
  };

  const handleAgentSend = async () => {
    const question = workspace.input.trim();
    if (!question || selectedId === null || agent.streaming || connectionMissing) return;
    // P14-A：参数未填齐时不发起请求，由前端先拦截；后端仍是最终验证方。
    if (toolPicker.validationError) {
      setToolError(toolPicker.validationError);
      return;
    }
    setToolError(null);
    const toolInvocation = toolPicker.selection;
    workspace.setInput('');
    if (conversationId === null) {
      try {
        const created = await conversations.create(selectedId, question.slice(0, 60));
        await agent.start(question, {
          conversationId: created.id,
          onCreated: setConversationId,
          toolInvocation,
          autoConfirm,
        });
      } catch (sendError) {
        setConversationError(describeError(sendError));
      }
      return;
    }
    await agent.start(question, { toolInvocation, autoConfirm });
  };

  const handleConnectionChange = (value: string) => {
    setSelectedId(Number(value));
    startNewConversation();
  };

  const handleConversationChange = (value: string) => {
    setConversationError(null);
    if (!value) {
      startNewConversation();
      return;
    }
    const target = conversations.items.find((item) => String(item.id) === value);
    if (!target) return;
    setConversationId(target.id);
    if (target.connectionId !== null && connections.some((item) => item.id === target.connectionId)) {
      setSelectedId(target.connectionId);
    }
  };

  const handleDeleteConversation = async () => {
    if (conversationId === null) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await conversations.remove(conversationId);
      startNewConversation();
    } catch (deleteError) {
      setConversationError(describeError(deleteError));
    }
  };

  if (loading && connections.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        正在加载数据源…
      </div>
    );
  }

  if (error && connections.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-3 py-10">
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          加载数据源失败：{error}
        </p>
        <button type="button" className="btn-secondary" onClick={() => void reload()}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          重试
        </button>
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <EmptyState
          icon={Database}
          title="还没有可用的数据源"
          description="SQL 生成与执行都需要绑定一个真实数据源。请先在「数据库连接」页创建并测试 MySQL 连接。"
        >
          <button type="button" className="btn-primary mt-2" onClick={onGoToDatabase}>
            <Database className="h-4 w-4" aria-hidden="true" />
            去创建连接
          </button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <section
        aria-label="数据源选择"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel px-4 py-2.5"
      >
        <label htmlFor="dashboard-connection" className="text-xs font-semibold text-ink-muted">
          数据源
        </label>
        <select
          id="dashboard-connection"
          className="input-field max-w-[280px] py-1.5"
          value={selectedId ?? ''}
          onChange={(event) => handleConnectionChange(event.target.value)}
        >
          {connections.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {connection.name} · {connection.database}
            </option>
          ))}
        </select>
        {selected ? (
          <span className="font-mono text-[11px] text-ink-muted">
            {selected.host}:{selected.port}/{selected.database} · {selected.username}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="btn-muted px-2 py-1 text-xs"
            onClick={() => void reload()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            刷新
          </button>
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={onGoToDatabase}>
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            管理连接
          </button>
        </div>
      </section>

      <section
        aria-label="会话选择"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-panel px-4 py-2.5"
      >
        <div className="flex items-center gap-1 rounded-lg border border-line p-0.5" role="group" aria-label="查询模式">
          <button
            type="button"
            className={`px-2 py-1 text-xs ${mode === 'single' ? 'btn-primary' : 'btn-muted'}`}
            onClick={() => setMode('single')}
            disabled={workspace.generation.status === 'streaming' || agent.streaming}
            aria-pressed={mode === 'single'}
          >
            单步 SQL
          </button>
          <button
            type="button"
            className={`px-2 py-1 text-xs ${mode === 'agent' ? 'btn-primary' : 'btn-muted'}`}
            onClick={() => setMode('agent')}
            disabled={workspace.generation.status === 'streaming' || agent.streaming}
            aria-pressed={mode === 'agent'}
          >
            Agent 多步
          </button>
        </div>
        <label htmlFor="dashboard-conversation" className="text-xs font-semibold text-ink-muted">
          会话
        </label>
        <select
          id="dashboard-conversation"
          className="input-field max-w-[320px] py-1.5"
          value={conversationId ?? ''}
          onChange={(event) => handleConversationChange(event.target.value)}
          disabled={conversations.loading && conversations.items.length === 0}
        >
          <option value="">新会话（首次提问时创建）</option>
          {conversations.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} · {item.connectionName}
            </option>
          ))}
        </select>
        {activeConversation ? (
          <span className="text-[11px] text-ink-muted">
            最近活动 {formatActivity(activeConversation.lastActivityAt)}
          </span>
        ) : (
          <span className="text-[11px] text-ink-muted">提问后自动创建并持久化</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {conversations.nextCursor ? (
            <button
              type="button"
              className="btn-muted px-2 py-1 text-xs"
              onClick={() => void conversations.loadMore()}
              disabled={conversations.loading}
            >
              加载更多
            </button>
          ) : null}
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={startNewConversation}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            新建会话
          </button>
          <button
            type="button"
            className={`btn-secondary px-2 py-1 text-xs ${confirmDelete ? 'text-danger' : ''}`}
            onClick={() => void handleDeleteConversation()}
            disabled={conversationId === null}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            {confirmDelete ? '确认删除' : '删除会话'}
          </button>
        </div>
      </section>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      {conversationError ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {conversationError}
        </p>
      ) : null}

      {toolError ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {toolError}
        </p>
      ) : null}

      {connectionMissing ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          该会话关联的数据源已被删除，只能查看历史消息；如需继续查询，请新建会话并选择有效数据源。
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <ChatPanel
          messages={workspace.messages}
          input={workspace.input}
          generating={mode === 'agent' ? agent.streaming : workspace.generation.status === 'streaming'}
          loading={workspace.loadingMessages}
          error={workspace.messagesError}
          progressLabel={mode === 'agent' ? 'Agent 正在规划并生成 SQL…' : undefined}
          canSend={
            mode === 'agent'
              ? workspace.input.trim().length > 0 && selectedId !== null && !agent.streaming && !connectionMissing
              : workspace.canSend
          }
          onInputChange={workspace.setInput}
          onSend={mode === 'agent' ? () => void handleAgentSend() : workspace.sendMessage}
          onCancel={mode === 'agent' ? () => void agent.cancel() : workspace.cancelGeneration}
          onClear={startNewConversation}
          toolSlot={
            mode === 'agent' ? (
              <div className="flex flex-wrap items-center gap-3">
                <ToolPicker
                  disabled={connectionMissing || agent.streaming}
                  onChange={(state) => {
                    setToolPicker(state);
                    if (!state.validationError) setToolError(null);
                  }}
                />
                <label
                  className="flex cursor-pointer items-center gap-1.5 text-[11px] text-ink-muted"
                  htmlFor="agent-plan-review-toggle"
                >
                  <input
                    id="agent-plan-review-toggle"
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-line"
                    checked={!autoConfirm}
                    disabled={connectionMissing || agent.streaming}
                    onChange={(event) => setAutoConfirm(!event.target.checked)}
                  />
                  复杂计划先人工审核
                </label>
              </div>
            ) : undefined
          }
        />

        <section
          aria-label="SQL 与结果预览"
          className="flex min-w-0 flex-col gap-4 lg:h-full lg:w-[58%] lg:overflow-y-auto"
        >
          {mode === 'agent' ? (
            <AgentTimeline
              run={agent.run}
              loading={agent.loading}
              streaming={agent.streaming}
              error={agent.error}
              onApprove={(step) => void agent.approve(step)}
              onReject={(step) => void agent.reject(step)}
              onDecidePlan={(approved, feedback) => void agent.decidePlan(approved, feedback)}
              onCancel={() => void agent.cancel()}
              onReload={() => void agent.reload()}
              onOpenAnalysis={onGoToArtifact ? (analysisRunId) => onGoToArtifact('analysis', analysisRunId) : undefined}
              onOpenReport={onGoToArtifact ? (reportId) => onGoToArtifact('report', reportId) : undefined}
            />
          ) : (
            <>
              <SqlPanel
                generation={workspace.generation}
                canExecute={workspace.canExecute}
                executing={workspace.execution.status === 'running'}
                sqlLooksReadOnly={workspace.sqlLooksReadOnly}
                canRetry={workspace.canRetryGeneration}
                fontSize={fontSize}
                onExecute={() => void workspace.runQuery()}
                onRetry={workspace.retryGeneration}
              />
              <ResultPanel execution={workspace.execution} onRetry={() => void workspace.runQuery()} />
            </>
          )}

          <p className="rounded-xl border border-line bg-panel-muted px-4 py-3 text-[11px] leading-relaxed text-ink-muted">
            当前数据源：<span className="font-mono">{selected?.database}</span> · 只读账号查询 · 模型输出不会自动执行 ·
            会话与查询历史保存在管理库，不保存结果行、连接密码或模型密钥。
            {mode === 'agent' ? ' Agent 每一步 SQL 都需要你确认后才会执行。' : ''}
          </p>
        </section>
      </div>
    </div>
  );
}
