import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardPage } from './DashboardPage';
import { listConnections } from '../api/connections';
import { createConversation, fetchConversation, listConversations } from '../api/conversations';
import type { Connection, ConversationDetail, ConversationSummary } from '../api/contract';
import { ApiError } from '../api/http';
import { executeSql, streamSqlGeneration } from '../api/sql';
import type * as ConnectionsModule from '../api/connections';
import type * as ConversationsModule from '../api/conversations';
import type * as SqlModule from '../api/sql';

vi.mock('../api/connections', async () => {
  const actual = await vi.importActual<typeof ConnectionsModule>('../api/connections');
  return {
    ...actual,
    listConnections: vi.fn(),
  };
});

vi.mock('../api/conversations', async () => {
  const actual = await vi.importActual<typeof ConversationsModule>('../api/conversations');
  return {
    ...actual,
    listConversations: vi.fn(),
    createConversation: vi.fn(),
    fetchConversation: vi.fn(),
    deleteConversation: vi.fn(),
  };
});

vi.mock('../api/agent', () => ({
  streamAgentRun: vi.fn(),
  approveAgentStep: vi.fn(),
  rejectAgentStep: vi.fn(),
  cancelAgentRun: vi.fn(),
  fetchAgentRun: vi.fn(),
  fetchLatestAgentRun: vi.fn().mockResolvedValue(null),
}));

vi.mock('../api/sql', async () => {
  const actual = await vi.importActual<typeof SqlModule>('../api/sql');
  return {
    ...actual,
    streamSqlGeneration: vi.fn(),
    executeSql: vi.fn(),
  };
});

const streamMock = vi.mocked(streamSqlGeneration);
const executeMock = vi.mocked(executeSql);
const listMock = vi.mocked(listConnections);
const listConversationsMock = vi.mocked(listConversations);
const createConversationMock = vi.mocked(createConversation);
const fetchConversationMock = vi.mocked(fetchConversation);

const NOW = '2026-10-19T06:00:00';

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

const QUESTION = '统计订单数量';
const SQL = 'SELECT COUNT(*) AS `订单数` FROM shop_orders';

const CONVERSATION: ConversationSummary = {
  id: 100,
  title: QUESTION,
  connectionId: 1,
  connectionName: 'A 商店库',
  createdAt: NOW,
  lastActivityAt: NOW,
};

function emitFullStream(sql = SQL) {
  streamMock.mockImplementation(async (_request, handlers) => {
    handlers.onStart?.('req-test');
    handlers.onDelta(sql.slice(0, 10));
    handlers.onDelta(sql.slice(10));
    handlers.onComplete?.('req-test');
  });
}

async function renderPage(connections: Connection[] = [CONNECTION_A], conversationItems: ConversationSummary[] = []) {
  listMock.mockResolvedValue(connections);
  listConversationsMock.mockResolvedValue({ items: conversationItems, nextCursor: null });
  createConversationMock.mockResolvedValue(CONVERSATION);
  const user = userEvent.setup();
  render(<DashboardPage fontSize={14} onGoToDatabase={vi.fn()} />);
  await screen.findByLabelText('数据源');
  return user;
}

describe('DashboardPage 真实工作台链路', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchConversationMock.mockResolvedValue({
      ...CONVERSATION,
      messages: [],
      messagesTruncated: false,
    } satisfies ConversationDetail);
  });

  it('空白输入不允许发送', async () => {
    const user = await renderPage();
    expect(screen.getByRole('button', { name: /发送/ })).toBeDisabled();
    await user.type(screen.getByLabelText('提问内容'), '   ');
    expect(screen.getByRole('button', { name: /发送/ })).toBeDisabled();
  });

  it('首次提问先创建会话，再携带 connectionId 与 conversationId 流式生成', async () => {
    emitFullStream();
    const user = await renderPage();

    await user.type(screen.getByLabelText('提问内容'), QUESTION);
    await user.click(screen.getByRole('button', { name: /发送/ }));

    expect(await screen.findAllByText(SQL)).not.toHaveLength(0);
    expect(createConversationMock).toHaveBeenCalledWith({ connectionId: 1, title: QUESTION });
    expect(streamMock).toHaveBeenCalledWith(
      { userInput: QUESTION, connectionId: 1, conversationId: 100, strategyName: 'default' },
      expect.any(Object),
      expect.any(AbortSignal),
    );
    expect(screen.getByRole('button', { name: /执行查询/ })).toBeEnabled();
  });

  it('执行时使用同一个 connectionId 与 conversationId 并渲染真实结果', async () => {
    emitFullStream();
    executeMock.mockResolvedValue({
      columns: ['订单数'],
      rows: [{ 订单数: 3 }],
      rowCount: 1,
      truncated: false,
    });
    const user = await renderPage();

    await user.type(screen.getByLabelText('提问内容'), QUESTION);
    await user.click(screen.getByRole('button', { name: /发送/ }));
    await screen.findAllByText(SQL);
    await user.click(screen.getByRole('button', { name: /执行查询/ }));

    expect(await screen.findByText('真实查询')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '3' })).toBeInTheDocument();
    expect(executeMock).toHaveBeenCalledWith(1, SQL, 100);
  });

  it('空结果集展示零行状态', async () => {
    emitFullStream();
    executeMock.mockResolvedValue({ columns: ['id'], rows: [], rowCount: 0, truncated: false });
    const user = await renderPage();

    await user.type(screen.getByLabelText('提问内容'), QUESTION);
    await user.click(screen.getByRole('button', { name: /发送/ }));
    await screen.findAllByText(SQL);
    await user.click(screen.getByRole('button', { name: /执行查询/ }));

    expect(await screen.findByText('查询成功，返回 0 行')).toBeInTheDocument();
  });

  it('执行失败展示服务端安全提示', async () => {
    emitFullStream();
    executeMock.mockRejectedValue(new ApiError('SQL_NOT_ALLOWED', '只允许只读 SELECT 查询', 400));
    const user = await renderPage();

    await user.type(screen.getByLabelText('提问内容'), QUESTION);
    await user.click(screen.getByRole('button', { name: /发送/ }));
    await screen.findAllByText(SQL);
    await user.click(screen.getByRole('button', { name: /执行查询/ }));

    expect(await screen.findByText(/只允许只读 SELECT 查询/)).toBeInTheDocument();
  });

  it('取消生成后清空部分 SQL 并标记已取消', async () => {
    streamMock.mockImplementation(
      (_request, handlers, signal) =>
        new Promise<void>((_resolve, reject) => {
          handlers.onStart?.('req-cancel');
          handlers.onDelta('SELECT ');
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const user = await renderPage();

    await user.type(screen.getByLabelText('提问内容'), QUESTION);
    await user.click(screen.getByRole('button', { name: /发送/ }));
    await screen.findByText(/正在从后端流式接收 SQL/);
    await user.click(screen.getByRole('button', { name: /取消生成/ }));

    expect(await screen.findByText('已取消')).toBeInTheDocument();
    expect(screen.getByText('还没有 SQL')).toBeInTheDocument();
  });

  it('切换数据源会取消旧流、清空旧 SQL 并开始新会话', async () => {
    const signals: AbortSignal[] = [];
    streamMock.mockImplementation((_request, handlers, signal) => {
      signals.push(signal);
      handlers.onStart?.('req-switch');
      handlers.onDelta('SELECT FROM shop_orders');
      return new Promise<void>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    });
    const user = await renderPage([CONNECTION_A, CONNECTION_B]);

    await user.type(screen.getByLabelText('提问内容'), QUESTION);
    await user.click(screen.getByRole('button', { name: /发送/ }));
    await screen.findByText(/SELECT FROM shop_orders/);

    await user.selectOptions(screen.getByLabelText('数据源'), '2');

    expect(signals[0]?.aborted).toBe(true);
    expect(screen.queryByText(/SELECT FROM shop_orders/)).not.toBeInTheDocument();
    expect(screen.getByText('还没有 SQL')).toBeInTheDocument();
    expect(screen.getByLabelText('会话')).toHaveValue('');
  });

  it('选择历史会话时从服务端恢复消息', async () => {
    fetchConversationMock.mockResolvedValue({
      ...CONVERSATION,
      messages: [
        { id: 1, role: 'USER', content: QUESTION, status: 'COMPLETED', createdAt: NOW },
        { id: 2, role: 'ASSISTANT', content: SQL, status: 'COMPLETED', createdAt: NOW },
      ],
      messagesTruncated: false,
    });
    const user = await renderPage([CONNECTION_A], [CONVERSATION]);

    await user.selectOptions(screen.getByLabelText('会话'), '100');

    expect(await screen.findByText(QUESTION, { selector: 'p' })).toBeInTheDocument();
    expect(fetchConversationMock).toHaveBeenCalledWith(100);
    expect(screen.getByLabelText('会话')).toHaveValue('100');
  });

  it('模型未配置时显示明确原因，执行按钮保持禁用', async () => {
    streamMock.mockRejectedValue(
      new ApiError('MODEL_NOT_CONFIGURED', '模型服务未配置：请在服务端设置 LLM_API_KEY', 503),
    );
    const user = await renderPage();

    await user.type(screen.getByLabelText('提问内容'), QUESTION);
    await user.click(screen.getByRole('button', { name: /发送/ }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('后端未配置模型密钥');
    expect(screen.getByRole('button', { name: /执行查询/ })).toBeDisabled();
  });

  it('Enter 发送，Shift+Enter 保留换行', async () => {
    emitFullStream();
    const user = await renderPage();
    const textarea = screen.getByLabelText('提问内容');

    await user.type(textarea, '第一行');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(textarea, '第二行');
    expect(textarea).toHaveValue('第一行\n第二行');

    await user.keyboard('{Enter}');
    expect(await screen.findByText(/第一行\s+第二行/)).toBeInTheDocument();
  });
});
