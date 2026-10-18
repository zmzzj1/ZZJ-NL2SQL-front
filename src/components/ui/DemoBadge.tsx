type DemoBadgeProps = {
  children?: string;
  variant?: 'neutral' | 'accent';
};

/**
 * 所有 Mock / 未接真实服务的区域都必须带这个标记，
 * 避免出现「已连接」「在线」之类误导性状态。
 */
export function DemoBadge({ children = '演示数据', variant = 'accent' }: DemoBadgeProps) {
  const tone =
    variant === 'accent' ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line bg-panel-muted text-ink-muted';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      {children}
    </span>
  );
}
