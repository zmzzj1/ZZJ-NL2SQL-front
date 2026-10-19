import type { ConversationMessage, MessageStatus } from '../../api/contract';
import type { ChatMessage } from '../../types';

export const GREETING: ChatMessage = {
  id: 'msg-greeting',
  role: 'assistant',
  content:
    '已接入真实后端：选择数据源后输入问题，SQL 会基于该连接的真实表结构流式生成；只有你点击「执行查询」，才会在该数据源上执行只读 SELECT。',
  createdAt: '刚刚',
};

/** 后端返回的本地时间（无时区）按浏览器本地时间展示。 */
export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '刚刚';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

/** 服务端消息 -> 聊天消息；助手消息保留生成状态用于展示徽标。 */
export function toChatMessages(messages: ConversationMessage[]): ChatMessage[] {
  if (messages.length === 0) return [GREETING];
  return messages.map((message) => ({
    id: `srv-${message.id}`,
    role: message.role === 'USER' ? 'user' : 'assistant',
    content: message.content,
    createdAt: formatMessageTime(message.createdAt),
    status: message.status,
  }));
}

let localSequence = 0;

/** 仅存在于当前页面的乐观消息；刷新后以服务端记录为准。 */
export function localMessage(role: ChatMessage['role'], content: string, status?: MessageStatus): ChatMessage {
  localSequence += 1;
  return {
    id: `local-${Date.now()}-${localSequence}`,
    role,
    content,
    createdAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    status,
  };
}
