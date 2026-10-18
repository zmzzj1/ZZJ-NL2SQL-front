import { useEffect, useRef } from 'react';
import { Eraser, Loader2, Send, Sparkles, Square } from 'lucide-react';
import type { ChatMessage } from '../../types';
import { DemoBadge } from '../../components/ui/DemoBadge';

const QUICK_PROMPTS = ['统计每个月的订单金额', '统计订单数量', '按城市统计客户数'];

interface ChatPanelProps {
  messages: ChatMessage[];
  input: string;
  generating: boolean;
  canSend: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onClear: () => void;
}

/** 左侧对话区：只负责消息展示与输入交互，数据与请求由 useSqlWorkspace 管理。 */
export function ChatPanel({
  messages,
  input,
  generating,
  canSend,
  onInputChange,
  onSend,
  onCancel,
  onClear,
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
          <DemoBadge variant="neutral">演示 Schema</DemoBadge>
          <button type="button" className="btn-muted px-2 py-1 text-xs" onClick={onClear}>
            <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
            清空
          </button>
        </div>
      </div>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.map((item) => (
          <article
            key={item.id}
            className={`flex flex-col gap-1 ${item.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-2 text-[11px] text-ink-muted">
              <span className="font-semibold">{item.role === 'user' ? '我' : '助手'}</span>
              <span>{item.createdAt}</span>
            </div>
            <p
              className={`max-w-[92%] whitespace-pre-wrap break-words rounded-xl border px-3 py-2 text-sm leading-relaxed ${
                item.role === 'user'
                  ? 'border-accent/30 bg-accent-soft text-ink'
                  : 'border-line bg-panel-muted text-ink'
              }`}
            >
              {item.content}
            </p>
          </article>
        ))}

        {generating ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-line bg-panel-muted px-3 py-2 text-xs text-ink-muted">
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" aria-hidden="true" />
              正在从后端流式接收 SQL…
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

        <label className="sr-only" htmlFor="dashboard-input">
          提问内容
        </label>
        <textarea
          id="dashboard-input"
          className="input-field h-20 resize-none"
          placeholder="输入问题，例如：统计每个月的订单金额"
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
