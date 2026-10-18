import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError } from '../../api/http';
import { executeSql, streamSqlGeneration } from '../../api/sql';
import type { ExecutionResult } from '../../api/contract';
import type { ChatMessage } from '../../types';

const GREETING: ChatMessage = {
  id: 'msg-greeting',
  role: 'assistant',
  content:
    '已接入真实后端：选择数据源后输入问题，SQL 会基于该连接的真实表结构流式生成；只有你点击「执行查询」，才会在该数据源上执行只读 SELECT。',
  createdAt: '刚刚',
};

export type GenerationStatus = 'idle' | 'streaming' | 'done' | 'error';

export interface GenerationState {
  status: GenerationStatus;
  sql: string;
  requestId?: string;
  errorMessage?: string;
}

export type ExecutionStatus = 'idle' | 'running' | 'done' | 'error';

export interface ExecutionState {
  status: ExecutionStatus;
  result?: ExecutionResult;
  errorMessage?: string;
}

const IDLE_GENERATION: GenerationState = { status: 'idle', sql: '' };
const IDLE_EXECUTION: ExecutionState = { status: 'idle' };

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function currentTime(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function message(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: createId('msg'), role, content, createdAt: currentTime() };
}

/** 只在前端做明显非 SQL 的拦截；服务端仍会完整校验。 */
function looksLikeReadOnlySql(sql: string): boolean {
  return /^\s*(select|with)\b/i.test(sql);
}

/**
 * SQL 工作台状态机，绑定当前选中的 connectionId：
 * 生成与执行都携带同一个连接 ID；切换连接会取消未完成 SSE 并清空旧 SQL/结果。
 */
export function useSqlWorkspace(connectionId: number | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [generation, setGeneration] = useState<GenerationState>(IDLE_GENERATION);
  const [execution, setExecution] = useState<ExecutionState>(IDLE_EXECUTION);
  const [lastQuestion, setLastQuestion] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const runSeqRef = useRef(0);
  const sqlAccumulatorRef = useRef('');
  const lastConnectionRef = useRef<number | null>(connectionId);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  // 切换数据源：丢弃旧请求，清空旧 SQL 与结果，避免把 A 库 SQL 提交到 B 库。
  useEffect(() => {
    const previous = lastConnectionRef.current;
    if (previous === connectionId) return;
    lastConnectionRef.current = connectionId;
    runSeqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    sqlAccumulatorRef.current = '';
    setGeneration(IDLE_GENERATION);
    setExecution(IDLE_EXECUTION);
    if (previous !== null && connectionId === null) {
      setMessages((current) => [
        ...current,
        message('assistant', '当前没有可用的数据源，请先在数据库连接页创建连接。'),
      ]);
    } else if (previous !== null) {
      setMessages((current) => [...current, message('assistant', '已切换数据源，之前的 SQL 与查询结果已清空。')]);
    }
  }, [connectionId]);

  const trimmedInput = input.trim();
  const canSend = trimmedInput.length > 0 && generation.status !== 'streaming' && connectionId !== null;
  const sqlLooksReadOnly = looksLikeReadOnlySql(generation.sql);
  const canExecute =
    connectionId !== null &&
    generation.status === 'done' &&
    generation.sql.trim().length > 0 &&
    sqlLooksReadOnly &&
    execution.status !== 'running';

  const sendQuestion = useCallback(
    (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question || connectionId === null || generation.status === 'streaming') return;

      setInput('');
      setLastQuestion(question);
      setExecution(IDLE_EXECUTION);
      setGeneration({ status: 'streaming', sql: '' });
      setMessages((current) => [...current, message('user', question)]);

      sqlAccumulatorRef.current = '';
      const runId = runSeqRef.current + 1;
      runSeqRef.current = runId;
      const controller = new AbortController();
      abortRef.current = controller;

      void streamSqlGeneration(
        { userInput: question, connectionId, strategyName: 'default' },
        {
          onStart: (requestId) => {
            if (runSeqRef.current !== runId) return;
            setGeneration((current) => ({ ...current, requestId }));
          },
          onDelta: (text) => {
            if (runSeqRef.current !== runId) return;
            sqlAccumulatorRef.current += text;
            const sql = sqlAccumulatorRef.current;
            setGeneration((current) => (current.status === 'streaming' ? { ...current, sql } : current));
          },
          onComplete: (requestId) => {
            if (runSeqRef.current !== runId) return;
            const sql = sqlAccumulatorRef.current.trim();
            setGeneration({ status: 'done', sql, requestId });
            setMessages((current) => [
              ...current,
              message(
                'assistant',
                sql ? 'SQL 已生成。请检查语句后点击「执行查询」，结果来自当前数据源。' : '模型没有返回任何 SQL 内容。',
              ),
            ]);
          },
        },
        controller.signal,
      )
        .catch((error: unknown) => {
          if (runSeqRef.current !== runId) return;
          if (error instanceof DOMException && error.name === 'AbortError') return;
          const detail = describeError(error);
          setGeneration({ status: 'error', sql: '', errorMessage: detail });
          setMessages((current) => [...current, message('assistant', `生成失败：${detail}`)]);
        })
        .finally(() => {
          if (runSeqRef.current === runId) abortRef.current = null;
        });
    },
    [connectionId, generation.status],
  );

  const sendMessage = () => sendQuestion(input);

  const cancelGeneration = () => {
    runSeqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setGeneration(IDLE_GENERATION);
    setMessages((current) => [...current, message('assistant', '已取消本次 SQL 生成。')]);
  };

  const clearAll = () => {
    runSeqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    sqlAccumulatorRef.current = '';
    setMessages([GREETING]);
    setGeneration(IDLE_GENERATION);
    setExecution(IDLE_EXECUTION);
    setInput('');
    setLastQuestion('');
  };

  const runQuery = async () => {
    const sql = generation.sql.trim();
    if (!canExecute || connectionId === null) return;
    setExecution({ status: 'running' });
    try {
      const result = await executeSql(connectionId, sql);
      setExecution({ status: 'done', result });
    } catch (error) {
      setExecution({ status: 'error', errorMessage: describeError(error) });
    }
  };

  const retryGeneration = () => {
    if (!lastQuestion || generation.status === 'streaming') return;
    sendQuestion(lastQuestion);
  };

  return {
    messages,
    input,
    setInput,
    generation,
    execution,
    canSend,
    canExecute,
    sqlLooksReadOnly,
    sendMessage,
    cancelGeneration,
    clearAll,
    runQuery,
    retryGeneration,
    canRetryGeneration: Boolean(lastQuestion),
  };
}
