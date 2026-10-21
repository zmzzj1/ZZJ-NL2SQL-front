import { useCallback, useMemo, useState } from 'react';
import type { ExecutionResult, SchemaResponse } from '../../api/contract';
import { describeError } from '../../api/http';
import { executeSql } from '../../api/sql';
import { fetchConnectionSchema } from '../../api/connections';

export interface ConsoleTab {
  id: string;
  title: string;
  connectionId: number | null;
  sql: string;
  execution: {
    status: 'idle' | 'running' | 'done' | 'error';
    result?: ExecutionResult;
    errorMessage?: string;
  };
  schema: SchemaResponse | null;
  schemaError: string | null;
}

let tabSeq = 0;
function nextId(): string {
  tabSeq += 1;
  return `tab-${Date.now()}-${tabSeq}`;
}

function createTab(connectionId: number | null, index: number): ConsoleTab {
  return {
    id: nextId(),
    title: `查询 ${index}`,
    connectionId,
    sql: '',
    execution: { status: 'idle' },
    schema: null,
    schemaError: null,
  };
}

/**
 * 多标签 SQL Console 状态：每个标签独立保存 SQL 文本、绑定连接、结果与错误，
 * 切换标签互不串数据。执行复用 /v1/sql/execute（服务端 SQL Guard + 权限校验）。
 */
export function useSqlConsoleTabs(defaultConnectionId: number | null) {
  const [tabs, setTabs] = useState<ConsoleTab[]>(() => [createTab(defaultConnectionId, 1)]);
  const [activeId, setActiveId] = useState<string>(() => tabs[0].id);

  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeId) ?? tabs[0], [tabs, activeId]);

  const addTab = useCallback(() => {
    const tab = createTab(defaultConnectionId, tabs.length + 1);
    setTabs((current) => [...current, tab]);
    setActiveId(tab.id);
  }, [defaultConnectionId, tabs.length]);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((current) => {
        if (current.length <= 1) return current;
        const remaining = current.filter((tab) => tab.id !== id);
        if (id === activeId) {
          const index = current.findIndex((tab) => tab.id === id);
          setActiveId(remaining[Math.max(0, index - 1)].id);
        }
        return remaining;
      });
    },
    [activeId],
  );

  const updateTab = useCallback((id: string, patch: Partial<ConsoleTab>) => {
    setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)));
  }, []);

  const setActiveSql = useCallback(
    (sql: string) => {
      updateTab(activeId, { sql });
    },
    [activeId, updateTab],
  );

  const setActiveConnection = useCallback(
    (connectionId: number | null) => {
      updateTab(activeId, { connectionId, sql: '', schema: null, schemaError: null, execution: { status: 'idle' } });
    },
    [activeId, updateTab],
  );

  const loadSchema = useCallback(
    async (connectionId: number | null) => {
      if (connectionId === null) {
        updateTab(activeId, { schema: null, schemaError: null });
        return;
      }
      try {
        const schema = await fetchConnectionSchema(connectionId);
        updateTab(activeId, { schema, schemaError: null });
      } catch (error) {
        updateTab(activeId, { schema: null, schemaError: describeError(error) });
      }
    },
    [activeId, updateTab],
  );

  const runActive = useCallback(async () => {
    const tab = activeTab;
    if (tab.connectionId === null || !tab.sql.trim()) return;
    updateTab(tab.id, { execution: { status: 'running' } });
    try {
      const result = await executeSql(tab.connectionId, tab.sql, null);
      updateTab(tab.id, { execution: { status: 'done', result } });
    } catch (error) {
      updateTab(tab.id, { execution: { status: 'error', errorMessage: describeError(error) } });
    }
  }, [activeTab, updateTab]);

  return {
    tabs,
    activeId,
    activeTab,
    setActiveId,
    addTab,
    closeTab,
    setActiveSql,
    setActiveConnection,
    loadSchema,
    runActive,
  };
}
