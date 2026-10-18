import { afterEach, describe, expect, it, vi } from 'vitest';

/** 每个用例重新导入模块，避免模块级 CSRF Token 缓存串场。 */
async function loadHttp() {
  vi.resetModules();
  return import('./http');
}

const CSRF_OK = () =>
  new Response(JSON.stringify({ token: 'token', headerName: 'X-XSRF-TOKEN' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('requestJson 请求基础设施', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('403 时刷新 CSRF 并只重试一次', async () => {
    const http = await loadHttp();
    let csrfCalls = 0;
    let apiCalls = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input).includes('/auth/csrf')) {
          csrfCalls += 1;
          return Promise.resolve(CSRF_OK());
        }
        apiCalls += 1;
        if (apiCalls === 1) return Promise.resolve(new Response('', { status: 403 }));
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }),
    );

    await expect(http.requestJson('/v1/probe', { method: 'POST', body: '{}' })).resolves.toEqual([]);
    expect(apiCalls).toBe(2);
    expect(csrfCalls).toBe(2);
  });

  it('401 广播会话失效并抛出 UNAUTHENTICATED', async () => {
    const http = await loadHttp();
    const onUnauthorized = vi.fn();
    window.addEventListener('qf:unauthorized', onUnauthorized);

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) =>
        String(input).includes('/auth/csrf')
          ? Promise.resolve(CSRF_OK())
          : Promise.resolve(
              new Response(JSON.stringify({ code: 'UNAUTHENTICATED', message: '请先登录', requestId: 'r1' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
              }),
            ),
      ),
    );

    await expect(http.requestJson('/v1/probe')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      status: 401,
      requestId: 'r1',
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
