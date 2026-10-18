import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

vi.mock('./hooks/useBackendHealth', () => ({
  useBackendHealth: () => ({ status: 'offline', checkedAt: null, recheck: () => {} }),
}));

/** AC-01/02/03/06：五个页面可达，导航高亮正确，退出演示回到 Login。 */
describe('App 外壳与演示会话', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  const signIn = async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('邮箱'), 'demo@queryforge.local');
    await user.type(screen.getByLabelText('密码'), 'demo-password');
    await user.click(screen.getByRole('button', { name: /进入工作台/ }));
    return user;
  };

  it('TC-01 未进入演示会话时展示 Login', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: '演示登录' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: '主导航' })).not.toBeInTheDocument();
  });

  it('TC-04 连续切换四个页面时内容与导航高亮同步', async () => {
    const user = await signIn();
    const expectations = [
      { name: /数据库连接/, content: /演示连接/ },
      { name: /历史记录/, content: /演示记录/ },
      { name: /设置 本地界面偏好/, content: /外观主题/ },
      { name: /工作台/, content: /提问/ },
    ];

    for (const item of expectations) {
      await user.click(screen.getByRole('button', { name: item.name }));
      const activeNav = screen.getByRole('button', { name: item.name });
      expect(activeNav).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('main')).toHaveTextContent(item.content);
    }
  });

  it('TC-12 退出演示后回到 Login 并清理会话标记', async () => {
    const user = await signIn();
    expect(window.localStorage.getItem('queryforge.demo-session')).toContain('demo@queryforge.local');

    await user.click(screen.getByRole('button', { name: /退出演示/ }));

    expect(screen.getByRole('heading', { name: '演示登录' })).toBeInTheDocument();
    expect(window.localStorage.getItem('queryforge.demo-session')).toBeNull();
  });
});
