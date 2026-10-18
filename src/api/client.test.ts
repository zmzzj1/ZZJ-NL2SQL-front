import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, executeSql, streamSqlGeneration } from './client';
import type { ExecutionResult } from './contract';

const encoder = new TextEncoder();

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

const FULL_STREAM = [
  'event: start\ndata: {"requestId":"r1"}\n\n',
  'event: delta\ndata: {"text":"SELECT "}\n\n',
  'event: delta\ndata: {"text":"\'月份\'"}\n\n',
  'event: complete\ndata: {"requestId":"r1"}\n\n',
].join('');

describe('streamSqlGeneration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('在 UTF-8 字符中间被网络分块时仍能正确解码与拼接', async () => {
    const bytes = encoder.encode(FULL_STREAM);
    // “月” 的 UTF-8 字节为 E6 9C 88，在第二个字节处切开。
    const monthStart = findSequence(bytes, [0xe6, 0x9c, 0x88]);
    expect(monthStart).toBeGreaterThan(0);

    const fetchMock = vi.fn().mockResolvedValue(sseResponse(FULL_STREAM, monthStart + 1));
    vi.stubGlobal('fetch', fetchMock);

    const events: string[] = [];
    let text = '';
    await streamSqlGeneration(
      { userInput: '统计', schemaContext: 'demo_orders', strategyName: 'default' },
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
  });

  it('非 2xx 响应转换为带契约错误码的 ApiError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'SQL_NOT_ALLOWED', message: '只允许只读查询', requestId: 'r9' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      streamSqlGeneration(
        { userInput: 'x', schemaContext: '', strategyName: 'default' },
        { onDelta: () => {} },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'SQL_NOT_ALLOWED', requestId: 'r9', status: 400 });
  });

  it('缺少 complete 事件的流被视为中断，不当作成功', async () => {
    const partial = 'event: start\ndata: {"requestId":"r1"}\n\nevent: delta\ndata: {"text":"SELECT"}\n\n';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(partial, 5)));

    await expect(
      streamSqlGeneration(
        { userInput: 'x', schemaContext: '', strategyName: 'default' },
        { onDelta: () => {} },
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('代理返回空 5xx 时按连接失败处理', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 500, statusText: 'Internal Server Error' })),
    );

    await expect(
      streamSqlGeneration(
        { userInput: 'x', schemaContext: '', strategyName: 'default' },
        { onDelta: () => {} },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 500 });
  });

  it('网络失败映射为 NETWORK_ERROR，而不是伪造空 SQL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(
      streamSqlGeneration(
        { userInput: 'x', schemaContext: '', strategyName: 'default' },
        { onDelta: () => {} },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});

describe('executeSql', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('返回契约中的 columns/rows/rowCount/truncated', async () => {
    const result: ExecutionResult = {
      columns: ['total'],
      rows: [{ total: 3 }],
      rowCount: 1,
      truncated: false,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(executeSql('SELECT COUNT(*) AS total FROM demo_orders')).resolves.toEqual(result);
  });

  it('执行失败时保留后端错误码与追踪 ID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'SQL_EXECUTION_ERROR',
            message: 'SQL 执行失败',
            requestId: 'r10',
          }),
          {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    await expect(executeSql('SELECT * FROM nope')).rejects.toMatchObject({
      code: 'SQL_EXECUTION_ERROR',
      requestId: 'r10',
      status: 422,
    });
  });
});
