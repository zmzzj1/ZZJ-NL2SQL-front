import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkflowPage } from './WorkflowPage';
import { listWorkflows, createWorkflow, updateWorkflow } from '../api/workflow';
import { listConnections } from '../api/connections';
import type { Connection, Workflow } from '../api/contract';
import type * as WorkflowModule from '../api/workflow';
import type * as ConnectionsModule from '../api/connections';
import type * as ScheduleModule from '../api/schedule';

vi.mock('../api/workflow', async () => {
  const actual = await vi.importActual<typeof WorkflowModule>('../api/workflow');
  return {
    ...actual,
    listWorkflows: vi.fn(),
    createWorkflow: vi.fn(),
    updateWorkflow: vi.fn(),
    streamRunWorkflow: vi.fn(),
    approveWorkflowNode: vi.fn(),
    fetchWorkflowRun: vi.fn(),
  };
});

vi.mock('../api/connections', async () => {
  const actual = await vi.importActual<typeof ConnectionsModule>('../api/connections');
  return {
    ...actual,
    listConnections: vi.fn(),
  };
});

vi.mock('../api/schedule', async () => {
  const actual = await vi.importActual<typeof ScheduleModule>('../api/schedule');
  return {
    ...actual,
    listSchedules: vi.fn().mockResolvedValue([]),
    previewSchedule: vi.fn().mockResolvedValue([]),
    listScheduleOccurrences: vi.fn().mockResolvedValue([]),
  };
});

const listWorkflowsMock = vi.mocked(listWorkflows);
const createWorkflowMock = vi.mocked(createWorkflow);
const updateWorkflowMock = vi.mocked(updateWorkflow);
const listConnectionsMock = vi.mocked(listConnections);

const CONNECTION: Connection = {
  id: 1,
  name: 'A 商店库',
  engine: 'mysql',
  host: '127.0.0.1',
  port: 3306,
  database: 'sql_demo_a',
  username: 'demo_a_reader',
  hasPassword: true,
};

const WORKFLOW: Workflow = {
  id: 9,
  name: '销售分析',
  description: null,
  revision: 3,
  status: 'ACTIVE',
  createdAt: '2026-10-20T00:00:00',
  updatedAt: '2026-10-20T00:00:00',
  definition: {
    nodes: [
      { id: 'start', type: 'START', label: '开始' },
      { id: 'sql', type: 'SQL_AGENT', label: 'SQL Agent' },
      { id: 'end', type: 'END', label: '结束' },
    ],
    edges: [
      { from: 'start', to: 'sql' },
      { from: 'sql', to: 'end' },
    ],
  },
};

describe('WorkflowPage 编辑分支', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listConnectionsMock.mockResolvedValue([CONNECTION]);
    listWorkflowsMock.mockResolvedValue([WORKFLOW]);
  });

  it('编辑已有工作流时用 updateWorkflow 携带 revision 更新，而不是新建', async () => {
    updateWorkflowMock.mockResolvedValue({ ...WORKFLOW, revision: 4 });
    const user = userEvent.setup();
    render(<WorkflowPage />);

    // 点击列表中的工作流进入编辑
    const item = await screen.findByText('销售分析');
    await user.click(item);

    await user.click(screen.getByRole('button', { name: /保存/ }));

    expect(await screen.findByText('销售分析')).toBeInTheDocument();
    expect(updateWorkflowMock).toHaveBeenCalledWith(9, 3, expect.objectContaining({ name: '销售分析' }));
    expect(createWorkflowMock).not.toHaveBeenCalled();
  });

  it('无编辑对象时保存走新建分支', async () => {
    createWorkflowMock.mockResolvedValue({ ...WORKFLOW, id: 10, revision: 1 });
    const user = userEvent.setup();
    render(<WorkflowPage />);

    await screen.findByText('销售分析');
    await user.click(screen.getByRole('button', { name: /保存/ }));

    expect(createWorkflowMock).toHaveBeenCalledWith(expect.objectContaining({ name: '分析工作流' }));
    expect(updateWorkflowMock).not.toHaveBeenCalled();
  });
});
