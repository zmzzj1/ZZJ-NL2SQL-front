import { useCallback, useEffect, useState } from 'react';
import {
  createConnection,
  deleteConnection,
  listConnections,
  testConnection,
  updateConnection,
} from '../../api/connections';
import type { Connection, ConnectionInput, ConnectionTestResult } from '../../api/contract';

/**
 * 连接列表的加载与增删改测试。错误抛给调用方展示，列表本身保留最近一次成功结果。
 */
export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setConnections(await listConnections());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载连接失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(async (input: ConnectionInput) => {
    const created = await createConnection(input);
    setConnections((current) => [...current, created]);
    return created;
  }, []);

  const update = useCallback(async (id: number, input: ConnectionInput) => {
    const updated = await updateConnection(id, input);
    setConnections((current) => current.map((item) => (item.id === id ? updated : item)));
    return updated;
  }, []);

  const remove = useCallback(async (id: number) => {
    await deleteConnection(id);
    setConnections((current) => current.filter((item) => item.id !== id));
  }, []);

  const test = useCallback(async (id: number): Promise<ConnectionTestResult> => testConnection(id), []);

  return { connections, loading, error, reload, create, update, remove, test };
}
