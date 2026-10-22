import { useState } from 'react';
import { AppShell } from '../components/layout/AppShell';
import { useBackendHealth } from '../hooks/useBackendHealth';
import { useUiPreferences } from '../hooks/useUiPreferences';
import type { User } from '../api/contract';
import type { WorkspacePageKey } from '../types';
import { findWorkspaceRoute, type WorkspaceRouteContext } from './workspaceRoutes';

interface WorkspaceShellProps {
  user: User;
  signOut: () => Promise<void>;
}

/**
 * 已登录工作区：持有当前页面、界面偏好与后端健康状态，
 * 经路由表渲染当前页面；页面级 SSE 生命周期由各功能 hook 自行清理。
 */
export function WorkspaceShell({ user, signOut }: WorkspaceShellProps) {
  const { preferences, setTheme, setEditorFontSize, resetPreferences } = useUiPreferences();
  const backendHealth = useBackendHealth();
  const [page, setPage] = useState<WorkspacePageKey>('dashboard');
  // P14-C：Agent 时间线 → 报告页的真实工件定位（一次性焦点）。
  const [artifactFocus, setArtifactFocus] = useState<{ kind: 'analysis' | 'report'; id: number } | null>(null);

  const route = findWorkspaceRoute(page);
  const routeContext: WorkspaceRouteContext = {
    preferences,
    onThemeChange: setTheme,
    onFontSizeChange: setEditorFontSize,
    onResetPreferences: resetPreferences,
    onNavigate: setPage,
    onGoToArtifact: (kind, artifactId) => {
      setArtifactFocus({ kind, id: artifactId });
      setPage('report');
    },
    artifactFocus,
  };

  return (
    <AppShell
      current={page}
      onNavigate={setPage}
      userEmail={user.email}
      onSignOut={() => {
        void signOut();
        setPage('dashboard');
      }}
      backendStatus={backendHealth.status}
      onRecheckHealth={backendHealth.recheck}
    >
      {route.render(routeContext)}
    </AppShell>
  );
}
