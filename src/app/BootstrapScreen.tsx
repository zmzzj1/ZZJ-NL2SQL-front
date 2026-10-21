import { Loader2 } from 'lucide-react';

/**
 * 启动初始化态：CSRF 取号与 /auth/me 会话恢复完成前展示。
 * 与登录页、工作外壳共同构成 App 的三态门禁。
 */
export function BootstrapScreen() {
  return (
    <div className="grid min-h-full place-items-center bg-canvas">
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        正在恢复登录状态…
      </div>
    </div>
  );
}
