/** 页面与界面共享类型；接口契约类型在 `api/contract.ts`。 */

import type { MessageStatus } from '../api/contract';

/** 应用外壳内的页面；未登录时由服务端会话决定显示 Login。 */
export type PageKey =
  | 'login'
  | 'dashboard'
  | 'database'
  | 'history'
  | 'knowledge'
  | 'settings'
  | 'report'
  | 'workflow'
  | 'studio'
  | 'skills';

export type WorkspacePageKey = Exclude<PageKey, 'login'>;

export type MessageRole = 'user' | 'assistant';

/** Dashboard 对话中的一条消息。 */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  /** 仅服务端消息或已结算的本地消息带状态。 */
  status?: MessageStatus;
}

/** 标记为「演示结果」的表格数据，永不来自真实查询。 */
export interface DemoResultTable {
  columns: string[];
  rows: string[][];
  note: string;
}

export type ThemePreference = 'light' | 'dark';

/** 仅保存在浏览器本地的 UI 偏好，不含任何凭据。 */
export interface UiPreferences {
  theme: ThemePreference;
  editorFontSize: number;
}
