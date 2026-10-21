import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SqlConsolePage } from './SqlConsolePage';
import { listConnections } from '../api/connections';
import { fetchConnectionSchema } from '../api/connections';
import { executeSql } from '../api/sql';
import type { Connection, SchemaResponse } from '../api/contract';
import type * as ConnectionsModule from '../api/connections';
import type * as SqlModule from '../api/sql';

vi.mock('../api/connections', async () => {
  const actual = await vi.importActual<typeof ConnectionsModule>('../api/connections');
  return {
    ...actual,
    listConnections: vi.fn(),
    fetchConnectionSchema: vi.fn(),
  };
});

vi.mock('../api/sql', async () => {
  const actual = await vi.importActual<typeof SqlModule>('../api/sql');
  return {
    ...actual,
    executeSql: vi.fn(),
  };
});

const listMock = vi.mocked(listConnections);
const schemaMock = vi.mocked(fetchConnectionSchema);
const executeMock = vi.mocked(executeSql);

const CONNECTION_A: Connection = {
  id: 1,
  name: 'A 商店库',
  engine: 'mysql',
  host: '127.0.0.1',
  port: 3306,
  database: 'sql_demo_a',
  username: 'demo_a_reader',
  hasPassword: true,
};

const CONNECTION_B: Connection = {
  ...CONNECTION_A,
  id: 2,
  name: 'B 博客库',
  database: 'sql_demo_b',
  username: 'demo_b_reader',
};

const SCHEMA: SchemaResponse = {
  database: 'sql_demo_a',
  tables: [
    {
      name: 'shop_orders',
      columns: [
        { name: 'id', type: 'INT', nullable: false },
        { name: 'amount', type: 'DECIMAL', nullable: true },
      ],
    },
  ],
};

async function renderPage(connections: Connection[] = [CONNECTION_A, CONNECTION_B]) {
  listMock.mockResolvedValue(connections);
  schemaMock.mockResolvedValue(SCHEMA);
  const user = userEvent.setup();
  render(<SqlConsolePage />);
  await screen.findByLabelText('数据源');
  return user;
}

describe('SqlConsolePage 多标签 SQL 工作台', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('加载后展示数据源与默认标签', async () => {
    await renderPage();
    expect(screen.getByLabelText('数据源')).toBeInTheDocument();
    expect(screen.getByText('查询 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /执行查询/ })).toBeDisabled();
  });

  it('执行只读 SQL 调用 executeSql 并渲染真实结果', async () => {
    executeMock.mockResolvedValue({
      columns: ['订单数'],
      rows: [{ 订单数: 3 }],
      rowCount: 1,
      truncated: false,
    });
    const user = await renderPage();

    const textarea = screen.getByPlaceholderText(/输入只读 SQL/);
    await user.type(textarea, 'SELECT COUNT(*) FROM shop_orders');
    await user.click(screen.getByRole('button', { name: /执行查询/ }));

    expect(await screen.findByText('真实查询')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '3' })).toBeInTheDocument();
    expect(executeMock).toHaveBeenCalledWith(1, 'SELECT COUNT(*) FROM shop_orders', null);
  });

  it('多标签互不串数据：切换标签后 SQL 与结果独立', async () => {
    executeMock.mockResolvedValueOnce({
      columns: ['a'],
      rows: [{ a: 1 }],
      rowCount: 1,
      truncated: false,
    });
    const user = await renderPage();

    const textarea = screen.getByPlaceholderText(/输入只读 SQL/);
    await user.type(textarea, 'SELECT 1 AS a');
    await user.click(screen.getByRole('button', { name: /执行查询/ }));
    await screen.findByText('真实查询');

    // 新建标签
    await user.click(screen.getByRole('button', { name: /新建标签/ }));
    expect(screen.getByText('查询 2')).toBeInTheDocument();
    const secondTextarea = screen.getByPlaceholderText(/输入只读 SQL/);
    expect(secondTextarea).toHaveValue('');

    // 切回标签 1，SQL 与结果仍在
    await user.click(screen.getByText('查询 1'));
    expect(screen.getByPlaceholderText(/输入只读 SQL/)).toHaveValue('SELECT 1 AS a');
    expect(screen.getByText('真实查询')).toBeInTheDocument();
  });

  it('切换数据源会清空当前标签的 SQL 与结果', async () => {
    const user = await renderPage();
    const textarea = screen.getByPlaceholderText(/输入只读 SQL/);
    await user.type(textarea, 'SELECT 1');
    await user.selectOptions(screen.getByLabelText('数据源'), '2');
    expect(screen.getByPlaceholderText(/输入只读 SQL/)).toHaveValue('');
    expect(screen.getByText('尚未执行 SQL')).toBeInTheDocument();
  });

  it('执行被 Guard 拒绝时展示错误', async () => {
    executeMock.mockRejectedValue(
      new (await import('../api/http')).ApiError('SQL_NOT_ALLOWED', '只允许只读 SELECT 查询', 400),
    );
    const user = await renderPage();
    await user.type(screen.getByPlaceholderText(/输入只读 SQL/), 'DELETE FROM shop_orders');
    await user.click(screen.getByRole('button', { name: /执行查询/ }));
    expect(await screen.findByText(/只允许只读 SELECT 查询/)).toBeInTheDocument();
  });

  it('Schema 侧栏展示表与列', async () => {
    const user = await renderPage();
    await user.click(screen.getByRole('button', { name: 'Schema' }));
    expect(await screen.findByText('shop_orders')).toBeInTheDocument();
    expect(schemaMock).toHaveBeenCalledWith(1);
  });
});
