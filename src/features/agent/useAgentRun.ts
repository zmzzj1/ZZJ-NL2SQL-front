import { useCallback, useEffect, useRef, useState } from 'react';
import {
  approveAgentStep,
  cancelAgentRun,
  fetchAgentRun,
  fetchLatestAgentRun,
  rejectAgentStep,
  streamAgentRun,
} from '../../api/agent';
import type { AgentEventPayload } from '../../api/agent';
import type {
  AgentConfigResolved,
  AgentRun,
  AgentRoute,
  AgentRunStatus,
  AgentStep,
  ContextCompactedMeta,
  GraphNodeName,
  GraphNodeState,
  GraphNodeStatus,
  KnowledgeSourceRef,
  ToolInvocationRequest,
} from '../../api/contract';
import { describeError } from '../../api/http';

const ACTIVE_STATUS: AgentRunStatus[] = ['PLANNING', 'WAITING_APPROVAL', 'RUNNING', 'CLARIFYING'];

interface AgentRunOptions {
  conversationId: number | null;
  connectionId: number | null;
  /** 运行状态变化后刷新会话消息（Agent 会写入用户问题与总结）。 */
  onSettled?: () => void;
}

/** P14-A：显式工具选择（仅在用户点击发送后才随运行请求提交）。 */
export interface StartOptions {
  conversationId?: number;
  onCreated?: (id: number) => void;
  toolInvocation?: ToolInvocationRequest | null;
}

function skeleton(runId: number, question: string, conversationId: number): AgentRun {
  const now = new Date().toISOString();
  return {
    id: runId,
    conversationId,
    connectionId: null,
    connectionName: '',
    question,
    status: 'PLANNING',
    route: null,
    roleActivities: [],
    knowledgeSources: [],
    llmCallCount: 0,
    summary: null,
    errorCode: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    steps: [],
    graphNodes: [],
    contextCompacted: null,
    configResolved: null,
  };
}

function patchStep(run: AgentRun, stepId: number, patch: Partial<AgentStep>): AgentRun {
  return {
    ...run,
    steps: run.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
  };
}

function upsertNode(
  run: AgentRun,
  node: GraphNodeName,
  status: GraphNodeStatus,
  revision: string | undefined,
): AgentRun {
  const nodes: GraphNodeState[] = run.graphNodes ?? [];
  const last = nodes[nodes.length - 1];
  // 连续相同节点与状态只更新版本，避免时间线出现重复噪声。
  if (last && last.node === node && last.status === status) {
    return {
      ...run,
      graphNodes: [...nodes.slice(0, -1), { ...last, revision: revision ?? last.revision }],
    };
  }
  return { ...run, graphNodes: [...nodes, { node, status, revision }] };
}

function applyEvent(run: AgentRun | null, event: string, data: AgentEventPayload): AgentRun | null {
  if (!run) return run;
  switch (event) {
    case 'run.started':
      return { ...run, id: Number(data.runId ?? run.id) };
    case 'config.resolved': {
      const config: AgentConfigResolved = {
        agentId: data.agentId != null ? Number(data.agentId) : null,
        agentVersionId: data.agentVersionId != null ? Number(data.agentVersionId) : null,
        ragEnabled: Boolean(data.ragEnabled),
        memoryEnabled: Boolean(data.memoryEnabled),
      };
      return { ...run, configResolved: config };
    }
    case 'node.started':
      return upsertNode(
        run,
        String(data.node ?? '') as GraphNodeName,
        'STARTED',
        data.revision != null ? String(data.revision) : undefined,
      );
    case 'node.completed':
      return upsertNode(
        run,
        String(data.node ?? '') as GraphNodeName,
        'COMPLETED',
        data.revision != null ? String(data.revision) : undefined,
      );
    case 'node.waiting_approval':
      return upsertNode(run, String(data.node ?? '') as GraphNodeName, 'WAITING_APPROVAL', undefined);
    case 'context.compacted': {
      const meta: ContextCompactedMeta = {
        inputTokensEstimate: Number(data.inputTokensEstimate ?? 0),
        retainedSources: Number(data.retainedSources ?? 0),
        droppedSegments: Number(data.droppedSegments ?? 0),
        historyBudget: Number(data.historyBudget ?? 0),
        layersUsed: String(data.layersUsed ?? ''),
        contextHash: String(data.contextHash ?? ''),
      };
      return { ...run, contextCompacted: meta };
    }
    case 'agent.selected': {
      const seq = Number(data.sequence);
      const role = String(data.role ?? '');
      if (!role) return run;
      return {
        ...run,
        steps: run.steps.map((step) => (step.sequence === seq ? { ...step, agentRole: role } : step)),
      };
    }
    case 'plan.ready': {
      const raw = Array.isArray(data.steps) ? data.steps : [];
      const steps: AgentStep[] = raw.map((item) => {
        const step = item as { stepId: number; sequence: number; objective: string };
        return {
          id: step.stepId,
          sequence: step.sequence,
          objective: step.objective,
          dependsOn: null,
          status: 'PENDING',
          sql: null,
          sqlVersion: 0,
          agentRole: null,
          approvalStatus: 'PENDING',
          repairCount: 0,
          rowCount: null,
          truncated: null,
          errorCode: null,
          errorMessage: null,
          resultSummary: null,
        };
      });
      return { ...run, steps };
    }
    case 'step.started':
      return patchStep(run, Number(data.stepId), { status: 'RUNNING' });
    case 'step.sql_ready':
      return patchStep(run, Number(data.stepId), {
        sql: String(data.sql ?? ''),
        sqlVersion: Number(data.sqlVersion ?? 0),
        status: 'WAITING_APPROVAL',
        approvalStatus: 'PENDING',
      });
    case 'approval.required':
      return patchStep(run, Number(data.stepId), { status: 'WAITING_APPROVAL' });
    case 'step.repairing':
      return patchStep(run, Number(data.stepId), {
        repairCount: Number(data.attempt ?? 0),
        status: 'WAITING_APPROVAL',
      });
    case 'step.succeeded':
      return patchStep(run, Number(data.stepId), {
        status: 'SUCCEEDED',
        rowCount: data.rowCount == null ? null : Number(data.rowCount),
        truncated: Boolean(data.truncated),
        resultSummary: String(data.summary ?? ''),
        errorCode: null,
        errorMessage: null,
      });
    case 'step.failed':
      return patchStep(run, Number(data.stepId), {
        status: 'FAILED',
        errorCode: (data.code as AgentStep['errorCode']) ?? 'AGENT_STEP_FAILED',
        errorMessage: String(data.message ?? ''),
      });
    // P14-A：显式工具单次执行的受限摘要（与步骤详情保持一致，不伪造 SQL）。
    case 'tool.result': {
      const stepId = Number(data.stepId);
      const status = String(data.status ?? '');
      const summary = String(data.summary ?? '');
      const patch: Partial<AgentStep> = { resultSummary: summary };
      if (status === 'SUCCEEDED') {
        patch.status = 'SUCCEEDED';
      } else if (status === 'FAILED') {
        patch.status = 'FAILED';
        patch.errorMessage = summary;
      }
      return patchStep(run, stepId, patch);
    }
    case 'run.completed':
      return { ...run, status: 'COMPLETED', summary: String(data.summary ?? '') };
    case 'run.failed':
      return {
        ...run,
        status: 'FAILED',
        errorCode: (data.code as AgentRun['errorCode']) ?? 'AGENT_STEP_FAILED',
        errorMessage: String(data.message ?? ''),
      };
    case 'run.canceled':
      return { ...run, status: 'CANCELED' };
    case 'agent.routed':
      return { ...run, route: (data.route as AgentRoute) ?? null };
    case 'knowledge.retrieved': {
      const raw = Array.isArray(data.sources) ? data.sources : [];
      const sources: KnowledgeSourceRef[] = raw.map((item) => item as KnowledgeSourceRef);
      return { ...run, knowledgeSources: sources };
    }
    case 'clarify.required':
      return { ...run, status: 'CLARIFYING', errorMessage: String(data.message ?? '') };
    case 'agent.completed': {
      const role = String(data.role ?? '');
      if (!role) return run;
      if (run.roleActivities.some((item) => item.role === role)) return run;
      return {
        ...run,
        roleActivities: [...run.roleActivities, { role, status: String(data.status ?? 'DONE') }],
      };
    }
    default:
      return run;
  }
}

/**
 * Agent 运行状态机：服务端是状态真相源，事件只用于流式展示，结束后重新拉取详情。
 */
export function useAgentRun({ conversationId, connectionId, onSettled }: AgentRunOptions) {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);
  const skipReloadRef = useRef<number | null>(null);
  const runIdRef = useRef<number | null>(null);
  const settledRef = useRef(onSettled);

  useEffect(() => {
    settledRef.current = onSettled;
  }, [onSettled]);

  const reload = useCallback(async () => {
    if (conversationId == null) {
      setRun(null);
      return;
    }
    const seq = seqRef.current + 1;
    seqRef.current = seq;
    setLoading(true);
    try {
      const latest = await fetchLatestAgentRun(conversationId);
      if (seqRef.current !== seq) return;
      setRun(latest);
      setError(null);
    } catch (loadError) {
      if (seqRef.current !== seq) return;
      setError(describeError(loadError));
    } finally {
      if (seqRef.current === seq) setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    // 新建会话后立刻启动的运行不应被切换 effect 取消。
    if (conversationId !== null && skipReloadRef.current === conversationId) {
      skipReloadRef.current = null;
      return;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setError(null);
    void reload();
  }, [conversationId, reload]);

  const finishStream = useCallback(async (runId: number | null, seq: number) => {
    // 先拉取权威详情再结束 streaming：避免按钮在 run.id 尚未写入时被点击。
    if (runId != null && seqRef.current === seq) {
      try {
        const detail = await fetchAgentRun(runId);
        if (seqRef.current === seq) setRun(detail);
      } catch (loadError) {
        if (seqRef.current === seq) setError(describeError(loadError));
      }
    }
    setStreaming(false);
    settledRef.current?.();
  }, []);

  const start = useCallback(
    async (question: string, options?: StartOptions) => {
      const targetConversationId = options?.conversationId ?? conversationId;
      if (targetConversationId == null || connectionId == null) return;
      if (options?.conversationId != null && options.conversationId !== conversationId) {
        skipReloadRef.current = options.conversationId;
        options.onCreated?.(options.conversationId);
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = seqRef.current + 1;
      seqRef.current = seq;
      runIdRef.current = null;
      setError(null);
      setStreaming(true);
      setRun(skeleton(0, question, targetConversationId));

      try {
        await streamAgentRun(
          {
            conversationId: targetConversationId,
            connectionId,
            userInput: question,
            ...(options?.toolInvocation ? { toolInvocation: options.toolInvocation } : {}),
          },
          {
            onEvent: (event, data) => {
              if (seqRef.current !== seq) return;
              if (event === 'run.started') {
                runIdRef.current = Number(data.runId);
              }
              setRun((current) => applyEvent(current, event, data));
            },
          },
          controller.signal,
        );
      } catch (streamError) {
        if (seqRef.current !== seq) return;
        if (streamError instanceof DOMException && streamError.name === 'AbortError') return;
        setError(describeError(streamError));
      } finally {
        await finishStream(runIdRef.current, seq);
      }
    },
    [conversationId, connectionId, finishStream],
  );

  const approve = useCallback(
    async (step: AgentStep) => {
      if (run == null) return;
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = seqRef.current + 1;
      seqRef.current = seq;
      setError(null);
      setStreaming(true);
      try {
        await approveAgentStep(
          run.id,
          step.id,
          step.sqlVersion,
          {
            onEvent: (event, data) => {
              if (seqRef.current === seq) setRun((current) => applyEvent(current, event, data));
            },
          },
          controller.signal,
        );
      } catch (streamError) {
        if (seqRef.current !== seq) return;
        if (streamError instanceof DOMException && streamError.name === 'AbortError') return;
        setError(describeError(streamError));
      } finally {
        await finishStream(run.id, seq);
      }
    },
    [run, finishStream],
  );

  const reject = useCallback(
    async (step: AgentStep) => {
      if (run == null) return;
      try {
        await rejectAgentStep(run.id, step.id);
        setRun(await fetchAgentRun(run.id));
        settledRef.current?.();
      } catch (actionError) {
        setError(describeError(actionError));
      }
    },
    [run],
  );

  const cancel = useCallback(async () => {
    if (run == null) return;
    try {
      await cancelAgentRun(run.id);
      setRun(await fetchAgentRun(run.id));
      settledRef.current?.();
    } catch (actionError) {
      setError(describeError(actionError));
    }
  }, [run]);

  return {
    run,
    loading,
    streaming,
    error,
    canStart: conversationId != null && connectionId != null,
    active: run != null && ACTIVE_STATUS.includes(run.status),
    start,
    approve,
    reject,
    cancel,
    reload,
  };
}
