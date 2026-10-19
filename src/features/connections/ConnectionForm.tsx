import { useEffect, useState } from 'react';
import { Loader2, PlugZap, Save, Trash2 } from 'lucide-react';
import type { Connection, ConnectionInput, ConnectionTestResult } from '../../api/contract';

interface ConnectionFormProps {
  initial: Connection | null;
  saving: boolean;
  testing: boolean;
  deleting: boolean;
  testResult: ConnectionTestResult | null;
  feedback: string;
  onSave: (input: ConnectionInput) => Promise<void>;
  onTest: () => Promise<void>;
  onDelete: () => Promise<void>;
  /** 是否已进入删除确认态（第二次点击才真正删除）。 */
  confirmDelete?: boolean;
}

interface FormState {
  name: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  host: '127.0.0.1',
  port: '3306',
  database: '',
  username: '',
  password: '',
};

function toForm(connection: Connection | null): FormState {
  if (!connection) return EMPTY_FORM;
  return {
    name: connection.name,
    host: connection.host,
    port: String(connection.port),
    database: connection.database,
    username: connection.username,
    password: '',
  };
}

/** 真实连接表单：密码可留空（无密码账号如本地 root）；编辑时留空表示沿用服务端已保存的密文。 */
export function ConnectionForm({
  initial,
  saving,
  testing,
  deleting,
  testResult,
  feedback,
  onSave,
  onTest,
  onDelete,
  confirmDelete = false,
}: ConnectionFormProps) {
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(toForm(initial));
    setError('');
  }, [initial]);

  const update = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.host.trim() || !form.database.trim() || !form.username.trim()) {
      setError('名称、主机、数据库和用户名均为必填项');
      return;
    }
    const port = Number(form.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setError('端口需为 1-65535 的整数');
      return;
    }
    setError('');
    await onSave({
      name: form.name.trim(),
      engine: 'mysql',
      host: form.host.trim(),
      port,
      database: form.database.trim(),
      username: form.username.trim(),
      password: form.password || undefined,
    });
  };

  return (
    <section aria-label="连接详情" className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{initial ? '连接详情' : '新增 MySQL 连接'}</h2>
        <span className="rounded-full border border-line bg-panel-muted px-2 py-0.5 text-[11px] text-ink-muted">
          {initial ? `ID ${initial.id}` : '尚未保存'}
        </span>
      </div>

      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submit} noValidate>
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="conn-name">
            连接名称
          </label>
          <input
            id="conn-name"
            className="input-field"
            value={form.name}
            maxLength={100}
            onChange={(event) => update('name', event.target.value)}
            placeholder="例如：商店业务库"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="conn-engine">
            引擎
          </label>
          <select id="conn-engine" className="input-field" value="mysql" disabled>
            <option value="mysql">MySQL</option>
            <option value="postgresql">PostgreSQL（暂不支持）</option>
          </select>
        </div>

        <div>
          <label className="field-label" htmlFor="conn-port">
            端口
          </label>
          <input
            id="conn-port"
            className="input-field"
            inputMode="numeric"
            value={form.port}
            onChange={(event) => update('port', event.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="conn-host">
            主机
          </label>
          <input
            id="conn-host"
            className="input-field"
            value={form.host}
            onChange={(event) => update('host', event.target.value)}
            placeholder="仅允许管理员白名单内的本地主机"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="conn-database">
            数据库
          </label>
          <input
            id="conn-database"
            className="input-field"
            value={form.database}
            maxLength={64}
            onChange={(event) => update('database', event.target.value)}
            placeholder="sql_demo_a"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="conn-username">
            用户名
          </label>
          <input
            id="conn-username"
            className="input-field"
            value={form.username}
            maxLength={64}
            onChange={(event) => update('username', event.target.value)}
            placeholder="只读账号"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="conn-password">
            密码
          </label>
          <input
            id="conn-password"
            type="password"
            className="input-field"
            value={form.password}
            maxLength={128}
            onChange={(event) => update('password', event.target.value)}
            placeholder={initial?.hasPassword ? '留空表示沿用已保存的密码' : '可留空（无密码账号，如本地 root）'}
            autoComplete="new-password"
          />
          <p className="mt-1 text-[11px] text-ink-muted">
            密码只提交一次，服务端加密保存；接口不会返回密码或密文。无密码账号请留空；编辑时留空表示沿用旧密码。
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="sm:col-span-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {error}
          </p>
        ) : null}

        {testResult ? (
          <p
            role="status"
            className={`sm:col-span-2 rounded-lg border px-3 py-2 text-xs ${
              testResult.success
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-danger/40 bg-danger/10 text-danger'
            }`}
          >
            {testResult.message}（{testResult.latencyMs}ms）
          </p>
        ) : null}

        {feedback ? (
          <p
            role="status"
            className="sm:col-span-2 rounded-lg border border-line bg-panel-muted px-3 py-2 text-xs text-ink-muted"
          >
            {feedback}
          </p>
        ) : null}

        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            保存
          </button>
          <button type="button" className="btn-secondary" onClick={() => void onTest()} disabled={!initial || testing}>
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <PlugZap className="h-4 w-4" aria-hidden="true" />
            )}
            测试连接
          </button>
          {initial ? (
            <>
              <button
                type="button"
                className={`btn-secondary ${confirmDelete ? 'bg-danger/10 text-danger' : 'text-danger'}`}
                onClick={() => void onDelete()}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                {confirmDelete ? '确认删除' : '删除'}
              </button>
              {confirmDelete ? (
                <span className="text-[11px] font-semibold text-danger">再次点击「确认删除」将永久删除该连接。</span>
              ) : null}
            </>
          ) : null}
          {!initial ? <span className="text-[11px] text-ink-muted">保存后才能测试连通性。</span> : null}
        </div>
      </form>
    </section>
  );
}
