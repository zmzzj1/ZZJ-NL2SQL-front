import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './http';
import { executeSql, streamSqlGeneration } from './sql';
import type { ExecutionResult } from './contract';

const encoder = new TextEncoder();

const CSRF_BODY = JSON.stringify({ token: 'test-csrf-token', headerName: 'X-XSRF-TOKEN' });

function findSequence(bytes: Uint8Array, pattern: number[]): number {
  outer: for (let i = 0; i <= bytes.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) {
      if (bytes[i + j] !== pattern[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function sseResponse(payload: string, splitAt: number): Response {
  const bytes = encoder.encode(payload);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes.slice(0, splitAt));
      controller.enqueue(bytes.slice(splitAt));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream;charset=UTF-8' },
  });
}

/** 统一拦截 CSRF 请求；其余请求交给各用例的响应工厂。 */
function stubFetch(responseFactory: (input: RequestInfo | URL) => Response | Promise<Response>) {
  const mock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    void _init;
    if (String(input).includes('/auth/csrf')) {
      return Promise.resolve(new Response(CSRF_BODY, { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return Promise.resolve(responseFactory(input));
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

const FULL_STREAM = [
  'event: start\ndata: {"requestId":"r1"}\n\n',
  'event: delta\ndata: {"text":"SELECT "}\n\n',
  'event: delta\ndata: {"text":"\'月份\'"}\n\n',
  'event: complete\ndata: {"requestId":"r1"}\n\n',
].join('');

const REQUEST = { userInput: '统计', connectionId: 1, strategyName: 'default' as const };

describe('streamSqlGeneration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('发送 connectionId，并在 UTF-8 字符中间分块时正确解码', async () => {
    const bytes = encoder.encode(FULL_STREAM);
    const monthStart = findSequence(bytes, [0xe6, 0x9c, 0x88]);
    expect(monthStart).toBeGreaterThan(0);

    const fetchMock = stubFetch(() => sseResponse(FULL_STREAM, monthStart + 1));

    const events: string[] = [];
    let text = '';
    await streamSqlGeneration(
      REQUEST,
      {
        onStart: (id) => events.push(`start:${id}`),
        onDelta: (chunk) => {
          events.push('delta');
          text += chunk;
        },
        onComplete: (id) => events.push(`complete:${id}`),
      },
      new AbortController().signal,
    );

    expect(text).toBe("SELECT '月份'");
    expect(events).toEqual(['start:r1', 'delta', 'delta', 'complete:r1']);

    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/generate/stream'));
    expect(call).toBeDefined();
    const init = call?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual(REQUEST);
    expect((init.headers as Record<string, string>)['X-XSRF-TOKEN']).toBe('test-csrf-token');
  });

  it('非 2xx 响应转换为带契约错误码的 ApiError', async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ code: 'SQL_NOT_ALLOWED', message: '只允许只读查询', requestId: 'r9' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    await expect(
      streamSqlGeneration(REQUEST, { onDelta: () => {} }, new AbortController().signal),
    ).rejects.toMatchObject({ code: 'SQL_NOT_ALLOWED', requestId: 'r9', status: 400 });
  });

  it('缺少 complete 事件的流被视为中断', async () => {
    const partial = 'event: start\ndata: {"requestId":"r1"}\n\nevent: delta\ndata: {"text":"SELECT"}\n\n';
    stubFetch(() => sseResponse(partial, 5));

    await expect(
      streamSqlGeneration(REQUEST, { onDelta: () => {} }, new AbortController().signal),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('代理返回空 5xx 时按连接失败处理', async () => {
    stubFetch(() => new Response('', { status: 500, statusText: 'Internal Server Error' }));

    await expect(
      streamSqlGeneration(REQUEST, { onDelta: () => {} }, new AbortController().signal),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 500 });
  });

  it('网络失败映射为 NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(
      streamSqlGeneration(REQUEST, { onDelta: () => {} }, new AbortController().signal),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});

describe('executeSql', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('携带 connectionId 并返回契约结果', async () => {
    const result: ExecutionResult = {
      columns: ['订单数'],
      rows: [{ 订单数: 3 }],
      rowCount: 1,
      truncated: false,
    };
    const fetchMock = stubFetch(
      () =>
        new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    await expect(executeSql(1, 'SELECT COUNT(*) AS `订单数` FROM shop_orders')).resolves.toEqual(result);

    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/sql/execute'));
    expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({
      connectionId: 1,
      sql: 'SELECT COUNT(*) AS `订单数` FROM shop_orders',
    });
  });

  it('执行失败时保留后端错误码与追踪 ID', async () => {
    stubFetch(
      () =>
        new Response(JSON.stringify({ code: 'SQL_EXECUTION_ERROR', message: 'SQL 执行失败', requestId: 'r10' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    await expect(executeSql(1, 'SELECT * FROM nope')).rejects.toMatchObject({
      code: 'SQL_EXECUTION_ERROR',
      requestId: 'r10',
      status: 422,
    });
  });
});
