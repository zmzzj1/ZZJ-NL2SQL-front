import { describe, expect, it } from 'vitest';
import { createSseParser } from './sse';

describe('createSseParser', () => {
  it('把跨 chunk 的事件帧重新组装', () => {
    const parser = createSseParser();
    expect(parser.push('event: delta\ndata: {"text":"你')).toEqual([]);
    const frames = parser.push('好"}\n\n');
    expect(frames).toEqual([{ event: 'delta', data: '{"text":"你好"}' }]);
  });

  it('一个 chunk 内处理多个事件与 CRLF', () => {
    const parser = createSseParser();
    const frames = parser.push(
      'event: start\r\ndata: {"requestId":"r1"}\r\n\r\nevent: delta\r\ndata: {"text":"SELECT "}\r\n\r\n',
    );
    expect(frames).toEqual([
      { event: 'start', data: '{"requestId":"r1"}' },
      { event: 'delta', data: '{"text":"SELECT "}' },
    ]);
  });

  it('多行 data 按规范用换行拼接，注释行被忽略', () => {
    const parser = createSseParser();
    const frames = parser.push(': keep-alive\nevent: delta\ndata: line1\ndata: line2\n\n');
    expect(frames).toEqual([{ event: 'delta', data: 'line1\nline2' }]);
  });

  it('flush 处理末尾缺少空行的帧', () => {
    const parser = createSseParser();
    expect(parser.push('event: complete\ndata: {"requestId":"r2"}')).toEqual([]);
    expect(parser.flush()).toEqual([{ event: 'complete', data: '{"requestId":"r2"}' }]);
  });

  it('不把不完整的分隔符当作事件边界', () => {
    const parser = createSseParser();
    expect(parser.push('event: delta\ndata: {"text":"a"}\n')).toEqual([]);
    expect(parser.push('\n')).toEqual([{ event: 'delta', data: '{"text":"a"}' }]);
  });
});
