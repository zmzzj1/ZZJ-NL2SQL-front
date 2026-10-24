import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  BookMarked,
  Bot,
  Brain,
  Database,
  History as HistoryIcon,
  LayoutDashboard,
  Plug,
  Settings,
  ShieldCheck,
  TerminalSquare,
  Users,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { DashboardPage } from '../pages/DashboardPage';
import { DatabasePage } from '../pages/DatabasePage';
import { HistoryPage } from '../pages/HistoryPage';
import { SqlConsolePage } from '../pages/SqlConsolePage';
import { KnowledgePage } from '../pages/KnowledgePage';
import { StudioPage } from '../pages/StudioPage';
import { SkillsPage } from '../pages/SkillsPage';
import { McpServersPage } from '../pages/McpServersPage';
import { WorkspacePage } from '../pages/WorkspacePage';
import { MemoryPage } from '../pages/MemoryPage';
import { ReportPage } from '../pages/ReportPage';
import { WorkflowPage } from '../pages/WorkflowPage';
import { SettingsPage } from '../pages/SettingsPage';
import { AdminPage } from '../pages/AdminPage';
import type { ThemePreference, UiPreferences, WorkspacePageKey } from '../types';

/** 路由渲染所需的界面偏好与导航能力，由 WorkspaceShell 注入。 */
export interface WorkspaceRouteContext {
  preferences: UiPreferences;
  onThemeChange: (theme: ThemePreference) => void;
  onFontSizeChange: (size: number) => void;
  onResetPreferences: () => void;
  onNavigate: (page: WorkspacePageKey) => void;
  /** P14-C：Agent 时间线请求查看指定真实工件（分析运行或报告）。 */
  onGoToArtifact?: (kind: 'analysis' | 'report', artifactId: number) => void;
  /** P14-C：WorkspaceShell 持有的待查看工件，供报告页打开后立即定位。 */
  artifactFocus?: { kind: 'analysis' | 'report'; id: number } | null;
}

export interface WorkspaceRoute {
  key: WorkspacePageKey;
  label: string;
  description: string;
  icon: LucideIcon;
  render: (context: WorkspaceRouteContext) => ReactNode;
}

/**
 * 工作台路由表：导航入口与页面映射的单一事实源。
 * Sidebar 与 Topbar 标题从同一张表派生，避免「导航有、渲染无」的漂移。
 *
 * <p>访问控制边界：所有工作区路由都要求已登录会话（由 App 门禁统一分发）；
 * 「平台管理」等管理员能力的真实边界由服务端 AdminGuard 强制执行，
 * 前端不本地判定角色，只按本表展示入口——与既有行为一致。
 */
export const workspaceRoutes: WorkspaceRoute[] = [
  {
    key: 'dashboard',
    label: '工作台',
    description: '提问与 SQL 执行',
    icon: LayoutDashboard,
    render: (context) => (
      <DashboardPage
        fontSize={context.preferences.editorFontSize}
        onGoToDatabase={() => context.onNavigate('database')}
        onGoToArtifact={context.onGoToArtifact}
      />
    ),
  },
  {
    key: 'database',
    label: '数据库连接',
    description: '真实 MySQL 连接',
    icon: Database,
    render: () => <DatabasePage />,
  },
  {
    key: 'history',
    label: '历史记录',
    description: '真实查询记录',
    icon: HistoryIcon,
    render: (context) => <HistoryPage fontSize={context.preferences.editorFontSize} />,
  },
  {
    key: 'console',
    label: 'SQL Console',
    description: '多标签编辑与导出',
    icon: TerminalSquare,
    render: () => <SqlConsolePage />,
  },
  {
    key: 'knowledge',
    label: '业务知识',
    description: '术语与 SQL 示例',
    icon: BookOpen,
    render: () => <KnowledgePage />,
  },
  {
    key: 'studio',
    label: 'Agent Studio',
    description: '配置与发布 Agent',
    icon: Bot,
    render: () => <StudioPage />,
  },
  {
    key: 'skills',
    label: 'Skills',
    description: '可复用任务指引',
    icon: BookMarked,
    render: () => <SkillsPage />,
  },
  {
    key: 'mcp',
    label: 'MCP 服务',
    description: '用户级连接与工具发现',
    icon: Plug,
    render: () => <McpServersPage />,
  },
  {
    key: 'workspace',
    label: '工作空间',
    description: '成员与资源授权',
    icon: Users,
    render: () => <WorkspacePage />,
  },
  {
    key: 'memory',
    label: '长期记忆',
    description: '跨会话事实与偏好',
    icon: Brain,
    render: () => <MemoryPage />,
  },
  {
    key: 'report',
    label: '分析报告',
    description: '真实数据图表与报告',
    icon: BarChart3,
    render: (context) => <ReportPage focus={context.artifactFocus ?? null} />,
  },
  {
    key: 'workflow',
    label: '工作流',
    description: '可视化 DAG 编排',
    icon: WorkflowIcon,
    render: () => <WorkflowPage />,
  },
  {
    key: 'settings',
    label: '设置',
    description: '本地界面偏好',
    icon: Settings,
    render: (context) => (
      <SettingsPage
        preferences={context.preferences}
        onThemeChange={context.onThemeChange}
        onFontSizeChange={context.onFontSizeChange}
        onReset={context.onResetPreferences}
      />
    ),
  },
  {
    key: 'admin',
    label: '平台管理',
    description: '模型、监控与配额',
    icon: ShieldCheck,
    render: () => <AdminPage />,
  },
];

/** 按 key 取路由；未命中时回退首个路由（工作台），与既有标题回退一致。 */
export function findWorkspaceRoute(key: WorkspacePageKey): WorkspaceRoute {
  return workspaceRoutes.find((route) => route.key === key) ?? workspaceRoutes[0];
}
