import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';

/** AC-05 / AC-06：无效输入不能进入，合法演示输入进入工作台。 */
describe('LoginPage 表单校验', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('TC-02 邮箱为空或格式错误时给出提示且不进入系统', async () => {
    const onSignIn = vi.fn();
    const user = userEvent.setup();
    render(<LoginPage onSignIn={onSignIn} />);

    await user.click(screen.getByRole('button', { name: /进入工作台/ }));
    expect(screen.getByText('请输入邮箱地址')).toBeInTheDocument();
    expect(screen.getByText('请输入密码')).toBeInTheDocument();
    expect(onSignIn).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('邮箱'), 'not-an-email');
    await user.type(screen.getByLabelText('密码'), 'demo-password');
    await user.click(screen.getByRole('button', { name: /进入工作台/ }));

    expect(screen.getByText(/邮箱格式不正确/)).toBeInTheDocument();
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it('TC-03 合法演示输入进入系统，且不向 sessionStorage 写入密码', async () => {
    const onSignIn = vi.fn();
    const user = userEvent.setup();
    render(<LoginPage onSignIn={onSignIn} />);

    await user.click(screen.getByRole('button', { name: '填入示例凭证' }));
    await user.click(screen.getByRole('button', { name: /进入工作台/ }));

    expect(onSignIn).toHaveBeenCalledWith('demo@queryforge.local');
    expect(window.localStorage.getItem('queryforge.demo-session')).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
    expect(window.location.href).not.toContain('password');
  });

  it('登录表单不提供「忘记密码 / 注册」等未实现入口', () => {
    render(<LoginPage onSignIn={vi.fn()} />);
    expect(screen.getByText(/注册与找回密码暂未开放/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /注册/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /忘记密码/ })).not.toBeInTheDocument();
  });
});
