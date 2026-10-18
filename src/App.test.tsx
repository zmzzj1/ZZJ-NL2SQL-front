import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import type * as ConnectionsModule from './api/connections';

const authState = vi.hoisted(() => ({
  status: 'authenticated' as 'authenticated' | 'anonymous',
  signOut: vi.fn(),
}));

vi.mock('./hooks/useAuth', () => ({
  useAuth: () => ({
    status: authState.status,
    user: authState.status === 'authenticated' ? { id: 1, email: 'alice@example.com', displayName: 'Alice' } : null,
    login: vi.fn(),
    register: vi.fn(),
    signOut: authState.signOut,
  }),
}));

vi.mock('./hooks/useBackendHealth', () => ({
  useBackendHealth: () => ({ status: 'offline', checkedAt: null, recheck: () => {} }),
}));

vi.mock('./api/connections', async () => {
  const actual = await vi.importActual<typeof ConnectionsModule>('./api/connections');
  return {
    ...actual,
    listConnections: vi.fn().mockResolvedValue([
      {
        id: 1,
        name: 'A 商店库',
        engine: 'mysql',
        host: '127.0.0.1',
        port: 3306,
        database: 'sql_demo_a',
        username: 'demo_a_reader',
        hasPassword: true,
      },
    ]),
    fetchConnectionSchema: vi.fn().mockResolvedValue({ database: 'sql_demo_a', tables: [] }),
  };
});

describe('App 外壳与真实会话', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    authState.status = 'authenticated';
    authState.signOut.mockClear();
  });

  it('未登录时展示真实登录页', async () => {
    authState.status = 'anonymous';
    render(<App />);

    expect(await screen.findByRole('heading', { name: '登录工作台' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '主导航' })).not.toBeInTheDocument();
  });

  it('登录态恢复后可在四个页面间切换', async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByLabelText('主导航');
    const expectations = [
      { name: /数据库连接/, content: /我的连接/ },
      { name: /历史记录/, content: /演示记录/ },
      { name: /设置 本地界面偏好/, content: /外观主题/ },
      { name: /工作台/, content: /提问/ },
    ];

    for (const item of expectations) {
      await user.click(screen.getByRole('button', { name: item.name }));
      const activeNav = screen.getByRole('button', { name: item.name });
      expect(activeNav).toHaveAttribute('aria-current', 'page');
      expect((await screen.findAllByText(item.content)).length).toBeGreaterThan(0);
    }
  });

  it('退出登录调用服务端注销', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText('主导航');

    await user.click(screen.getByRole('button', { name: /退出登录/ }));

    expect(authState.signOut).toHaveBeenCalledTimes(1);
  });
});
