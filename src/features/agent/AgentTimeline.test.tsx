import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentTimeline } from './AgentTimeline';
import type { AgentRun, SqlCandidateSummary } from '../../api/contract';

const NOW = '2026-10-19T12:00:00';

function run(overrides: Partial<AgentRun> = {}): AgentRun {
  return {
    id: 5,
    conversationId: 7,
    connectionId: 10,
    connectionName: 'A 商店库',
    question: '先统计每月订单数，再找出峰值月份',
    status: 'WAITING_APPROVAL',
    route: 'COMPLEX',
    roleActivities: [{ role: 'MANAGER', status: 'DONE' }],
    knowledgeSources: [],
    llmCallCount: 1,
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
        agentRole: 'SQL_AGENT',
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
    ...overrides,
  };
}

describe('AgentTimeline（P14-ARCH-01 Graph 与 Worker）', () => {
  it('展示真实 Graph 线程摘要与 Worker 阶段（不显示思考内容）', () => {
    render(
      <AgentTimeline
        run={run({
          threadId: '1f2c9b7e-4d55-4a2f-9f1a-0b7c3d5e6f70',
          steps: [
            {
              ...run().steps[0],
              status: 'RUNNING',
              worker: { role: 'DATA_SCIENTIST', phase: 'acting', attemptId: 'attempt-1', attempt: 2 },
            },
          ],
        })}
        loading={false}
        streaming={false}
        error={null}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
        onReload={vi.fn()}
      />,
    );

    // threadId 只截断展示，不作为任何操作入口。
    expect(screen.getByText(/Graph 线程 1f2c9b7e…/)).toBeInTheDocument();
    // Worker 阶段与有界尝试次数真实可见；不存在任何"思考内容"文本。
    expect(screen.getByText('Act（第 2 次尝试）')).toBeInTheDocument();
  });
});

describe('AgentTimeline', () => {
  it('待确认步骤展示 SQL 版本与确认按钮，并回传该步骤', async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();
    render(
      <AgentTimeline
        run={run()}
        loading={false}
        streaming={false}
        error={null}
        onApprove={onApprove}
        onReject={vi.fn()}
        onCancel={vi.fn()}
        onReload={vi.fn()}
      />,
    );

    expect(screen.getByText('等待确认')).toBeInTheDocument();
    expect(screen.getByText('SQL v1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认执行 SQL v1' }));
    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ id: 11, sqlVersion: 1 }));
  });

  it('完成态展示真实结果与总结', () => {
    render(
      <AgentTimeline
        run={run({
          status: 'COMPLETED',
          summary: '订单量最高的月份是 9 月。',
          steps: [
            {
              ...run().steps[0],
              status: 'SUCCEEDED',
              rowCount: 3,
              truncated: false,
              resultSummary: '返回 3 行；月份=2026-08; ',
            },
          ],
        })}
        loading={false}
        streaming={false}
        error={null}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
        onReload={vi.fn()}
      />,
    );

    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText(/返回 3 行/)).toBeInTheDocument();
    expect(screen.getByText('订单量最高的月份是 9 月。')).toBeInTheDocument();
  });

  it('没有运行时展示空态而不是伪造进度', () => {
    render(
      <AgentTimeline
        run={null}
        loading={false}
        streaming={false}
        error={null}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
        onReload={vi.fn()}
      />,
    );

    expect(screen.getByText('还没有 Agent 运行')).toBeInTheDocument();
  });

  it('P11 渲染状态图轨迹、上下文压缩元数据和步骤角色', () => {
    render(
      <AgentTimeline
        run={run({
          configResolved: { agentId: 3, agentVersionId: 9, ragEnabled: true, memoryEnabled: false },
          graphNodes: [
            { node: 'ROUTING', status: 'COMPLETED' },
            { node: 'PLANNING', status: 'COMPLETED' },
            { node: 'RUNNING', status: 'STARTED' },
            { node: 'SQL_GENERATION', status: 'STARTED' },
          ],
          contextCompacted: {
            inputTokensEstimate: 1240,
            retainedSources: 3,
            droppedSegments: 0,
            historyBudget: 7739,
            layersUsed: 'L1_RECENT,L2_CONSTRAINT',
            contextHash: 'a1b2c3d4',
          },
          steps: [
            {
              ...run().steps[0],
              agentRole: 'SQL_ANALYST',
            },
          ],
        })}
        loading={false}
        streaming={false}
        error={null}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
        onReload={vi.fn()}
      />,
    );

    // 状态图轨迹节点标签
    expect(screen.getByText('路由')).toBeInTheDocument();
    expect(screen.getByText('规划')).toBeInTheDocument();
    expect(screen.getByText('执行')).toBeInTheDocument();
    expect(screen.getByText('生成 SQL')).toBeInTheDocument();
    // 上下文压缩元数据（不展示用户私有原文）
    expect(screen.getByText('上下文压缩（L1–L4）')).toBeInTheDocument();
    expect(screen.getByText('输入 Token 估算')).toBeInTheDocument();
    expect(screen.getByText('a1b2c3d4')).toBeInTheDocument();
    // Agent 配置摘要
    expect(screen.getByText(/RAG 开/)).toBeInTheDocument();
    // 步骤专业角色徽标
    expect(screen.getByText('数据分析师')).toBeInTheDocument();
  });

  it('P11 展开状态图快照以核对历史恢复数据', async () => {
    const user = userEvent.setup();
    render(
      <AgentTimeline
        run={run({
          graphState: JSON.stringify({ runId: 5, currentNode: 'RUNNING', stateRevision: 7 }),
        })}
        loading={false}
        streaming={false}
        error={null}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
        onReload={vi.fn()}
      />,
    );

    expect(screen.getByText('状态图快照（历史恢复 / P1129）')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /状态图快照/ }));
    expect(screen.getByText(/"stateRevision": 7/)).toBeInTheDocument();
  });

  it('P14-B 展示多候选选优摘要且不影响确认按钮', async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();
    const candidateSummary: SqlCandidateSummary = {
      mode: 'MULTI',
      totalCandidates: 3,
      validCandidates: 2,
      selectedCandidateIndex: 2,
      ruleScore: 0.987,
      llmScore: 0.9,
      compositeScore: 0.924,
      ruleFallback: false,
    };
    render(
      <AgentTimeline
        run={run({ steps: [{ ...run().steps[0], candidateSummary }] })}
        loading={false}
        streaming={false}
        error={null}
        onApprove={onApprove}
        onReject={vi.fn()}
        onCancel={vi.fn()}
        onReload={vi.fn()}
      />,
    );

    expect(screen.getByText(/候选 SQL 3 条 \/ 合法 2 条/)).toBeInTheDocument();
    expect(screen.getByText(/规则 \+ 模型选优/)).toBeInTheDocument();
    expect(screen.getByText(/选中 #2，综合分 0\.924/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认执行 SQL v1' }));
    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ id: 11, sqlVersion: 1 }));
  });

  it('P14-B 评分不可用时展示规则降级说明', () => {
    const candidateSummary: SqlCandidateSummary = {
      mode: 'MULTI',
      totalCandidates: 3,
      validCandidates: 1,
      selectedCandidateIndex: 1,
      ruleScore: 0.87,
      llmScore: 0.87,
      compositeScore: 0.87,
      ruleFallback: true,
    };
    render(
      <AgentTimeline
        run={run({ steps: [{ ...run().steps[0], candidateSummary }] })}
        loading={false}
        streaming={false}
        error={null}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
        onReload={vi.fn()}
      />,
    );

    expect(screen.getByText(/候选 SQL 3 条 \/ 合法 1 条/)).toBeInTheDocument();
    expect(screen.getByText(/评分不可用，按规则选优/)).toBeInTheDocument();
    expect(screen.queryByText(/规则 \+ 模型选优/)).not.toBeInTheDocument();
  });

  it('P14-B 单路径不展示候选摘要', () => {
    const candidateSummary: SqlCandidateSummary = {
      mode: 'SINGLE',
      totalCandidates: 1,
      validCandidates: 1,
      selectedCandidateIndex: 1,
      ruleScore: 0,
      llmScore: 0,
      compositeScore: 0,
      ruleFallback: false,
    };
    render(
      <AgentTimeline
        run={run({ steps: [{ ...run().steps[0], candidateSummary }] })}
        loading={false}
        streaming={false}
        error={null}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
        onReload={vi.fn()}
      />,
    );

    expect(screen.queryByText(/候选 SQL/)).not.toBeInTheDocument();
  });

  it('P14-C Code 步骤展示真实分析工件入口且无 SQL 确认按钮', async () => {
    const onOpenAnalysis = vi.fn();
    const user = userEvent.setup();
    render(
      <AgentTimeline
        run={run({
          status: 'COMPLETED',
          steps: [
            {
              ...run().steps[0],
              agentRole: 'CODE_ANALYST',
              sql: null,
              status: 'SUCCEEDED',
              rowCount: 42,
              truncated: false,
              resultSummary: '分析运行 #3：引擎 docker，输入 42 行，产出 2 个图表。',
              analysisRunId: 3,
            },
          ],
        })}
        loading={false}
        streaming={false}
        error={null}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
        onReload={vi.fn()}
        onOpenAnalysis={onOpenAnalysis}
      />,
    );

    expect(screen.getByText('代码分析步骤')).toBeInTheDocument();
    expect(screen.getByText('分析运行 #3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /确认执行 SQL/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '查看图表' }));
    expect(onOpenAnalysis).toHaveBeenCalledWith(3);
  });

  it('P14-C Report 步骤展示真实报告入口', async () => {
    const onOpenReport = vi.fn();
    const user = userEvent.setup();
    render(
      <AgentTimeline
        run={run({
          status: 'COMPLETED',
          steps: [
            {
              ...run().steps[0],
              agentRole: 'REPORT_ASSISTANT',
              sql: null,
              status: 'SUCCEEDED',
              resultSummary: '报告《查询最近30天各地区销售额》已生成（#8）',
              reportId: 8,
            },
          ],
        })}
        loading={false}
        streaming={false}
        error={null}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
        onReload={vi.fn()}
        onOpenReport={onOpenReport}
      />,
    );

    expect(screen.getByText('报告步骤')).toBeInTheDocument();
    expect(screen.getByText('报告 #8')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /确认执行 SQL/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '查看报告' }));
    expect(onOpenReport).toHaveBeenCalledWith(8);
  });

  it('P14-C 工件 ID 为空时不渲染假入口按钮', () => {
    render(
      <AgentTimeline
        run={run({
          status: 'COMPLETED',
          steps: [
            {
              ...run().steps[0],
              agentRole: 'CODE_ANALYST',
              sql: null,
              status: 'RUNNING',
              analysisRunId: null,
              reportId: null,
            },
            {
              ...run().steps[0],
              id: 12,
              sequence: 2,
              agentRole: 'REPORT_ASSISTANT',
              sql: null,
              status: 'PENDING',
              analysisRunId: null,
              reportId: null,
            },
          ],
        })}
        loading={false}
        streaming={false}
        error={null}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onCancel={vi.fn()}
        onReload={vi.fn()}
        onOpenAnalysis={vi.fn()}
        onOpenReport={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: '查看图表' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '查看报告' })).not.toBeInTheDocument();
    expect(screen.queryByText(/分析运行 #/)).not.toBeInTheDocument();
    expect(screen.queryByText(/报告 #/)).not.toBeInTheDocument();
  });

  // ------------------------------------------------------------ P14-D 计划审核

  it('P14-D 等待计划审核时展示计划步骤与批准/拒绝按钮', async () => {
    const onDecidePlan = vi.fn();
    const user = userEvent.setup();
    render(
      <AgentTimeline
        run={run({
          status: 'WAITING_PLAN_REVIEW',
          planReview: {
            triggered: true,
            awaiting: true,
            hitlVersion: 2,
            status: 'AWAITING',
            reason: '计划包含跨库聚合',
            rejectionCount: 1,
            remainingRejections: 2,
            autoConfirm: false,
          },
        })}
        loading={false}
        streaming={false}
        error={null}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onDecidePlan={onDecidePlan}
        onCancel={vi.fn()}
        onReload={vi.fn()}
      />,
    );

    expect(screen.getByText('等待计划审核')).toBeInTheDocument();
    expect(screen.getByText('计划需要人工审核')).toBeInTheDocument();
    expect(screen.getByText('版本 v2')).toBeInTheDocument();
    expect(screen.getByText('原因：计划包含跨库聚合')).toBeInTheDocument();
    expect(screen.getByText(/已拒绝 1 \/ 3 次/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /批准并执行计划/ }));
    expect(onDecidePlan).toHaveBeenCalledWith(true, '');
  });

  it('P14-D 拒绝时把用户填写的修改意见回传', async () => {
    const onDecidePlan = vi.fn();
    const user = userEvent.setup();
    render(
      <AgentTimeline
        run={run({
          status: 'WAITING_PLAN_REVIEW',
          planReview: {
            triggered: true,
            awaiting: true,
            hitlVersion: 1,
            status: 'AWAITING',
            reason: '高风险',
            rejectionCount: 0,
            remainingRejections: 3,
            autoConfirm: false,
          },
        })}
        loading={false}
        streaming={false}
        error={null}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onDecidePlan={onDecidePlan}
        onCancel={vi.fn()}
        onReload={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/拒绝时的修改意见/), '改为按月统计');
    await user.click(screen.getByRole('button', { name: /拒绝并重新规划/ }));
    expect(onDecidePlan).toHaveBeenCalledWith(false, '改为按月统计');
  });

  it('P14-D 非等待态（已批准）不渲染审核操作按钮', () => {
    const onDecidePlan = vi.fn();
    render(
      <AgentTimeline
        run={run({
          status: 'RUNNING',
          planReview: {
            triggered: true,
            awaiting: false,
            hitlVersion: 3,
            status: 'APPROVED',
            reason: '',
            rejectionCount: 0,
            remainingRejections: 3,
            autoConfirm: false,
          },
        })}
        loading={false}
        streaming={false}
        error={null}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onDecidePlan={onDecidePlan}
        onCancel={vi.fn()}
        onReload={vi.fn()}
      />,
    );

    expect(screen.queryByText('计划需要人工审核')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /批准并执行计划/ })).not.toBeInTheDocument();
    expect(onDecidePlan).not.toHaveBeenCalled();
  });

  it('P14-D 刷新恢复：详情带等待审核状态时重建审核卡', () => {
    render(
      <AgentTimeline
        run={run({
          status: 'WAITING_PLAN_REVIEW',
          planReview: {
            triggered: true,
            awaiting: true,
            hitlVersion: 5,
            status: 'AWAITING',
            reason: '刷新后仍需审核',
            rejectionCount: 2,
            remainingRejections: 1,
            autoConfirm: false,
          },
        })}
        loading={false}
        streaming={false}
        error={null}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onDecidePlan={vi.fn()}
        onCancel={vi.fn()}
        onReload={vi.fn()}
      />,
    );

    expect(screen.getByText('等待计划审核')).toBeInTheDocument();
    expect(screen.getByText('版本 v5')).toBeInTheDocument();
    expect(screen.getByText(/剩余可拒绝 1 次/)).toBeInTheDocument();
  });

  it('P14-D 流式处理中禁用审核按钮，避免重复提交', () => {
    render(
      <AgentTimeline
        run={run({
          status: 'WAITING_PLAN_REVIEW',
          planReview: {
            triggered: true,
            awaiting: true,
            hitlVersion: 1,
            status: 'AWAITING',
            reason: '风险',
            rejectionCount: 0,
            remainingRejections: 3,
            autoConfirm: false,
          },
        })}
        loading={false}
        streaming={true}
        error={null}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onDecidePlan={vi.fn()}
        onCancel={vi.fn()}
        onReload={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /批准并执行计划/ })).not.toBeInTheDocument();
  });

  it('工具参数修复只展示有界提示，不把「已生成参数」当成功', () => {
    const base = run().steps[0];
    render(
      <AgentTimeline
        run={run({
          status: 'RUNNING',
          steps: [
            {
              ...base,
              id: 21,
              sequence: 1,
              objective: '调用知识库工具检索口径',
              status: 'RUNNING',
              sql: null,
              sqlVersion: 0,
              agentRole: 'TOOL_ASSISTANT',
              repair: { attempt: 1, diagnostic: '缺少必填参数 query' },
            },
          ],
        })}
        loading={false}
        streaming={true}
        error={null}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onDecidePlan={vi.fn()}
        onCancel={vi.fn()}
        onReload={vi.fn()}
      />,
    );

    expect(screen.getByText(/工具参数修复中（第 1 次）/)).toBeInTheDocument();
    expect(screen.getByText(/缺少必填参数 query/)).toBeInTheDocument();
    // 尚无真实工具结果：不得出现成功摘要。
    expect(screen.queryByText('SUCCEEDED')).not.toBeInTheDocument();
  });
});
