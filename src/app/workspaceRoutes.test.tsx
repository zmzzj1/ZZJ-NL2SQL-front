import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { findWorkspaceRoute, workspaceRoutes, type WorkspaceRouteContext } from './workspaceRoutes';
import type { WorkspacePageKey } from '../types';

const ALL_PAGE_KEYS: WorkspacePageKey[] = [
  'dashboard',
  'database',
  'history',
  'console',
  'knowledge',
  'studio',
  'skills',
  'mcp',
  'workspace',
  'memory',
  'report',
  'workflow',
  'settings',
  'admin',
];

function stubContext(): WorkspaceRouteContext {
  return {
    preferences: { theme: 'light', editorFontSize: 13 },
    onThemeChange: vi.fn(),
    onFontSizeChange: vi.fn(),
    onResetPreferences: vi.fn(),
    onNavigate: vi.fn(),
  };
}

describe('workspaceRoutes 路由表', () => {
  it('覆盖全部 WorkspacePageKey 且无重复', () => {
    const keys = workspaceRoutes.map((route) => route.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...ALL_PAGE_KEYS].sort());
  });

  it('导航顺序与既有基线一致（工作台在首、平台管理在末）', () => {
    expect(workspaceRoutes[0].key).toBe('dashboard');
    expect(workspaceRoutes[workspaceRoutes.length - 1].key).toBe('admin');
    expect(workspaceRoutes).toHaveLength(ALL_PAGE_KEYS.length);
  });

  it('每个路由都有标签、说明、图标与渲染函数', () => {
    for (const route of workspaceRoutes) {
      expect(route.label.length).toBeGreaterThan(0);
      expect(route.description.length).toBeGreaterThan(0);
      expect(route.icon).toBeTruthy();
      expect(typeof route.render).toBe('function');
    }
  });

  it('findWorkspaceRoute 未命中时回退工作台', () => {
    expect(findWorkspaceRoute('dashboard').key).toBe('dashboard');
    expect(findWorkspaceRoute('not-a-page' as WorkspacePageKey).key).toBe('dashboard');
  });

  it('设置路由经上下文渲染偏好面板', () => {
    const route = workspaceRoutes.find((item) => item.key === 'settings');
    expect(route).toBeDefined();
    render(<>{route!.render(stubContext())}</>);
    expect(screen.getByText(/外观主题/)).toBeInTheDocument();
  });
});
