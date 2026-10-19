import {
  BarChart3,
  BookOpen,
  BookMarked,
  Bot,
  Brain,
  Database,
  History as HistoryIcon,
  LayoutDashboard,
  Settings,
  Users,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { WorkspacePageKey } from '../../types';

export interface NavItem {
  key: WorkspacePageKey;
  label: string;
  description: string;
  icon: LucideIcon;
}

/** 工作台页面入口，只列出已实现页面。 */
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
    key: 'studio',
    label: 'Agent Studio',
    description: '配置与发布 Agent',
    icon: Bot,
  },
  {
    key: 'skills',
    label: 'Skills',
    description: '可复用任务指引',
    icon: BookMarked,
  },
  {
    key: 'workspace',
    label: '工作空间',
    description: '成员与资源授权',
    icon: Users,
  },
  {
    key: 'memory',
    label: '长期记忆',
    description: '跨会话事实与偏好',
    icon: Brain,
  },
  {
    key: 'report',
    label: '分析报告',
    description: '真实数据图表与报告',
    icon: BarChart3,
  },
  {
    key: 'workflow',
    label: '工作流',
    description: '可视化 DAG 编排',
    icon: WorkflowIcon,
  },
  {
    key: 'settings',
    label: '设置',
    description: '本地界面偏好',
    icon: Settings,
  },
];
