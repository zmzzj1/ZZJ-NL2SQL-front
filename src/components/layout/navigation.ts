import { BookOpen, Database, History as HistoryIcon, LayoutDashboard, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WorkspacePageKey } from '../../types';

export interface NavItem {
  key: WorkspacePageKey;
  label: string;
  description: string;
  icon: LucideIcon;
}

/** 工作台只有这四个已实现页面，不为未开发功能预留入口。 */
export const workspaceNavItems: NavItem[] = [
  {
    key: 'dashboard',
    label: '工作台',
    description: '提问与 SQL 执行',
    icon: LayoutDashboard,
  },
  {
    key: 'database',
    label: '数据库连接',
    description: '真实 MySQL 连接',
    icon: Database,
  },
  {
    key: 'history',
    label: '历史记录',
    description: '真实查询记录',
    icon: HistoryIcon,
  },
  {
    key: 'knowledge',
    label: '业务知识',
    description: '术语与 SQL 示例',
    icon: BookOpen,
  },
  {
    key: 'settings',
    label: '设置',
    description: '本地界面偏好',
    icon: Settings,
  },
];
