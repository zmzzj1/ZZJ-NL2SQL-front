import { useState } from 'react';
import { ArrowRight, FlaskConical, ShieldAlert } from 'lucide-react';
import { DemoBadge } from '../components/ui/DemoBadge';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEMO_EMAIL = 'demo@queryforge.local';
const DEMO_PASSWORD = 'demo-password';

interface LoginPageProps {
  onSignIn: (email: string) => void;
}

interface LoginErrors {
  email?: string;
  password?: string;
}

function validate(email: string, password: string): LoginErrors {
  const errors: LoginErrors = {};
  const trimmedEmail = email.trim();

  if (trimmedEmail.length === 0) {
    errors.email = '请输入邮箱地址';
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = '邮箱格式不正确，示例：demo@queryforge.local';
  }

  if (password.length === 0) {
    errors.password = '请输入密码';
  }

  return errors;
}

/**
 * 演示登录：只切换前端会话状态，不做任何身份认证，也不保存密码。
 */
export function LoginPage({ onSignIn }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(email, password);
    setErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;
    onSignIn(email.trim());
  };

  const fillDemoCredentials = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setErrors({});
  };

  return (
    <div className="min-h-full bg-canvas px-4 py-8">
      <div className="mx-auto grid max-w-5xl items-center gap-6 lg:grid-cols-2">
        <section className="card theme-transition p-6 lg:p-8">
          <DemoBadge>P0-F01 演示版</DemoBadge>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink">QueryForge</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            面向 SQL 取数与分析的演示工作台。当前版本用于验证界面结构与交互流程，还没有连接后端、数据库和大模型。
          </p>

          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-line bg-panel-muted p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <FlaskConical className="h-4 w-4 text-accent" aria-hidden="true" />
                本版可以做的事
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-ink-muted">
                <li>浏览工作台、数据库连接、历史记录、设置五个页面</li>
                <li>在 Dashboard 输入问题，查看明确标注为「演示数据」的固定 SQL</li>
                <li>复制演示 SQL、筛选演示历史、调整本地主题与字号</li>
              </ul>
            </div>
            <div className="rounded-lg border border-line bg-panel-muted p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ShieldAlert className="h-4 w-4 text-warn" aria-hidden="true" />
                本版还没有能力
              </h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-ink-muted">
                <li>真实身份认证、注册与找回密码</li>
                <li>真实数据库连接、SQL 执行与结果返回</li>
                <li>大模型调用、流式响应、文件上传</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="card theme-transition p-6 lg:p-8">
          <h2 className="text-lg font-semibold text-ink">演示登录</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            此处仅校验输入格式并切换前端演示状态，不会向任何服务发送请求。
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
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
                placeholder="demo@queryforge.local"
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
                autoComplete="current-password"
                className="input-field"
                placeholder="任意非空密码即可用于演示"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? 'login-password-error' : 'login-password-hint'}
              />
              {errors.password ? (
                <p id="login-password-error" role="alert" className="mt-1.5 text-xs text-danger">
                  {errors.password}
                </p>
              ) : (
                <p id="login-password-hint" className="mt-1.5 text-xs text-ink-muted">
                  演示模式不校验密码，也不会保存或传输它。
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn-primary">
                进入工作台
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" className="btn-secondary" onClick={fillDemoCredentials}>
                填入示例凭证
              </button>
            </div>
          </form>

          <p className="mt-5 border-t border-line pt-4 text-xs text-ink-muted">
            注册与找回密码暂未开放，将在后续阶段评估。
          </p>
        </section>
      </div>
    </div>
  );
}
