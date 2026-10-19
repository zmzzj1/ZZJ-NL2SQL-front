import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryPage } from './HistoryPage';
import type { QueryHistoryItem } from '../api/contract';
import { deleteQueryHistory, fetchQueryHistory, listQueryHistory } from '../api/history';
import type * as HistoryModule from '../api/history';

vi.mock('../features/connections/useConnections', () => ({
  useConnections: () => ({
    connections: [{ id: 1, name: 'A 商店库', engine: 'mysql', database: 'sql_demo_a' }],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock('../api/history', async () => {
  const actual = await vi.importActual<typeof HistoryModule>('../api/history');
  return {
    ...actual,
    listQueryHistory: vi.fn(),
    fetchQueryHistory: vi.fn(),
    deleteQueryHistory: vi.fn(),
  };
});

const listMock = vi.mocked(listQueryHistory);
const fetchMock = vi.mocked(fetchQueryHistory);
const deleteMock = vi.mocked(deleteQueryHistory);

const NOW = '2026-10-19T06:00:00';
const SQL = 'SELECT COUNT(*) AS `订单数` FROM shop_orders';

const SUCCESS_RECORD: QueryHistoryItem = {
  id: 2,
  runId: null,
  stepId: null,
  conversationId: 100,
  connectionId: 1,
  connectionName: 'A 商店库',
  sql: SQL,
  status: 'SUCCESS',
  executedAt: NOW,
  durationMs: 12,
  rowCount: 1,
  truncated: false,
  errorCode: null,
  errorMessage: null,
};

const FAILED_RECORD: QueryHistoryItem = {
  ...SUCCESS_RECORD,
  id: 1,
  sql: 'SELECT * FROM no_such_table',
  status: 'FAILED',
  rowCount: null,
  truncated: null,
  errorCode: 'SQL_EXECUTION_ERROR',
  errorMessage: 'SQL 执行失败，请检查表名、列名与语法',
};

function stubList(items: QueryHistoryItem[], nextCursor: string | null = null) {
  listMock.mockResolvedValue({ items, nextCursor });
  fetchMock.mockImplementation(async (id: number) => {
    const matched = items.find((item) => item.id === id);
    if (!matched) throw new Error(`unexpected history id: ${id}`);
    return matched;
  });
}

describe('HistoryPage 真实查询历史', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteMock.mockResolvedValue(undefined);
  });

  it('加载后端记录并展示成功状态与执行元数据', async () => {
    stubList([SUCCESS_RECORD]);
    render(<HistoryPage fontSize={14} />);

    expect(await screen.findByText('成功')).toBeInTheDocument();
    expect(screen.getAllByText(/A 商店库/).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('12 ms')).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(SUCCESS_RECORD.id);
  });

  it('切换记录时展示失败分类与脱敏错误摘要', async () => {
    stubList([SUCCESS_RECORD, FAILED_RECORD]);
    const user = userEvent.setup();
    render(<HistoryPage fontSize={14} />);

    await screen.findByText('成功');
    await user.click(screen.getByRole('button', { name: /no_such_table/ }));

    expect(await screen.findByText('SQL_EXECUTION_ERROR')).toBeInTheDocument();
    expect(screen.getByText('SQL 执行失败，请检查表名、列名与语法')).toBeInTheDocument();
  });

  it('按数据源筛选时把 connectionId 传给后端', async () => {
    stubList([SUCCESS_RECORD]);
    const user = userEvent.setup();
    render(<HistoryPage fontSize={14} />);

    await screen.findByText('成功');
    await user.selectOptions(screen.getByLabelText('数据源'), '1');

    expect(listMock).toHaveBeenLastCalledWith({ limit: 20, cursor: null, connectionId: 1 });
  });

  it('删除需要二次确认，删除后列表回到空状态', async () => {
    stubList([SUCCESS_RECORD]);
    const user = userEvent.setup();
    render(<HistoryPage fontSize={14} />);

    await user.click(await screen.findByRole('button', { name: '删除记录' }));
    expect(deleteMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '确认删除' }));

    expect(deleteMock).toHaveBeenCalledWith(SUCCESS_RECORD.id);
    expect(await screen.findByText('还没有真实查询记录')).toBeInTheDocument();
  });

  it('没有记录时展示真实空状态而不是演示数据', async () => {
    stubList([]);
    render(<HistoryPage fontSize={14} />);

    expect(await screen.findByText('还没有真实查询记录')).toBeInTheDocument();
    expect(screen.queryByText(/演示/)).not.toBeInTheDocument();
  });
});
