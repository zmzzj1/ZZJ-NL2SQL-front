import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchConversation } from '../../api/conversations';
import type { ExecutionResult } from '../../api/contract';
import { describeError } from '../../api/http';
import { cancelSqlGeneration, executeSql, streamSqlGeneration } from '../../api/sql';
import type { ChatMessage } from '../../types';
import { GREETING, localMessage, toChatMessages } from './conversationMessages';

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

interface SqlWorkspaceOptions {
  connectionId: number | null;
  conversationId: number | null;
  /** 首次提问时创建会话并返回服务端 ID；只创建，不修改外层状态。 */
  ensureConversation: (question: string) => Promise<number>;
  /** 会话创建成功后通知外层切换选中会话。 */
  onConversationCreated?: (id: number) => void;
  /** 一次生成结算后通知外层刷新会话列表。 */
  onGenerationSettled?: () => void;
  /** 会话绑定的数据源已失效时，禁止继续提问与执行。 */
  readOnly?: boolean;
}

/** 只在前端做明显非 SQL 的拦截；服务端仍会完整校验。 */
function looksLikeReadOnlySql(sql: string): boolean {
  return /^\s*(select|with)\b/i.test(sql);
}

/**
 * SQL 工作台状态机，绑定当前 conversationId 与 connectionId：
 * 会话消息来自服务端，生成/执行都携带同一连接与会话 ID；
 * 切换会话或数据源会取消未完成 SSE 并按需重新加载消息。
 */
export function useSqlWorkspace({
  connectionId,
  conversationId,
  ensureConversation,
  onConversationCreated,
  onGenerationSettled,
  readOnly = false,
}: SqlWorkspaceOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [generation, setGeneration] = useState<GenerationState>(IDLE_GENERATION);
  const [execution, setExecution] = useState<ExecutionState>(IDLE_EXECUTION);
  const [lastQuestion, setLastQuestion] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const runSeqRef = useRef(0);
  const sqlAccumulatorRef = useRef('');
  const lastConnectionRef = useRef<number | null>(connectionId);
  const justCreatedRef = useRef<number | null>(null);
  const ensureRef = useRef(ensureConversation);
  const createdRef = useRef(onConversationCreated);
  const settledRef = useRef(onGenerationSettled);

  useEffect(() => {
    ensureRef.current = ensureConversation;
  }, [ensureConversation]);

  useEffect(() => {
    createdRef.current = onConversationCreated;
  }, [onConversationCreated]);

  useEffect(() => {
    settledRef.current = onGenerationSettled;
  }, [onGenerationSettled]);

  /** 通知服务端本次生成已取消；失败不影响本地状态，超时回收会兜底。 */
  const cancelRemote = useCallback(() => {
    const requestId = activeRequestIdRef.current;
    activeRequestIdRef.current = null;
    if (!requestId) return;
    void cancelSqlGeneration(requestId).catch(() => {
      // 取消通知失败时保留服务端 IN_PROGRESS，等待超时回收。
    });
  }, []);

  const resetRun = useCallback(() => {
    runSeqRef.current += 1;
    cancelRemote();
    abortRef.current?.abort();
    abortRef.current = null;
    sqlAccumulatorRef.current = '';
    setGeneration(IDLE_GENERATION);
    setExecution(IDLE_EXECUTION);
  }, [cancelRemote]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // 切换会话：新建的会话保留乐观消息与进行中的请求，其余情况取消并重新加载。
  useEffect(() => {
    if (conversationId !== null && justCreatedRef.current === conversationId) {
      justCreatedRef.current = null;
      return;
    }
    resetRun();
    setMessagesError(null);
    if (conversationId === null) {
      setMessages([GREETING]);
      setLoadingMessages(false);
      return;
    }

    let active = true;
    setLoadingMessages(true);
    fetchConversation(conversationId)
      .then((detail) => {
        if (!active) return;
        setMessages(toChatMessages(detail.messages));
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessages([]);
        setMessagesError(describeError(error));
      })
      .finally(() => {
        if (active) setLoadingMessages(false);
      });
    return () => {
      active = false;
    };
  }, [conversationId, resetRun]);

  // 切换数据源：取消旧流并清空旧 SQL/结果，避免把 A 库 SQL 提交到 B 库。
  useEffect(() => {
    if (lastConnectionRef.current === connectionId) return;
    lastConnectionRef.current = connectionId;
    resetRun();
  }, [connectionId, resetRun]);

  const trimmedInput = input.trim();
  const canSend = trimmedInput.length > 0 && generation.status !== 'streaming' && connectionId !== null && !readOnly;
  const sqlLooksReadOnly = looksLikeReadOnlySql(generation.sql);
  const canExecute =
    connectionId !== null &&
    !readOnly &&
    generation.status === 'done' &&
    generation.sql.trim().length > 0 &&
    sqlLooksReadOnly &&
    execution.status !== 'running';

  const sendQuestion = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question || connectionId === null || readOnly || generation.status === 'streaming') return;

      setInput('');
      setLastQuestion(question);
      setExecution(IDLE_EXECUTION);
      setGeneration({ status: 'streaming', sql: '' });
      setMessagesError(null);
      setMessages((current) => [...current, localMessage('user', question)]);
      sqlAccumulatorRef.current = '';
      const runId = runSeqRef.current + 1;
      runSeqRef.current = runId;

      let activeConversationId = conversationId;
      if (activeConversationId == null) {
        try {
          activeConversationId = await ensureRef.current(question);
          // 先记录再通知外层切换，避免切换会话的 effect 清掉正在进行的生成。
          justCreatedRef.current = activeConversationId;
          createdRef.current?.(activeConversationId);
        } catch (error: unknown) {
          if (runSeqRef.current !== runId) return;
          const detail = describeError(error);
          setGeneration({ status: 'error', sql: '', errorMessage: detail });
          setMessages((current) => [...current, localMessage('assistant', `会话创建失败：${detail}`, 'FAILED')]);
          return;
        }
        if (runSeqRef.current !== runId) return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      void streamSqlGeneration(
        {
          userInput: question,
          connectionId,
          conversationId: activeConversationId,
          strategyName: 'default',
        },
        {
          onStart: (requestId) => {
            if (runSeqRef.current !== runId) return;
            activeRequestIdRef.current = requestId;
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
            activeRequestIdRef.current = null;
            const sql = sqlAccumulatorRef.current.trim();
            setGeneration({ status: 'done', sql, requestId });
            setMessages((current) => [
              ...current,
              localMessage('assistant', sql || '模型没有返回任何 SQL 内容。', sql ? 'COMPLETED' : 'FAILED'),
            ]);
            settledRef.current?.();
          },
        },
        controller.signal,
      )
        .catch((error: unknown) => {
          if (runSeqRef.current !== runId) return;
          activeRequestIdRef.current = null;
          if (error instanceof DOMException && error.name === 'AbortError') return;
          const detail = describeError(error);
          const partial = sqlAccumulatorRef.current.trim();
          setGeneration({ status: 'error', sql: '', errorMessage: detail });
          setMessages((current) => [...current, localMessage('assistant', partial || `生成失败：${detail}`, 'FAILED')]);
          settledRef.current?.();
        })
        .finally(() => {
          if (runSeqRef.current === runId) abortRef.current = null;
        });
    },
    [connectionId, conversationId, generation.status, readOnly],
  );

  /** 重新读取当前会话消息；Agent 完成后刷新问题与总结。 */
  const reloadMessages = useCallback(async () => {
    if (conversationId == null) return;
    try {
      const detail = await fetchConversation(conversationId);
      setMessages(toChatMessages(detail.messages));
      setMessagesError(null);
    } catch (error: unknown) {
      setMessagesError(describeError(error));
    }
  }, [conversationId]);

  const sendMessage = () => {
    void sendQuestion(input);
  };

  const cancelGeneration = () => {
    runSeqRef.current += 1;
    cancelRemote();
    abortRef.current?.abort();
    abortRef.current = null;
    const partial = sqlAccumulatorRef.current.trim();
    setGeneration(IDLE_GENERATION);
    setMessages((current) => [...current, localMessage('assistant', partial || '已取消本次 SQL 生成。', 'CANCELED')]);
    settledRef.current?.();
  };

  const startNewConversation = () => {
    resetRun();
    setMessages([GREETING]);
    setMessagesError(null);
    setInput('');
    setLastQuestion('');
  };

  const runQuery = async () => {
    const sql = generation.sql.trim();
    if (!canExecute || connectionId === null) return;
    setExecution({ status: 'running' });
    try {
      const result = await executeSql(connectionId, sql, conversationId);
      setExecution({ status: 'done', result });
    } catch (error: unknown) {
      setExecution({ status: 'error', errorMessage: describeError(error) });
    }
  };

  const retryGeneration = () => {
    if (!lastQuestion || generation.status === 'streaming') return;
    void sendQuestion(lastQuestion);
  };

  return {
    messages,
    loadingMessages,
    messagesError,
    input,
    setInput,
    generation,
    execution,
    canSend,
    canExecute,
    sqlLooksReadOnly,
    sendMessage,
    reloadMessages,
    cancelGeneration,
    startNewConversation,
    runQuery,
    retryGeneration,
    canRetryGeneration: Boolean(lastQuestion),
  };
}
