import { useState } from 'react';
import { ArrowRight, Database, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { describeError } from '../api/http';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = 'login' | 'register';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, displayName: string, password: string) => Promise<void>;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

function validate(mode: Mode, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) {
    errors.email = '请输入邮箱地址';
  } else if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = '邮箱格式不正确';
  }
  if (!password) {
    errors.password = '请输入密码';
  } else if (mode === 'register') {
    if (password.length < 8) {
      errors.password = '密码至少 8 位';
    } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      errors.password = '密码需同时包含字母和数字';
    }
  }
  return errors;
}

/**
 * 真实身份入口：登录/注册均调用服务端 API，Session 由 HttpOnly Cookie 维护。
 */
export function LoginPage({ onLogin, onRegister }: LoginPageProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setServerError('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(mode, email, password);
    setErrors(nextErrors);
    setServerError('');
    if (nextErrors.email || nextErrors.password) return;

    setBusy(true);
    try {
      if (mode === 'login') {
        await onLogin(email.trim(), password);
      } else {
        await onRegister(email.trim(), displayName.trim(), password);
      }
    } catch (error) {
      setServerError(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full bg-canvas px-4 py-8">
      <div className="mx-auto grid max-w-5xl items-center gap-6 lg:grid-cols-2">
        <section className="card theme-transition p-6 lg:p-8">
          <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            真实身份
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">QueryForge</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            面向 SQL 取数与分析的 AI 工作台。登录后可管理自己的 MySQL 数据源，在真实表结构上生成并执行只读查询。
          </p>

          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-line bg-panel-muted p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Database className="h-4 w-4 text-accent" aria-hidden="true" />
                本阶段能力
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-ink-muted">
                <li>注册、登录、退出，连接配置按用户隔离</li>
                <li>创建并测试 MySQL 连接，浏览真实表结构</li>
                <li>按选中数据源生成 SQL，显式执行只读查询</li>
              </ul>
            </div>
            <div className="rounded-lg border border-line bg-panel-muted p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
                安全边界
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                连接密码由服务端加密保存，接口不返回密码；SQL 执行只允许当前连接库内的单条 SELECT。
              </p>
            </div>
          </div>
        </section>

        <section className="card theme-transition p-6 lg:p-8">
          <div className="flex items-center gap-2" role="tablist" aria-label="登录或注册">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'btn-primary px-3 py-1.5 text-xs' : 'btn-muted px-3 py-1.5 text-xs'}
              onClick={() => switchMode('login')}
            >
              登录
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'btn-primary px-3 py-1.5 text-xs' : 'btn-muted px-3 py-1.5 text-xs'}
              onClick={() => switchMode('register')}
            >
              注册
            </button>
          </div>

          <h2 className="mt-4 text-lg font-semibold text-ink">{mode === 'login' ? '登录工作台' : '创建账号'}</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            {mode === 'login'
              ? '使用注册邮箱和密码登录；会话保存在 HttpOnly Cookie 中。'
              : '注册后会自动登录。密码至少 8 位并同时包含字母和数字。'}
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
            {mode === 'register' ? (
              <div>
                <label className="field-label" htmlFor="register-display-name">
                  展示名（可选）
                </label>
                <input
                  id="register-display-name"
                  className="input-field"
                  value={displayName}
                  maxLength={64}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="nickname"
                />
              </div>
            ) : null}

            <div>
              <label className="field-label" htmlFor="login-email">
                邮箱
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                className="input-field"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
              />
              {errors.email ? (
                <p id="login-email-error" role="alert" className="mt-1.5 text-xs text-danger">
                  {errors.email}
                </p>
              ) : null}
            </div>

            <div>
              <label className="field-label" htmlFor="login-password">
                密码
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="input-field"
                placeholder={mode === 'login' ? '请输入密码' : '至少 8 位，包含字母和数字'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
              />
              {errors.password ? (
                <p id="login-password-error" role="alert" className="mt-1.5 text-xs text-danger">
                  {errors.password}
                </p>
              ) : null}
            </div>

            {serverError ? (
              <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                {serverError}
              </p>
            ) : null}

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              )}
              {mode === 'login' ? '登录工作台' : '注册并登录'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
