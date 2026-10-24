import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentRun } from './useAgentRun';
import type { AgentRun } from '../../api/contract';

const NOW = '2026-10-19T12:00:00';

const mocks = vi.hoisted(() => ({
  streamAgentRun: vi.fn(),
  fetchAgentRun: vi.fn(),
  fetchLatestAgentRun: vi.fn(),
  approveAgentStep: vi.fn(),
  rejectAgentStep: vi.fn(),
  cancelAgentRun: vi.fn(),
}));

vi.mock('../../api/agent', () => ({
  streamAgentRun: mocks.streamAgentRun,
  fetchAgentRun: mocks.fetchAgentRun,
  fetchLatestAgentRun: mocks.fetchLatestAgentRun,
  approveAgentStep: mocks.approveAgentStep,
  rejectAgentStep: mocks.rejectAgentStep,
  cancelAgentRun: mocks.cancelAgentRun,
}));

/** 服务端详情不返回 candidateSummary（与后端契约一致），用于验证前端合并保留。 */
function serverDetail(): AgentRun {
  return {
    id: 5,
    conversationId: 7,
    connectionId: 10,
    connectionName: 'A 商店库',
    question: '统计每月订单数',
    status: 'WAITING_APPROVAL',
    route: 'COMPLEX',
    roleActivities: [],
    knowledgeSources: [],
    llmCallCount: 4,
    summary: null,
    errorCode: null,
    errorMessage: null,
    createdAt: NOW,
    updatedAt: NOW,
    steps: [
      {
        id: 11,
        sequence: 1,
        objective: '按月统计订单数量',
        dependsOn: null,
        status: 'WAITING_APPROVAL',
        sql: 'SELECT MONTH(created_at) AS m, COUNT(*) FROM shop_orders GROUP BY m',
        sqlVersion: 1,
        agentRole: 'SQL_ANALYST',
        approvalStatus: 'PENDING',
        repairCount: 0,
        rowCount: null,
        truncated: null,
        errorCode: null,
        errorMessage: null,
        resultSummary: null,
        analysisRunId: null,
        reportId: null,
      },
    ],
  };
}

const CANDIDATE_EVENT = {
  stepId: 11,
  mode: 'MULTI',
  totalCandidates: 3,
  validCandidates: 2,
  selectedCandidateIndex: 2,
  ruleScore: 0.987,
  llmScore: 0.9,
  compositeScore: 0.924,
  ruleFallback: false,
};

describe('useAgentRun（P14-B 候选摘要）', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.fetchLatestAgentRun.mockResolvedValue(null);
    mocks.fetchAgentRun.mockResolvedValue(serverDetail());
  });

  it('候选摘要在 SSE 推送后挂到步骤，服务端详情重取后仍保留', async () => {
    mocks.streamAgentRun.mockImplementation(async (_request, handlers) => {
      handlers.onEvent('run.started', { runId: 5 });
      handlers.onEvent('plan.ready', { steps: [{ stepId: 11, sequence: 1, objective: '按月统计订单数量' }] });
      handlers.onEvent('step.started', { stepId: 11 });
      handlers.onEvent('step.sql_candidates_evaluated', CANDIDATE_EVENT);
      handlers.onEvent('step.sql_ready', { stepId: 11, sql: 'SELECT 1', sqlVersion: 1 });
    });

    const { result } = renderHook(() => useAgentRun({ conversationId: 7, connectionId: 10 }));

    await act(async () => {
      await result.current.start('统计每月订单数');
    });

    expect(mocks.fetchAgentRun).toHaveBeenCalledWith(5);
    const step = result.current.run?.steps[0];
    expect(step?.candidateSummary).toEqual({
      mode: 'MULTI',
      totalCandidates: 3,
      validCandidates: 2,
      selectedCandidateIndex: 2,
      ruleScore: 0.987,
      llmScore: 0.9,
      compositeScore: 0.924,
      ruleFallback: false,
    });
    // 合并只补摘要，不覆盖服务端权威字段。
    expect(step?.status).toBe('WAITING_APPROVAL');
    expect(step?.sqlVersion).toBe(1);
  });

  it('修复事件清除候选摘要，避免修复版 SQL 沿用竞赛说明', async () => {
    mocks.streamAgentRun.mockImplementation(async (_request, handlers) => {
      handlers.onEvent('run.started', { runId: 5 });
      handlers.onEvent('plan.ready', { steps: [{ stepId: 11, sequence: 1, objective: '按月统计订单数量' }] });
      handlers.onEvent('step.sql_candidates_evaluated', CANDIDATE_EVENT);
      handlers.onEvent('step.sql_ready', { stepId: 11, sql: 'SELECT 1', sqlVersion: 1 });
      handlers.onEvent('step.repairing', { stepId: 11, attempt: 1 });
    });

    const { result } = renderHook(() => useAgentRun({ conversationId: 7, connectionId: 10 }));

    await act(async () => {
      await result.current.start('统计每月订单数');
    });

    expect(result.current.run?.steps[0]?.candidateSummary ?? null).toBeNull();
  });
});

describe('useAgentRun（P14-C Code/Report 工件事件）', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.fetchLatestAgentRun.mockResolvedValue(null);
    mocks.fetchAgentRun.mockResolvedValue(serverDetail());
  });

  it('analysis.succeeded 后步骤挂上真实 analysisRunId，且详情重取后保留', async () => {
    mocks.streamAgentRun.mockImplementation(async (_request, handlers) => {
      handlers.onEvent('run.started', { runId: 5 });
      handlers.onEvent('plan.ready', {
        steps: [
          { stepId: 11, sequence: 1, objective: '按月统计订单数量' },
          { stepId: 12, sequence: 2, objective: '分析趋势并生成图表' },
        ],
      });
      handlers.onEvent('step.sql_ready', { stepId: 11, sql: 'SELECT 1', sqlVersion: 1 });
      handlers.onEvent('step.succeeded', { stepId: 11, rowCount: 3, truncated: false, summary: '返回 3 行' });
      handlers.onEvent('step.started', { stepId: 12 });
      handlers.onEvent('analysis.started', { runId: 5, stepId: 12, role: 'CODE_ANALYST' });
      handlers.onEvent('analysis.succeeded', {
        runId: 5,
        stepId: 12,
        analysisRunId: 3,
        chartCount: 2,
        summary: '分析运行 #3',
        durationMs: 820,
      });
      handlers.onEvent('step.succeeded', { stepId: 12, rowCount: 3, truncated: false, summary: '分析完成' });
      handlers.onEvent('report.ready', { runId: 5, stepId: 12, reportId: 8, title: '月度订单分析报告' });
      handlers.onEvent('run.completed', { runId: 5, summary: '完成' });
    });
    mocks.fetchAgentRun.mockResolvedValue({
      ...serverDetail(),
      status: 'COMPLETED',
      summary: '完成',
      steps: [
        {
          ...serverDetail().steps[0],
          status: 'SUCCEEDED',
          rowCount: 3,
          truncated: false,
          resultSummary: '返回 3 行',
        },
        {
          ...serverDetail().steps[0],
          id: 12,
          sequence: 2,
          agentRole: 'CODE_ANALYST',
          status: 'SUCCEEDED',
          resultSummary: '分析完成',
          analysisRunId: 3,
        },
      ],
    });

    const { result } = renderHook(() => useAgentRun({ conversationId: 7, connectionId: 10 }));

    await act(async () => {
      await result.current.start('统计每月订单数并分析趋势');
    });

    // 乐观更新：SSE 事件即时挂上真实工件 ID。
    const streamed = result.current.run?.steps[1];
    expect(streamed?.analysisRunId).toBe(3);
    expect(streamed?.status).toBe('SUCCEEDED');
    // 详情重取后仍保留（服务端 DTO 真实返回 analysisRunId）。
    expect(result.current.run?.steps[1]?.analysisRunId).toBe(3);
    expect(result.current.run?.status).toBe('COMPLETED');
  });

  it('report.ready 后步骤挂上真实 reportId，且详情重取后保留', async () => {
    mocks.streamAgentRun.mockImplementation(async (_request, handlers) => {
      handlers.onEvent('run.started', { runId: 5 });
      handlers.onEvent('plan.ready', {
        steps: [
          { stepId: 11, sequence: 1, objective: '统计销售额' },
          { stepId: 12, sequence: 2, objective: '分析趋势' },
          { stepId: 13, sequence: 3, objective: '生成报告' },
        ],
      });
      handlers.onEvent('step.succeeded', { stepId: 11, rowCount: 3, truncated: false, summary: '返回 3 行' });
      handlers.onEvent('step.succeeded', { stepId: 12, rowCount: 3, truncated: false, summary: '分析完成' });
      handlers.onEvent('step.started', { stepId: 13 });
      handlers.onEvent('report.ready', { runId: 5, stepId: 13, reportId: 8, title: '销售分析报告' });
      handlers.onEvent('step.succeeded', { stepId: 13, rowCount: 3, truncated: false, summary: '报告已生成' });
      handlers.onEvent('run.completed', { runId: 5, summary: '完成' });
    });
    mocks.fetchAgentRun.mockResolvedValue({
      ...serverDetail(),
      status: 'COMPLETED',
      summary: '完成',
      steps: [
        { ...serverDetail().steps[0], status: 'SUCCEEDED', resultSummary: '返回 3 行' },
        { ...serverDetail().steps[0], id: 12, sequence: 2, agentRole: 'CODE_ANALYST', status: 'SUCCEEDED' },
        {
          ...serverDetail().steps[0],
          id: 13,
          sequence: 3,
          agentRole: 'REPORT_ASSISTANT',
          status: 'SUCCEEDED',
          resultSummary: '报告已生成',
          reportId: 8,
        },
      ],
    });

    const { result } = renderHook(() => useAgentRun({ conversationId: 7, connectionId: 10 }));

    await act(async () => {
      await result.current.start('统计销售额并生成报告');
    });

    expect(result.current.run?.steps[2]?.reportId).toBe(8);
    expect(result.current.run?.steps[2]?.status).toBe('SUCCEEDED');
  });

  it('analysis.failed 在步骤上留下真实失败原因，不冒充成功', async () => {
    mocks.streamAgentRun.mockImplementation(async (_request, handlers) => {
      handlers.onEvent('run.started', { runId: 5 });
      handlers.onEvent('plan.ready', {
        steps: [{ stepId: 12, sequence: 1, objective: '分析趋势并生成图表' }],
      });
      handlers.onEvent('step.started', { stepId: 12 });
      handlers.onEvent('analysis.started', { runId: 5, stepId: 12, role: 'CODE_ANALYST' });
      handlers.onEvent('analysis.failed', {
        runId: 5,
        stepId: 12,
        code: 'ANALYSIS_EXECUTION_ERROR',
        message: 'Python 分析执行失败',
      });
      handlers.onEvent('step.failed', { stepId: 12, code: 'ANALYSIS_EXECUTION_ERROR', message: 'Python 分析执行失败' });
    });
    // 详情重取后服务端同样返回失败事实与缺失的工件 ID。
    mocks.fetchAgentRun.mockResolvedValue({
      ...serverDetail(),
      status: 'FAILED',
      steps: [
        {
          ...serverDetail().steps[0],
          id: 12,
          sequence: 1,
          agentRole: 'CODE_ANALYST',
          sql: null,
          status: 'FAILED',
          errorCode: 'ANALYSIS_EXECUTION_ERROR',
          errorMessage: 'Python 分析执行失败',
        },
      ],
    });

    const { result } = renderHook(() => useAgentRun({ conversationId: 7, connectionId: 10 }));

    await act(async () => {
      await result.current.start('分析趋势');
    });

    const step = result.current.run?.steps[0];
    expect(step?.id).toBe(12);
    expect(step?.analysisRunId ?? null).toBeNull();
    expect(step?.errorCode).toBe('ANALYSIS_EXECUTION_ERROR');
    expect(step?.errorMessage).toBe('Python 分析执行失败');
  });
});

describe('useAgentRun（P14-ARCH-01 Graph threadId 与 Worker 阶段）', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.fetchLatestAgentRun.mockResolvedValue(null);
    mocks.fetchAgentRun.mockResolvedValue(serverDetail());
  });

  it('run.started 携带真实 Graph threadId 并进入运行状态', async () => {
    mocks.streamAgentRun.mockImplementation(async (_request, handlers) => {
      handlers.onEvent('run.started', { runId: 5, conversationId: 7, threadId: 'thread-arch-01' });
      handlers.onEvent('node.started', { runId: 5, node: 'MANAGER', revision: '2' });
      handlers.onEvent('run.completed', { runId: 5, summary: '完成' });
    });

    const { result } = renderHook(() => useAgentRun({ conversationId: 7, connectionId: 10 }));

    await act(async () => {
      await result.current.start('统计订单数');
    });

    // threadId 只做展示与日志关联：不得用于自行恢复或绕过服务端鉴权。
    expect(result.current.run?.threadId).toBe('thread-arch-01');
  });

  it('worker.thinking 只记录真实阶段与有界尝试次数，不产生思考内容', async () => {
    mocks.streamAgentRun.mockImplementation(async (_request, handlers) => {
      handlers.onEvent('run.started', { runId: 5, threadId: 'thread-arch-01' });
      handlers.onEvent('plan.ready', { steps: [{ stepId: 11, sequence: 1, objective: '按月统计订单数量' }] });
      handlers.onEvent('worker.thinking', {
        runId: 5,
        stepId: 11,
        role: 'DATA_SCIENTIST',
        phase: 'acting',
        attemptId: 'attempt-1',
        attempt: 2,
      });
      handlers.onEvent('step.succeeded', { stepId: 11, rowCount: 1, truncated: false, summary: '返回 1 行' });
    });

    const { result } = renderHook(() => useAgentRun({ conversationId: 7, connectionId: 10 }));

    await act(async () => {
      await result.current.start('统计订单数');
    });

    const worker = result.current.run?.steps[0]?.worker;
    expect(worker).toEqual({ role: 'DATA_SCIENTIST', phase: 'acting', attemptId: 'attempt-1', attempt: 2 });
  });
});
