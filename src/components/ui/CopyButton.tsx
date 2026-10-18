import { Check, Copy, TriangleAlert } from 'lucide-react';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

interface CopyButtonProps {
  value: string;
  label?: string;
  disabled?: boolean;
}

/** 复制按钮：成功与失败都给出可见且可读屏的反馈。 */
export function CopyButton({ value, label = '复制', disabled = false }: CopyButtonProps) {
  const { copyState, copy } = useCopyToClipboard();

  const feedback = copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败，请手动选择' : null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="btn-muted px-2.5 py-1.5 text-xs"
        onClick={() => void copy(value)}
        disabled={disabled}
      >
        {copyState === 'copied' ? (
          <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
        ) : copyState === 'failed' ? (
          <TriangleAlert className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {label}
      </button>
      <span role="status" aria-live="polite" className="text-xs text-ink-muted">
        {feedback}
      </span>
    </div>
  );
}
