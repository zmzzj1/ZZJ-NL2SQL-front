import type { LucideIcon } from 'lucide-react';
import { FileQuestion } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
}

/** 统一的空状态组件：没有可展示内容时给出说明，而不是伪造数据。 */
export function EmptyState({ title, description, icon: Icon = FileQuestion, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line bg-panel-muted/60 px-6 py-10 text-center">
      <Icon className="h-7 w-7 text-ink-muted" aria-hidden="true" />
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-md text-xs leading-relaxed text-ink-muted">{description}</p> : null}
      {children}
    </div>
  );
}
