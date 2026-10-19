import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatabasePage } from './DatabasePage';
import {
  createConnection,
  deleteConnection,
  fetchConnectionSchema,
  listConnections,
  testConnection,
  updateConnection,
} from '../api/connections';
import type * as ConnectionsModule from '../api/connections';
import type { Connection, SchemaResponse } from '../api/contract';

vi.mock('../api/connections', async () => {
  const actual = await vi.importActual<typeof ConnectionsModule>('../api/connections');
  return {
    ...actual,
    listConnections: vi.fn(),
    fetchConnectionSchema: vi.fn(),
    createConnection: vi.fn(),
    updateConnection: vi.fn(),
    deleteConnection: vi.fn(),
    testConnection: vi.fn(),
  };
});

const listMock = vi.mocked(listConnections);
const schemaMock = vi.mocked(fetchConnectionSchema);
const updateMock = vi.mocked(updateConnection);
const createMock = vi.mocked(createConnection);
const deleteMock = vi.mocked(deleteConnection);
const testMock = vi.mocked(testConnection);

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

const SCHEMA_A: SchemaResponse = {
  database: 'sql_demo_a',
  tables: [
    {
      name: 'shop_orders',
      columns: [{ name: 'amount', type: 'DECIMAL', nullable: false }],
    },
  ],
};

const SCHEMA_B: SchemaResponse = {
  database: 'sql_demo_b',
  tables: [
    {
      name: 'blog_posts',
      columns: [{ name: 'views', type: 'INT', nullable: false }],
    },
  ],
};

async function renderPage(connections: Connection[] = [CONNECTION_A, CONNECTION_B]) {
  listMock.mockResolvedValue(connections);
  schemaMock.mockImplementation(async (id) => (id === 1 ? SCHEMA_A : SCHEMA_B));
  const user = userEvent.setup();
  render(<DatabasePage />);
  await screen.findByRole('button', { name: /A 商店库/ });
  await screen.findByLabelText('连接名称');
  return user;
}

describe('DatabasePage 真实连接管理', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('选择连接时表单与真实表结构同步切换', async () => {
    const user = await renderPage();

    expect(screen.getByLabelText('连接名称')).toHaveValue('A 商店库');
    expect(await screen.findByText('shop_orders')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /B 博客库/ }));

    expect(screen.getByLabelText('连接名称')).toHaveValue('B 博客库');
    expect(await screen.findByText('blog_posts')).toBeInTheDocument();
    expect(screen.queryByText('shop_orders')).not.toBeInTheDocument();
  });

  it('保存修改调用 PATCH 并更新列表', async () => {
    const user = await renderPage();
    updateMock.mockResolvedValue({ ...CONNECTION_A, name: 'A 商店库（改）' });

    const nameInput = screen.getByLabelText('连接名称');
    await user.type(nameInput, '（改）');
    expect(nameInput).toHaveValue('A 商店库（改）');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(updateMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: 'A 商店库（改）', database: 'sql_demo_a' }),
    );
    expect(await screen.findByRole('button', { name: /A 商店库（改）/ })).toBeInTheDocument();
  });

  it('测试连接展示服务端真实结果', async () => {
    const user = await renderPage();
    testMock.mockResolvedValue({ success: true, message: '连接成功', latencyMs: 12 });

    await user.click(screen.getByRole('button', { name: '测试连接' }));

    expect(await screen.findByText(/连接成功（12ms）/)).toBeInTheDocument();
    expect(testMock).toHaveBeenCalledWith(1);
  });

  it('测试失败如实展示，不伪装成功', async () => {
    const user = await renderPage();
    testMock.mockResolvedValue({ success: false, message: '连接失败，请检查主机、端口、账号与密码', latencyMs: 30 });

    await user.click(screen.getByRole('button', { name: '测试连接' }));

    expect(await screen.findByText(/连接失败，请检查主机、端口、账号与密码/)).toBeInTheDocument();
  });

  it('新增连接必须填写密码并调用 POST', async () => {
    const user = await renderPage();
    createMock.mockResolvedValue({
      id: 3,
      name: '新库',
      engine: 'mysql',
      host: '127.0.0.1',
      port: 3306,
      database: 'sql_demo_a',
      username: 'demo_a_reader',
      hasPassword: true,
    });
    schemaMock.mockResolvedValue(SCHEMA_A);

    await user.click(screen.getByRole('button', { name: /新增/ }));
    await user.type(screen.getByLabelText('连接名称'), '新库');
    await user.type(screen.getByLabelText('数据库'), 'sql_demo_a');
    await user.type(screen.getByLabelText('用户名'), 'demo_a_reader');
    await user.type(screen.getByLabelText('密码'), 'DemoA_reader_2026!');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: '新库', engine: 'mysql', password: 'DemoA_reader_2026!' }),
    );
    expect(await screen.findByRole('button', { name: /新库/ })).toBeInTheDocument();
  });

  it('删除连接需要两次点击确认并调用 DELETE', async () => {
    const user = await renderPage();
    deleteMock.mockResolvedValue(undefined);

    await user.click(screen.getByRole('button', { name: '删除' }));
    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.getByText(/再次点击「确认删除」/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '确认删除' }));

    expect(deleteMock).toHaveBeenCalledWith(1);
    expect(await screen.findByText(/已删除连接「A 商店库」/)).toBeInTheDocument();
  });
});
