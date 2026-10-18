import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError, executeSql, streamSqlGeneration } from '../../api/client';
import type { ExecutionResult } from '../../api/contract';
import type { ChatMessage } from '../../types';

/** 演示库的公开字段说明；界面上明确标注为演示 Schema。 */
const DEMO_SCHEMA_CONTEXT = `demo_orders(id BIGINT, customer_id BIGINT, amount DECIMAL(12,2), status VARCHAR(16), created_at DATETIME)
demo_customers(id BIGINT, name VARCHAR(64), city VARCHAR(64), created_at DATETIME)
demo_order_items(id BIGINT, order_id BIGINT, sku VARCHAR(32), quantity INT, price DECIMAL(10,2))`;

const GREETING: ChatMessage = {
  id: 'msg-greeting',
  role: 'assistant',
  content:
    '已接入真实后端：输入问题后，SQL 会从模型流式返回；只有你点击「执行查询」，才会以只读方式访问本地演示库 sql_demo。',
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
 * SQL 工作台的状态机：
 * 1) 自然语言 -> SSE 流式生成 SQL；
 * 2) 用户显式执行 -> 只读演示库结果。
 * 负责取消、防止迟到片段覆盖新请求，以及卸载时释放连接。
 */
export function useSqlWorkspace() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [generation, setGeneration] = useState<GenerationState>(IDLE_GENERATION);
  const [execution, setExecution] = useState<ExecutionState>(IDLE_EXECUTION);
  const [lastQuestion, setLastQuestion] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const runSeqRef = useRef(0);
  const sqlAccumulatorRef = useRef('');

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const trimmedInput = input.trim();
  const canSend = trimmedInput.length > 0 && generation.status !== 'streaming';
  const sqlLooksReadOnly = looksLikeReadOnlySql(generation.sql);
  const canExecute =
    generation.status === 'done' &&
    generation.sql.trim().length > 0 &&
    sqlLooksReadOnly &&
    execution.status !== 'running';

  const sendQuestion = useCallback(
    (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question || generation.status === 'streaming') return;

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
        { userInput: question, schemaContext: DEMO_SCHEMA_CONTEXT, strategyName: 'default' },
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
                sql ? 'SQL 已生成。请检查语句后点击「执行查询」，结果来自本地演示库。' : '模型没有返回任何 SQL 内容。',
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
    [generation.status],
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
    if (!canExecute) return;
    setExecution({ status: 'running' });
    try {
      const result = await executeSql(sql);
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
