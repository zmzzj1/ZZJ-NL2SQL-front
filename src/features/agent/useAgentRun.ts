import { useCallback, useEffect, useRef, useState } from 'react';
import {
  approveAgentStep,
  cancelAgentRun,
  fetchAgentRun,
  fetchLatestAgentRun,
  rejectAgentStep,
  streamAgentRun,
  streamPlanDecision,
} from '../../api/agent';
import type { AgentEventPayload } from '../../api/agent';
import type {
  AgentConfigResolved,
  AgentRun,
  AgentStep,
  GraphNodeName,
  GraphNodeState,
  GraphNodeStatus,
  KnowledgeSourceRef,
  PlanReviewStep,
  PlanReviewView,
  AgentRoute,
  AgentRunStatus,
  ContextCompactedMeta,
  SqlCandidateSummary,
  ToolInvocationRequest,
} from '../../api/contract';
import { describeError } from '../../api/http';

const ACTIVE_STATUS: AgentRunStatus[] = [
  'PLANNING',
  'WAITING_APPROVAL',
  'RUNNING',
  'CLARIFYING',
  'WAITING_PLAN_REVIEW',
];

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
  /**
   * P14-D：计划级审核模式。false=复杂计划生成后由 Gate 判断是否需人工审核；
   * 缺省/true=跳过计划级审核（**不**跳过 SQL 逐版本确认）。
   */
  autoConfirm?: boolean;
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
    planReview: null,
  };
}

function patchStep(run: AgentRun, stepId: number, patch: Partial<AgentStep>): AgentRun {
  return {
    ...run,
    steps: run.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
  };
}

/** P14-B：解析 step.sql_candidates_evaluated 的脱敏摘要（字段缺失时按 0 回退，不抛错）。 */
function toCandidateSummary(data: AgentEventPayload): SqlCandidateSummary {
  return {
    mode: data.mode === 'SINGLE' ? 'SINGLE' : 'MULTI',
    totalCandidates: Number(data.totalCandidates ?? 0),
    validCandidates: Number(data.validCandidates ?? 0),
    selectedCandidateIndex: Number(data.selectedCandidateIndex ?? 0),
    ruleScore: Number(data.ruleScore ?? 0),
    llmScore: Number(data.llmScore ?? 0),
    compositeScore: Number(data.compositeScore ?? 0),
    ruleFallback: Boolean(data.ruleFallback),
  };
}

/**
 * P14-B：服务端详情不返回候选摘要，流结束后重新拉取会把摘要冲掉。
 * 这里用会话内暂存把摘要合并回步骤，使等待审批期间仍可见一行选优说明。
 */
function mergeCandidateSummaries(run: AgentRun, summaries: Map<number, SqlCandidateSummary>): AgentRun {
  if (summaries.size === 0) return run;
  let changed = false;
  const steps = run.steps.map((step) => {
    const summary = summaries.get(step.id);
    if (summary && !step.candidateSummary) {
      changed = true;
      return { ...step, candidateSummary: summary };
    }
    return step;
  });
  return changed ? { ...run, steps } : run;
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

/** P14-D：计划审核视图的初始形状（仅在首次收到审核事件时用于展开字段）。 */
function emptyPlanReview(): PlanReviewView {
  return {
    triggered: false,
    awaiting: false,
    hitlVersion: 0,
    status: null,
    reason: '',
    rejectionCount: 0,
    remainingRejections: 3,
    autoConfirm: true,
  };
}

/**
 * P14-D：把 SSE 步骤摘要映射为可展示的步骤。事件缺失 steps 时保留当前已渲染的步骤，
 * 避免刷新/重连瞬间把审核卡清空。
 */
function toReviewSteps(raw: unknown, current: AgentStep[]): AgentStep[] {
  if (!Array.isArray(raw)) return current;
  const steps = raw.map((item) => item as PlanReviewStep);
  if (steps.length === 0) return current;
  return steps.map((step) => ({
    id: step.stepId,
    sequence: step.sequence,
    objective: step.objective,
    dependsOn: step.dependsOn ?? null,
    status: 'PENDING',
    sql: null,
    sqlVersion: 0,
    agentRole: step.role ?? null,
    approvalStatus: 'PENDING',
    repairCount: 0,
    rowCount: null,
    truncated: null,
    errorCode: null,
    errorMessage: null,
    resultSummary: null,
    analysisRunId: null,
    reportId: null,
  }));
}

/** 后端 GET /runs/{id} 返回的 planReview 线格式（与 SSE 事件字段不同）。 */
interface PlanReviewWire {
  required?: boolean;
  status?: string | null;
  hitlVersion?: number;
  reason?: string;
  rejectionCount?: number;
  autoConfirm?: boolean;
}

/**
 * P14-D：把详情接口的计划审核视图归一化为前端可操作视图。
 * 只有 Run 真正处于 WAITING_PLAN_REVIEW 且状态为 AWAITING 时才允许提交决定，
 * 避免已取消/已终结的 Run 在刷新后显示可点的假批准按钮。
 */
export function normalizePlanReview(raw: PlanReviewView | null | undefined, runStatus: string): PlanReviewView | null {
  if (raw == null) return null;
  const wire = raw as unknown as PlanReviewWire;
  const status = wire.status ?? null;
  const rejectionCount = Number(wire.rejectionCount ?? 0);
  return {
    triggered: wire.required === true || status != null,
    awaiting: runStatus === 'WAITING_PLAN_REVIEW' && status === 'AWAITING',
    hitlVersion: Number(wire.hitlVersion ?? 0),
    status,
    reason: wire.reason ?? '',
    rejectionCount,
    remainingRejections: Math.max(0, 3 - rejectionCount),
    autoConfirm: wire.autoConfirm === true,
  };
}

/** 详情接口返回值进入前端状态前先归一化计划审核视图。 */
function adoptRun(run: AgentRun): AgentRun {
  return { ...run, planReview: normalizePlanReview(run.planReview, run.status) };
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
          analysisRunId: null,
          reportId: null,
        };
      });
      return { ...run, steps };
    }
    case 'step.started':
      return patchStep(run, Number(data.stepId), { status: 'RUNNING' });
    // P14-B：多候选选优摘要（在 step.sql_ready 之前，仅 MULTI 路由推送）。
    case 'step.sql_candidates_evaluated':
      return patchStep(run, Number(data.stepId), { candidateSummary: toCandidateSummary(data) });
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
        // P14-B：修复后的 SQL 不再是候选竞赛的产物，清掉过期摘要。
        candidateSummary: null,
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
    // P14-C：Python 沙箱分析生命周期（真实工件落库后才发 succeeded）。
    case 'analysis.started':
      return patchStep(run, Number(data.stepId), { status: 'RUNNING' });
    case 'analysis.succeeded':
      return patchStep(run, Number(data.stepId), {
        analysisRunId: Number(data.analysisRunId ?? 0) || null,
      });
    case 'analysis.failed':
      return patchStep(run, Number(data.stepId), {
        errorCode: (data.code as AgentStep['errorCode']) ?? 'ANALYSIS_EXECUTION_ERROR',
        errorMessage: String(data.message ?? ''),
      });
    // P14-C：报告工件就绪（reportId 供详情恢复与前端入口使用）。
    case 'report.ready':
      return patchStep(run, Number(data.stepId), {
        reportId: Number(data.reportId ?? 0) || null,
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
    // P14-D：计划级风险 Gate 评估结果（无论是否需要审核都如实推送）。
    case 'plan.review_evaluated':
      return {
        ...run,
        planReview: {
          ...(run.planReview ?? emptyPlanReview()),
          triggered: true,
          status: data.required === true ? 'AWAITING' : 'NOT_REQUIRED',
          reason: String(data.reasonCode ?? ''),
        },
      };
    // P14-D：进入等待人工审核。计划已落盘，刷新后可原样恢复审核卡。
    case 'plan.review_required': {
      const hitlVersion = Number(data.hitlVersion ?? 0);
      const rejectionCount = Number(data.rejectionCount ?? 0);
      return {
        ...run,
        status: 'WAITING_PLAN_REVIEW',
        steps: toReviewSteps(data.steps, run.steps),
        planReview: {
          triggered: true,
          awaiting: true,
          hitlVersion,
          status: 'AWAITING',
          reason: String(data.reason ?? ''),
          rejectionCount,
          remainingRejections: Math.max(0, 3 - rejectionCount),
          autoConfirm: false,
        },
      };
    }
    // P14-D：服务端已领取审核决定；等待中的卡片立即退出可操作态，避免重复提交。
    case 'plan.review_decided':
      return {
        ...run,
        planReview:
          run.planReview == null
            ? run.planReview
            : {
                ...run.planReview,
                awaiting: false,
                hitlVersion: Number(data.hitlVersion ?? run.planReview.hitlVersion),
                rejectionCount: Number(data.rejectionCount ?? run.planReview.rejectionCount),
                status: data.approved === true ? 'APPROVED' : 'REPLAN_REQUIRED',
              },
      };
    // P14-D：拒绝后已重新规划，展示新计划版本并继续等待审核。
    case 'plan.replanned': {
      const hitlVersion = Number(data.newHitlVersion ?? 0);
      const rejectionCount = Number(data.rejectionCount ?? 0);
      return {
        ...run,
        status: 'WAITING_PLAN_REVIEW',
        steps: toReviewSteps(data.steps, run.steps),
        planReview: {
          triggered: true,
          awaiting: true,
          hitlVersion,
          status: 'AWAITING',
          reason: '',
          rejectionCount,
          remainingRejections: Math.max(0, 3 - rejectionCount),
          autoConfirm: false,
        },
      };
    }
    // P14-D：审核无法继续（刷新后运行已终结或版本冲突），如实显示服务端错误。
    case 'plan.review_failed':
      return {
        ...run,
        status: 'FAILED',
        errorCode: (data.code as AgentRun['errorCode']) ?? 'AGENT_STATE_CONFLICT',
        errorMessage: String(data.message ?? ''),
        planReview: run.planReview == null ? null : { ...run.planReview, awaiting: false },
      };
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
  /** P14-B：会话内暂存的候选选优摘要（按 stepId），供服务端详情重取后合并保留。 */
  const candidateSummariesRef = useRef<Map<number, SqlCandidateSummary>>(new Map());

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
      setRun(latest == null ? null : mergeCandidateSummaries(adoptRun(latest), candidateSummariesRef.current));
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
    candidateSummariesRef.current.clear();
    void reload();
  }, [conversationId, reload]);

  const finishStream = useCallback(async (runId: number | null, seq: number) => {
    // 先拉取权威详情再结束 streaming：避免按钮在 run.id 尚未写入时被点击。
    if (runId != null && seqRef.current === seq) {
      try {
        const detail = await fetchAgentRun(runId);
        if (seqRef.current === seq) setRun(mergeCandidateSummaries(adoptRun(detail), candidateSummariesRef.current));
      } catch (loadError) {
        if (seqRef.current === seq) setError(describeError(loadError));
      }
    }
    setStreaming(false);
    settledRef.current?.();
  }, []);

  /** 流式事件统一入口：暂存 P14-B 摘要并套用状态变更。 */
  const handleStreamEvent = useCallback((event: string, data: AgentEventPayload, seq: number) => {
    if (seqRef.current !== seq) return;
    if (event === 'step.sql_candidates_evaluated') {
      candidateSummariesRef.current.set(Number(data.stepId), toCandidateSummary(data));
    }
    if (event === 'step.repairing') {
      candidateSummariesRef.current.delete(Number(data.stepId));
    }
    setRun((current) => applyEvent(current, event, data));
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
      candidateSummariesRef.current.clear();
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
            ...(options?.autoConfirm === false ? { autoConfirm: false } : {}),
          },
          {
            onEvent: (event, data) => {
              if (seqRef.current !== seq) return;
              if (event === 'run.started') {
                runIdRef.current = Number(data.runId);
              }
              handleStreamEvent(event, data, seq);
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
    [conversationId, connectionId, finishStream, handleStreamEvent],
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
            onEvent: (event, data) => handleStreamEvent(event, data, seq),
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
    [run, finishStream, handleStreamEvent],
  );

  const reject = useCallback(
    async (step: AgentStep) => {
      if (run == null) return;
      try {
        await rejectAgentStep(run.id, step.id);
        const detail = await fetchAgentRun(run.id);
        setRun(mergeCandidateSummaries(adoptRun(detail), candidateSummariesRef.current));
        settledRef.current?.();
      } catch (actionError) {
        setError(describeError(actionError));
      }
    },
    [run],
  );

  /**
   * P14-D：提交计划级审核决定（批准/拒绝）。
   *
   * <p>{@code hitlVersion} 必须取自服务端返回的当前待审核版本（刷新恢复时来自详情接口），
   * 前端不自行推断；重复提交或版本冲突由服务端一次性领取拒绝，不会二次执行计划。
   */
  const decidePlan = useCallback(
    async (approved: boolean, feedback?: string) => {
      if (run == null) return;
      const hitlVersion = run.planReview?.hitlVersion;
      if (hitlVersion == null) {
        setError('当前运行没有待审核的计划');
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = seqRef.current + 1;
      seqRef.current = seq;
      setError(null);
      setStreaming(true);
      // 先乐观退出等待态：服务端确认后若重规划会再次进入等待（plan.replanned）。
      setRun((current) =>
        current?.planReview == null ? current : { ...current, planReview: { ...current.planReview, awaiting: false } },
      );
      try {
        await streamPlanDecision(
          run.id,
          {
            approved,
            ...(approved ? {} : { feedback: feedback ?? null }),
            hitlVersion,
          },
          {
            onEvent: (event, data) => handleStreamEvent(event, data, seq),
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
    [run, finishStream, handleStreamEvent],
  );

  const cancel = useCallback(async () => {
    if (run == null) return;
    try {
      await cancelAgentRun(run.id);
      const detail = await fetchAgentRun(run.id);
      setRun(mergeCandidateSummaries(adoptRun(detail), candidateSummariesRef.current));
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
    decidePlan,
    cancel,
    reload,
  };
}
