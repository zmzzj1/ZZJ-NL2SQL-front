import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as ToolModule from '../api/tool';
import type { McpServerView } from '../api/contract';
import { McpServersPage } from './McpServersPage';
import { connectMcpServer, createMcpServer, listMcpServers } from '../api/tool';

vi.mock('../api/tool', async () => {
  const actual = await vi.importActual<typeof ToolModule>('../api/tool');
  return {
    ...actual,
    listMcpServers: vi.fn(),
    createMcpServer: vi.fn(),
    updateMcpServer: vi.fn(),
    deleteMcpServer: vi.fn(),
    connectMcpServer: vi.fn(),
    disconnectMcpServer: vi.fn(),
    refreshMcpServerStatus: vi.fn(),
  };
});

const listMock = vi.mocked(listMcpServers);
const createMock = vi.mocked(createMcpServer);
const connectMock = vi.mocked(connectMcpServer);

function server(overrides: Partial<McpServerView> = {}): McpServerView {
  return {
    id: 3,
    name: '只读知识库',
    transportType: 'STDIO',
    endpoint: 'demo-mcp',
    status: 'ACTIVE',
    connected: false,
    toolCount: 0,
    error: null,
    ...overrides,
  };
}

describe('McpServersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('已保存但未连通时展示失败原因，绝不显示为已连接', async () => {
    listMock.mockResolvedValue([server({ connected: false, error: '连接被拒绝：白名单未批准该服务' })]);

    render(<McpServersPage />);

    expect(await screen.findByText('只读知识库')).toBeInTheDocument();
    expect(screen.getByText('未连接')).toBeInTheDocument();
    expect(screen.getByText(/连接失败：连接被拒绝/)).toBeInTheDocument();
    expect(screen.queryByText(/已连接 ·/)).not.toBeInTheDocument();
  });

  it('连接成功后展示真实工具数量', async () => {
    listMock.mockResolvedValueOnce([server()]).mockResolvedValue([server({ connected: true, toolCount: 2 })]);
    connectMock.mockResolvedValue(server({ connected: true, toolCount: 2 }));

    const user = userEvent.setup();
    render(<McpServersPage />);
    await screen.findByText('只读知识库');
    await user.click(screen.getByRole('button', { name: '连接' }));

    await waitFor(() => {
      expect(screen.getByText(/已连接 · 2 个工具/)).toBeInTheDocument();
    });
    expect(connectMock).toHaveBeenCalledWith(3);
  });

  it('保存成功但连接未成功时提示「已保存，连接未成功」', async () => {
    listMock.mockResolvedValue([]);
    createMock.mockResolvedValue(server({ connected: false, error: 'endpoint 不在白名单' }));

    const user = userEvent.setup();
    render(<McpServersPage />);
    await screen.findByText('还没有 MCP 服务');

    await user.click(screen.getByRole('button', { name: /新建服务/ }));
    await user.type(screen.getByLabelText('名称'), '只读知识库');
    await user.type(screen.getByLabelText('endpoint'), 'demo-mcp');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText(/已保存，连接未成功：endpoint 不在白名单/)).toBeInTheDocument();
  });

  it('删除需要二次确认后才真正调用后端', async () => {
    listMock.mockResolvedValue([server()]);

    const user = userEvent.setup();
    render(<McpServersPage />);
    await screen.findByText('只读知识库');

    await user.click(screen.getByRole('button', { name: '删除 只读知识库' }));
    expect(screen.getByRole('button', { name: '确认删除' })).toBeInTheDocument();
    expect(screen.getByText('只读知识库')).toBeInTheDocument();
  });
});
