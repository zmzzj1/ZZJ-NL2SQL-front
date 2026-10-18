/**
 * P0-F01 只描述「界面确实需要」的数据形状，
 * 不代表后端 API 契约，也不涉及任何持久化实体。
 */

/** 应用外壳内的五个约定页面；login 由演示会话的有无决定。 */
export type PageKey = 'login' | 'dashboard' | 'database' | 'history' | 'settings';

/** 进入演示会话后可导航的工作台页面。 */
export type WorkspacePageKey = Exclude<PageKey, 'login'>;

export type MessageRole = 'user' | 'assistant';

/** Dashboard 对话中的一条消息。 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

/** 标记为「演示结果」的表格数据，永不来自真实查询。 */
export interface DemoResultTable {
  columns: string[];
  rows: string[][];
  note: string;
}

export type ConnectionEngine = 'mysql' | 'postgresql';

/** 演示连接条目；所有凭据均为虚构占位值。 */
export interface ConnectionPreview {
  id: string;
  name: string;
  engine: ConnectionEngine;
  host: string;
  port: number;
  demoStatus: 'sample-active' | 'sample-idle';
}

/** Database 页表单里可编辑的字段。 */
export interface ConnectionDraft {
  name: string;
  engine: ConnectionEngine;
  host: string;
  port: number;
  username: string;
  database: string;
}

export type ConnectionEntry = ConnectionPreview & { draft: ConnectionDraft };

export interface QueryHistoryItem {
  id: string;
  title: string;
  prompt: string;
  sql: string;
  createdAt: string;
  demoStatus: 'example-success' | 'example-failed';
}

export type ThemePreference = 'light' | 'dark';

/** 仅保存在浏览器本地的 UI 偏好，不含任何凭据。 */
export interface UiPreferences {
  theme: ThemePreference;
  editorFontSize: number;
}

/** 演示会话：明确只是前端状态，不具备任何鉴权含义。 */
export interface DemoSession {
  email: string;
  signedInAt: string;
}
