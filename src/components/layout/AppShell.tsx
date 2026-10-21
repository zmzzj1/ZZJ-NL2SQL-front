import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { SidebarBackdrop, Topbar } from './Topbar';
import { findWorkspaceRoute } from '../../app/workspaceRoutes';
import type { WorkspacePageKey } from '../../types';
import type { BackendStatus } from '../../hooks/useBackendHealth';

interface AppShellProps {
  current: WorkspacePageKey;
  onNavigate: (page: WorkspacePageKey) => void;
  userEmail: string;
  onSignOut: () => void;
  backendStatus: BackendStatus;
  onRecheckHealth: () => void;
  children: React.ReactNode;
}

/**
 * 应用外壳：抽屉状态由外壳持有，页面只负责自己的内容。
 * 窄屏切换页面后自动收起抽屉，避免遮挡。
 */
export function AppShell({
  current,
  onNavigate,
  userEmail,
  onSignOut,
  backendStatus,
  onRecheckHealth,
  children,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const title = findWorkspaceRoute(current).label;

  const goTo = (page: WorkspacePageKey) => {
    onNavigate(page);
    setMenuOpen(false);
  };

  return (
    <div className="flex h-full overflow-hidden bg-canvas">
      <Sidebar current={current} onNavigate={goTo} open={menuOpen} />
      {menuOpen ? <SidebarBackdrop onClose={() => setMenuOpen(false)} /> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          pageTitle={title}
          userEmail={userEmail}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((open) => !open)}
          onSignOut={onSignOut}
          backendStatus={backendStatus}
          onRecheckHealth={onRecheckHealth}
        />
        <main id="main-content" className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
