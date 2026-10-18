import type { WorkspacePageKey } from '../../types';
import { workspaceNavItems } from './navigation';

interface SidebarProps {
  current: WorkspacePageKey;
  onNavigate: (page: WorkspacePageKey) => void;
  open: boolean;
}

/**
 * 桌面端常驻侧栏，窄屏变为抽屉。
 * 选中项用 aria-current 标记，避免「点了导航但内容没变」的歧义。
 */
export function Sidebar({ current, onNavigate, open }: SidebarProps) {
  return (
    <aside
      id="workspace-sidebar"
      aria-label="主导航"
      className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-line bg-panel transition-transform duration-200 lg:static lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <nav className="flex h-full flex-col gap-1 p-3">
        {workspaceNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.key === current;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                active ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-panel-muted hover:text-ink'
              }`}
            >
              <Icon className="mt-0.5 h-4 w-4" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="block truncate text-[11px] opacity-80">{item.description}</span>
              </span>
            </button>
          );
        })}
        <div className="mt-auto rounded-lg border border-line bg-panel-muted p-3 text-[11px] leading-relaxed text-ink-muted">
          工作台已接入后端 SQL 生成与只读执行；数据库连接页、历史页仍为演示数据。
        </div>
      </nav>
    </aside>
  );
}
