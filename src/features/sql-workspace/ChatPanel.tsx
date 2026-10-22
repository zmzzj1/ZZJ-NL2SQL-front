import { useEffect, useRef, type ReactNode } from 'react';
import { Eraser, Loader2, Send, Sparkles, Square } from 'lucide-react';
import type { MessageStatus } from '../../api/contract';
import type { ChatMessage } from '../../types';

const QUICK_PROMPTS = ['统计记录数量', '按时间统计趋势', '查看前 10 条记录'];

const STATUS_LABEL: Record<MessageStatus, string> = {
  IN_PROGRESS: '生成中',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELED: '已取消',
};

const STATUS_CLASS: Record<MessageStatus, string> = {
  IN_PROGRESS: 'border-accent/40 bg-accent-soft text-accent',
  COMPLETED: 'border-success/40 bg-success/10 text-success',
  FAILED: 'border-danger/40 bg-danger/10 text-danger',
  CANCELED: 'border-line bg-panel-muted text-ink-muted',
};

interface ChatPanelProps {
  messages: ChatMessage[];
  input: string;
  generating: boolean;
  loading?: boolean;
  error?: string | null;
  /** 流式中的提示文案；Agent 模式与单步 SQL 不同。 */
  progressLabel?: string;
  canSend: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onClear: () => void;
  /** P14-A：Agent 模式的工具选择插槽（单步 SQL 模式不渲染）。 */
  toolSlot?: ReactNode;
}

/** 左侧对话区：只负责消息展示与输入交互，数据与请求由 useSqlWorkspace 管理。 */
export function ChatPanel({
  messages,
  input,
  generating,
  loading = false,
  error = null,
  progressLabel = '正在从后端流式接收 SQL…',
  canSend,
  onInputChange,
  onSend,
  onCancel,
  onClear,
  toolSlot,
}: ChatPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, generating]);

  return (
    <section
      aria-label="提问对话区"
      className="flex min-w-0 flex-col rounded-xl border border-line bg-panel lg:h-full lg:w-[42%]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold text-ink">提问</h2>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
            真实会话
          </span>
          <button type="button" className="btn-muted px-2 py-1 text-xs" onClick={onClear}>
            <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
            新对话
          </button>
        </div>
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {loading ? (
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            正在加载会话消息…
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            加载会话失败：{error}
          </p>
        ) : null}

        {messages.map((item) => {
          const status = item.role === 'assistant' ? item.status : undefined;
          const asSql = item.role === 'assistant' && item.status === 'COMPLETED' && item.content.trim().length > 0;
          return (
            <article
              key={item.id}
              className={`flex flex-col gap-1 ${item.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 text-[11px] text-ink-muted">
                <span className="font-semibold">{item.role === 'user' ? '我' : '助手'}</span>
                <span>{item.createdAt}</span>
                {status ? (
                  <span
                    className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_CLASS[status]}`}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                ) : null}
              </div>
              {asSql ? (
                <pre className="max-w-[92%] overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-panel-muted px-3 py-2 font-mono text-xs leading-relaxed text-ink">
                  <code>{item.content}</code>
                </pre>
              ) : (
                <p
                  className={`max-w-[92%] whitespace-pre-wrap break-words rounded-xl border px-3 py-2 text-sm leading-relaxed ${
                    item.role === 'user'
                      ? 'border-accent/30 bg-accent-soft text-ink'
                      : 'border-line bg-panel-muted text-ink'
                  }`}
                >
                  {item.content}
                </p>
              )}
            </article>
          );
        })}

        {generating ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-line bg-panel-muted px-3 py-2 text-xs text-ink-muted">
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" aria-hidden="true" />
              {progressLabel}
            </span>
            <button type="button" className="btn-muted px-2 py-1 text-[11px]" onClick={onCancel}>
              <Square className="h-3 w-3" aria-hidden="true" />
              取消生成
            </button>
          </div>
        ) : null}
      </div>

      <div className="border-t border-line p-3">
        <div className="mb-2 flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="btn-muted px-2 py-1 text-[11px]"
              onClick={() => onInputChange(prompt)}
            >
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {prompt}
            </button>
          ))}
        </div>

        {toolSlot ? <div className="mb-2">{toolSlot}</div> : null}

        <label className="sr-only" htmlFor="dashboard-input">
          提问内容
        </label>
        <textarea
          id="dashboard-input"
          className="input-field h-20 resize-none"
          placeholder="输入问题，例如：统计记录数量"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            onSend();
          }}
        />

        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[11px] text-ink-muted">
            <span className="kbd-hint">Enter</span> 发送 · <span className="kbd-hint">Shift</span>+
            <span className="kbd-hint">Enter</span> 换行
          </p>
          <div className="flex items-center gap-2">
            {generating ? (
              <button type="button" className="btn-secondary" onClick={onCancel}>
                <Square className="h-4 w-4" aria-hidden="true" />
                取消
              </button>
            ) : null}
            <button id="dashboard-send" type="button" className="btn-primary" onClick={onSend} disabled={!canSend}>
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              发送
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
