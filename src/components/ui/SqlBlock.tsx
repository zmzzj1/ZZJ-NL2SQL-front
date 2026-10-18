import type { ReactNode } from 'react';
import { CopyButton } from './CopyButton';
import { DemoBadge } from './DemoBadge';

interface SqlBlockProps {
  sql: string;
  fontSize: number;
  title?: string;
  /** 真实生成与演示数据必须使用不同标记。 */
  badge?: ReactNode;
}

/**
 * SQL 展示区：字号来自 Settings 偏好，长 SQL 横向滚动、不撑破布局。
 */
export function SqlBlock({ sql, fontSize, title = 'demo_query.sql', badge }: SqlBlockProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-code-canvas">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-code-ink/70">{title}</span>
          {badge ?? <DemoBadge />}
        </div>
        <CopyButton value={sql} label="复制 SQL" />
      </div>
      <pre
        className="max-h-72 overflow-auto px-4 py-3 font-mono leading-relaxed text-code-ink"
        style={{ fontSize: `${fontSize}px` }}
        tabIndex={0}
      >
        <code>{sql}</code>
      </pre>
    </div>
  );
}
