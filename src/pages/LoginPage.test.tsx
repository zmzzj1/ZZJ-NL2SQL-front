import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';
import { ApiError } from '../api/http';

describe('LoginPage 真实登录与注册', () => {
  it('空邮箱与空密码给出提示，不调用登录', async () => {
    const onLogin = vi.fn();
    const user = userEvent.setup();
    render(<LoginPage onLogin={onLogin} onRegister={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '登录工作台' }));

    expect(screen.getByText('请输入邮箱地址')).toBeInTheDocument();
    expect(screen.getByText('请输入密码')).toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('邮箱格式错误时不提交', async () => {
    const onLogin = vi.fn();
    const user = userEvent.setup();
    render(<LoginPage onLogin={onLogin} onRegister={vi.fn()} />);

    await user.type(screen.getByLabelText('邮箱'), 'not-an-email');
    await user.type(screen.getByLabelText('密码'), 'secret123');
    await user.click(screen.getByRole('button', { name: '登录工作台' }));

    expect(screen.getByText('邮箱格式不正确')).toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('合法输入调用服务端登录', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginPage onLogin={onLogin} onRegister={vi.fn()} />);

    await user.type(screen.getByLabelText('邮箱'), 'alice@example.com');
    await user.type(screen.getByLabelText('密码'), 'alice12345');
    await user.click(screen.getByRole('button', { name: '登录工作台' }));

    expect(onLogin).toHaveBeenCalledWith('alice@example.com', 'alice12345');
  });

  it('注册模式校验密码复杂度，合法后调用注册', async () => {
    const onRegister = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginPage onLogin={vi.fn()} onRegister={onRegister} />);

    await user.click(screen.getByRole('tab', { name: '注册' }));
    await user.type(screen.getByLabelText('展示名（可选）'), 'Alice');
    await user.type(screen.getByLabelText('邮箱'), 'alice@example.com');
    await user.type(screen.getByLabelText('密码'), 'short');
    await user.click(screen.getByRole('button', { name: '注册并登录' }));
    expect(screen.getByText('密码至少 8 位')).toBeInTheDocument();
    expect(onRegister).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('密码'));
    await user.type(screen.getByLabelText('密码'), 'alice12345');
    await user.click(screen.getByRole('button', { name: '注册并登录' }));
    expect(onRegister).toHaveBeenCalledWith('alice@example.com', 'Alice', 'alice12345');
  });

  it('服务端拒绝时展示安全错误文案', async () => {
    const onLogin = vi.fn().mockRejectedValue(new ApiError('UNAUTHENTICATED', '邮箱或密码不正确', 401));
    const user = userEvent.setup();
    render(<LoginPage onLogin={onLogin} onRegister={vi.fn()} />);

    await user.type(screen.getByLabelText('邮箱'), 'alice@example.com');
    await user.type(screen.getByLabelText('密码'), 'wrong12345');
    await user.click(screen.getByRole('button', { name: '登录工作台' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('邮箱或密码不正确');
  });
});
