import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardPage } from './DashboardPage';
import { ApiError, executeSql, streamSqlGeneration } from '../api/client';
import type * as ApiClientModule from '../api/client';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof ApiClientModule>('../api/client');
  return {
    ...actual,
    streamSqlGeneration: vi.fn(),
    executeSql: vi.fn(),
    fetchHealth: vi.fn(),
  };
});

const streamMock = vi.mocked(streamSqlGeneration);
const executeMock = vi.mocked(executeSql);

const QUESTION = '统计订单数量';
const SQL = 'SELECT COUNT(*) AS total FROM demo_orders';

function setupClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

function emitFullStream(sql = SQL) {
  streamMock.mockImplementation(async (_request, handlers) => {
    handlers.onStart?.('req-test');
    handlers.onDelta(sql.slice(0, 7));
    handlers.onDelta(sql.slice(7));
    handlers.onComplete?.('req-test');
  });
}

describe('DashboardPage 真实工作台链路', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupClipboard();
  });

  it('空白输入不允许发送', async () => {
    const user = userEvent.setup();
    render(<DashboardPage fontSize={14} />);

    expect(screen.getByRole('button', { name: /发送/ })).toBeDisabled();
    await user.type(screen.getByLabelText('提问内容'), '   ');
    expect(screen.getByRole('button', { name: /发送/ })).toBeDisabled();
  });

  it('发送后按 delta 顺序展示 SQL，并在完成后允许执行', async () => {
    emitFullStream();
    const user = userEvent.setup();
    render(<DashboardPage fontSize={14} />);

    await user.type(screen.getByLabelText('提问内容'), QUESTION);
    await user.click(screen.getByRole('button', { name: /发送/ }));

    expect(screen.getByText(QUESTION, { selector: 'p' })).toBeInTheDocument();
    expect(await screen.findByText(SQL)).toBeInTheDocument();
    expect(screen.getByText('模型生成')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /执行查询/ })).toBeEnabled();
    expect(streamMock).toHaveBeenCalledWith(
      expect.objectContaining({ userInput: QUESTION, strategyName: 'default' }),
      expect.any(Object),
      expect.any(AbortSignal),
    );
  });

  it('用户显式执行后渲染真实列与行', async () => {
    emitFullStream();
    executeMock.mockResolvedValue({
      columns: ['total'],
      rows: [{ total: 3 }],
      rowCount: 1,
      truncated: false,
    });

    const user = userEvent.setup();
    render(<DashboardPage fontSize={14} />);
    await user.type(screen.getByLabelText('提问内容'), QUESTION);
    await user.click(screen.getByRole('button', { name: /发送/ }));
    await screen.findByText(SQL);

    await user.click(screen.getByRole('button', { name: /执行查询/ }));

    expect(await screen.findByText('真实查询')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'total' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '3' })).toBeInTheDocument();
    expect(screen.getByText('共 1 行')).toBeInTheDocument();
    expect(executeMock).toHaveBeenCalledWith(SQL);
  });

  it('空结果集展示零行状态而不是伪造数据', async () => {
    emitFullStream();
    executeMock.mockResolvedValue({
      columns: ['id', 'amount'],
      rows: [],
      rowCount: 0,
      truncated: false,
    });

    const user = userEvent.setup();
    render(<DashboardPage fontSize={14} />);
    await user.type(screen.getByLabelText('提问内容'), QUESTION);
    await user.click(screen.getByRole('button', { name: /发送/ }));
    await screen.findByText(SQL);
    await user.click(screen.getByRole('button', { name: /执行查询/ }));

    expect(await screen.findByText('查询成功，返回 0 行')).toBeInTheDocument();
  });

  it('执行失败展示服务端错误码对应的安全提示', async () => {
    emitFullStream();
    executeMock.mockRejectedValue(new ApiError('SQL_NOT_ALLOWED', '只允许只读 SELECT 查询', 400));

    const user = userEvent.setup();
    render(<DashboardPage fontSize={14} />);
    await user.type(screen.getByLabelText('提问内容'), QUESTION);
    await user.click(screen.getByRole('button', { name: /发送/ }));
    await screen.findByText(SQL);
    await user.click(screen.getByRole('button', { name: /执行查询/ }));

    expect(await screen.findByText(/只允许只读 SELECT 查询/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重试执行/ })).toBeInTheDocument();
  });

  it('取消生成后不保留部分 SQL，也不显示完成态', async () => {
    streamMock.mockImplementation(
      (_request, handlers, signal) =>
        new Promise<void>((_resolve, reject) => {
          handlers.onStart?.('req-cancel');
          handlers.onDelta('SELECT ');
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );

    const user = userEvent.setup();
    render(<DashboardPage fontSize={14} />);
    await user.type(screen.getByLabelText('提问内容'), QUESTION);
    await user.click(screen.getByRole('button', { name: /发送/ }));

    expect(await screen.findByText(/正在从后端流式接收 SQL/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /取消生成/ }));

    expect(await screen.findByText('已取消本次 SQL 生成。')).toBeInTheDocument();
    expect(screen.queryByText('SELECT')).not.toBeInTheDocument();
    expect(screen.getByText('还没有 SQL')).toBeInTheDocument();
  });

  it('模型未配置时显示明确原因，且执行按钮保持禁用', async () => {
    streamMock.mockRejectedValue(
      new ApiError('MODEL_NOT_CONFIGURED', '模型服务未配置：请在服务端设置 LLM_API_KEY', 503),
    );

    const user = userEvent.setup();
    render(<DashboardPage fontSize={14} />);
    await user.type(screen.getByLabelText('提问内容'), QUESTION);
    await user.click(screen.getByRole('button', { name: /发送/ }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('后端未配置模型密钥');
    expect(screen.getByRole('button', { name: /执行查询/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /重试生成/ })).toBeInTheDocument();
  });

  it('Enter 发送，Shift+Enter 保留换行', async () => {
    emitFullStream();
    const user = userEvent.setup();
    render(<DashboardPage fontSize={14} />);
    const textarea = screen.getByLabelText('提问内容');

    await user.type(textarea, '第一行');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(textarea, '第二行');
    expect(textarea).toHaveValue('第一行\n第二行');

    await user.keyboard('{Enter}');
    expect(await screen.findByText(/第一行\s+第二行/)).toBeInTheDocument();
    expect(textarea).toHaveValue('');
  });
});
