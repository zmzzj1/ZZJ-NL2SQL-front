import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminPage } from './AdminPage';
import { adminCheck, adminDashboard, adminUsers } from '../api/admin';
import { ApiError } from '../api/http';
import type * as ModelModule from '../api/model';
import type * as AdminModule from '../api/admin';

vi.mock('../api/model', async () => {
  const actual = await vi.importActual<typeof ModelModule>('../api/model');
  return {
    ...actual,
    listProviders: vi.fn().mockResolvedValue([]),
    listProfiles: vi.fn().mockResolvedValue([]),
    adminOverview: vi.fn().mockResolvedValue({ totalCalls: 0, failedCalls: 0, activeModels: 0 }),
    adminModelUsage: vi.fn().mockResolvedValue({ models: [], failures: [], since: '' }),
  };
});

vi.mock('../api/admin', async () => {
  const actual = await vi.importActual<typeof AdminModule>('../api/admin');
  return {
    ...actual,
    adminCheck: vi.fn().mockResolvedValue({ isAdmin: true, role: 'ADMIN' }),
    adminUsers: vi.fn(),
    adminDashboard: vi.fn(),
    adminSetUserStatus: vi.fn(),
    adminSetUserQuota: vi.fn(),
  };
});

const usersMock = vi.mocked(adminUsers);
const dashboardMock = vi.mocked(adminDashboard);
const checkMock = vi.mocked(adminCheck);

const USER_PAGE = {
  items: [
    {
      id: 7,
      email: 'admin@example.com',
      displayName: 'Admin',
      role: 'ADMIN',
      createdAt: '2026-10-22 09:00:00',
      status: 'ACTIVE',
      tokenQuota: null,
    },
  ],
  total: 1,
  page: 1,
  size: 20,
};

const DASHBOARD = {
  userTotal: 3,
  adminTotal: 1,
  activeUsers24h: 2,
  queryExecutionsTotal: 10,
  queryExecutions24h: 4,
  failedExecutions24h: 1,
  agentRunsTotal: 5,
  agentRuns24h: 2,
  generatedAt: '2026-10-22 10:00:00',
};

beforeEach(() => {
  vi.clearAllMocks();
  checkMock.mockResolvedValue({ isAdmin: true, role: 'ADMIN' });
});

describe('AdminPage 用户与概览视图', () => {
  it('管理员可查看用户列表', async () => {
    usersMock.mockResolvedValue(USER_PAGE);
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /用户/ }));

    await waitFor(() => expect(screen.getByText('admin@example.com')).toBeTruthy());
    expect(screen.getByText('ADMIN')).toBeTruthy();
    expect(screen.getByText(/共 1 个账号/)).toBeTruthy();
  });

  it('管理员可查看平台概览统计', async () => {
    dashboardMock.mockResolvedValue(DASHBOARD);
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /概览/ }));

    await waitFor(() => expect(screen.getByText('用户总数')).toBeTruthy());
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText(/统计生成时间/)).toBeTruthy();
  });

  it('非管理员看到无权限提示且不展示列表', async () => {
    usersMock.mockRejectedValue(new ApiError('ADMIN_FORBIDDEN', '仅平台管理员可执行此操作', 403));
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /用户/ }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('仅平台管理员'));
    expect(screen.queryByText('admin@example.com')).toBeNull();
  });

  it('管理服务不可用展示失败状态', async () => {
    dashboardMock.mockRejectedValue(new ApiError('SERVICE_UNAVAILABLE', '管理服务依赖不可用', 503));
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /概览/ }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('管理服务依赖不可用'));
    expect(screen.queryByText('用户总数')).toBeNull();
  });

  it('空用户列表展示空态', async () => {
    usersMock.mockResolvedValue({ items: [], total: 0, page: 1, size: 20 });
    render(<AdminPage />);

    await userEvent.click(screen.getByRole('button', { name: /用户/ }));

    await waitFor(() => expect(screen.getByText('没有匹配的账号')).toBeTruthy());
  });
});
