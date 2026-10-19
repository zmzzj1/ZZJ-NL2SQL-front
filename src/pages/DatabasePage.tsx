import { useCallback, useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import { fetchConnectionSchema } from '../api/connections';
import { describeError } from '../api/http';
import type { Connection, ConnectionInput, ConnectionTestResult, SchemaResponse } from '../api/contract';
import { ConnectionForm } from '../features/connections/ConnectionForm';
import { ConnectionList } from '../features/connections/ConnectionList';
import { SchemaPanel } from '../features/connections/SchemaPanel';
import { useConnections } from '../features/connections/useConnections';

interface Feedback {
  tone: 'success' | 'error' | 'info';
  message: string;
}

/**
 * 数据源页：真实 CRUD、真实连通性测试与 JDBC 元数据表结构。
 * 所有操作都依赖当前登录用户，前端不传 userId。
 */
export function DatabasePage() {
  const { connections, loading, error, reload, create, update, remove, test } = useConnections();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState('');

  const selected = connections.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (creating) return;
    if (connections.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !connections.some((item) => item.id === selectedId)) {
      setSelectedId(connections[0].id);
    }
  }, [connections, creating, selectedId]);

  const loadSchema = useCallback(async (id: number) => {
    setSchemaLoading(true);
    setSchemaError('');
    try {
      setSchema(await fetchConnectionSchema(id));
    } catch (loadError) {
      setSchema(null);
      setSchemaError(describeError(loadError));
    } finally {
      setSchemaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) {
      setSchema(null);
      setSchemaError('');
      return;
    }
    void loadSchema(selected.id);
  }, [loadSchema, selected]);

  const startCreate = () => {
    setCreating(true);
    setSelectedId(null);
    setFeedback(null);
    setTestResult(null);
    setSchema(null);
    setSchemaError('');
    setConfirmDelete(false);
  };

  const selectConnection = (connection: Connection) => {
    setCreating(false);
    setSelectedId(connection.id);
    setFeedback(null);
    setTestResult(null);
    setConfirmDelete(false);
  };

  const saveConnection = async (input: ConnectionInput) => {
    setSaving(true);
    setFeedback(null);
    try {
      if (creating || !selected) {
        const created = await create(input);
        setCreating(false);
        setSelectedId(created.id);
        setFeedback({ tone: 'success', message: `已创建连接「${created.name}」` });
      } else {
        const updated = await update(selected.id, input);
        setFeedback({ tone: 'success', message: `已保存连接「${updated.name}」` });
      }
    } catch (saveError) {
      setFeedback({ tone: 'error', message: describeError(saveError) });
    } finally {
      setSaving(false);
    }
  };

  const testSelected = async () => {
    if (!selected) return;
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await test(selected.id));
    } catch (testError) {
      setTestResult({ success: false, message: describeError(testError), latencyMs: 0 });
    } finally {
      setTesting(false);
    }
  };

  const deleteSelected = async () => {
    if (!selected) return;
    // 用两段式确认替代 window.confirm：内嵌预览面板会静默拦截原生确认框。
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setFeedback(null);
    try {
      await remove(selected.id);
      setSelectedId(null);
      setConfirmDelete(false);
      setSchema(null);
      setTestResult(null);
      setFeedback({ tone: 'info', message: `已删除连接「${selected.name}」` });
    } catch (deleteError) {
      setFeedback({ tone: 'error', message: describeError(deleteError) });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel-muted px-4 py-3">
        <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
          <Database className="h-3 w-3" aria-hidden="true" />
          真实连接
        </span>
        <p className="text-xs text-ink-muted">
          MySQL 连接配置按用户持久化；密码加密保存，接口不返回密码。首次仅支持 MySQL，PostgreSQL 暂不支持。
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <ConnectionList
          connections={connections}
          selectedId={selectedId}
          loading={loading}
          error={error}
          onSelect={selectConnection}
          onCreate={startCreate}
          onReload={() => void reload()}
        />

        <div className="space-y-4">
          {creating || selected ? (
            <ConnectionForm
              key={creating ? 'create' : `connection-${selected?.id}`}
              initial={creating ? null : selected}
              saving={saving}
              testing={testing}
              deleting={deleting}
              testResult={testResult}
              feedback={feedback?.message ?? ''}
              onSave={saveConnection}
              onTest={testSelected}
              onDelete={deleteSelected}
              confirmDelete={confirmDelete}
            />
          ) : (
            <section className="card p-6 text-sm text-ink-muted">
              选择左侧连接查看详情，或点击「新增」创建第一个 MySQL 数据源。
              {feedback ? (
                <p role="status" className={`mt-3 text-xs ${feedback.tone === 'error' ? 'text-danger' : 'text-ink'}`}>
                  {feedback.message}
                </p>
              ) : null}
            </section>
          )}

          {selected && !creating ? (
            <SchemaPanel
              schema={schema}
              loading={schemaLoading}
              error={schemaError}
              onRefresh={() => void loadSchema(selected.id)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
