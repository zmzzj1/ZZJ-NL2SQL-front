import { CircleCheck, CircleX, Loader2, LogOut, Menu, X } from 'lucide-react';
import { DemoBadge } from '../ui/DemoBadge';
import type { BackendStatus } from '../../hooks/useBackendHealth';

interface TopbarProps {
  pageTitle: string;
  userEmail: string;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onSignOut: () => void;
  backendStatus: BackendStatus;
  onRecheckHealth: () => void;
}

const STATUS_LABEL: Record<BackendStatus, string> = {
  checking: '检测后端…',
  online: '后端已连接',
  offline: '后端未连接',
};

export function Topbar({
  pageTitle,
  userEmail,
  menuOpen,
  onToggleMenu,
  onSignOut,
  backendStatus,
  onRecheckHealth,
}: TopbarProps) {
  const statusTone =
    backendStatus === 'online'
      ? 'border-success/40 bg-success/10 text-success'
      : backendStatus === 'offline'
        ? 'border-danger/40 bg-danger/10 text-danger'
        : 'border-line bg-panel-muted text-ink-muted';

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-panel/95 px-4 py-3 backdrop-blur">
      <button
        type="button"
        className="btn-muted px-2 py-1.5 lg:hidden"
        onClick={onToggleMenu}
        aria-expanded={menuOpen}
        aria-controls="workspace-sidebar"
        aria-label={menuOpen ? '关闭导航菜单' : '打开导航菜单'}
      >
        {menuOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
      </button>

      <div className="flex min-w-0 items-center gap-2">
        <span
          className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-xs font-bold text-accent-ink"
          aria-hidden="true"
        >
          QF
        </span>
        <span className="text-sm font-bold text-ink">QueryForge</span>
      </div>

      <span className="mx-1 hidden h-5 w-px bg-line md:block" aria-hidden="true" />
      <h1 className="hidden truncate text-sm font-semibold text-ink-muted md:block">{pageTitle}</h1>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onRecheckHealth}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold ${statusTone}`}
          title="点击重新检测 /api/health"
          aria-label={`后端状态：${STATUS_LABEL[backendStatus]}，点击重新检测`}
        >
          {backendStatus === 'checking' ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : backendStatus === 'online' ? (
            <CircleCheck className="h-3 w-3" aria-hidden="true" />
          ) : (
            <CircleX className="h-3 w-3" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{STATUS_LABEL[backendStatus]}</span>
        </button>
        <span className="hidden sm:inline-flex">
          <DemoBadge variant="neutral">演示登录</DemoBadge>
        </span>
        <span className="hidden max-w-[180px] truncate text-xs text-ink-muted sm:block" title={userEmail}>
          {userEmail}
        </span>
        <button type="button" className="btn-secondary px-2.5 py-1.5 text-xs" onClick={onSignOut}>
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">退出演示</span>
          <span className="sm:hidden">退出</span>
        </button>
      </div>
    </header>
  );
}

/** 抽屉打开时遮盖主内容，点击即关闭。 */
export function SidebarBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-30 bg-black/40 lg:hidden"
      onClick={onClose}
      aria-hidden="true"
      data-testid="sidebar-backdrop"
    />
  );
}
