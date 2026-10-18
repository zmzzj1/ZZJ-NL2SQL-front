/**
 * 增量 SSE 解析器：以「完整事件帧」为单位输出，
 * 不假设网络 chunk 与事件边界对齐。UTF-8 解码由调用方用流式 TextDecoder 完成。
 */

export interface SseFrame {
  event: string;
  data: string;
}

const FRAME_SEPARATOR = /\r?\n\r?\n/;

export interface SseParser {
  push(chunk: string): SseFrame[];
  /** 流结束时调用，处理末尾缺少空行的最后一帧。 */
  flush(): SseFrame[];
}

export function createSseParser(): SseParser {
  let buffer = '';

  const drain = (): SseFrame[] => {
    const frames: SseFrame[] = [];
    let match = FRAME_SEPARATOR.exec(buffer);
    while (match) {
      const rawFrame = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      const frame = parseFrame(rawFrame);
      if (frame) frames.push(frame);
      match = FRAME_SEPARATOR.exec(buffer);
    }
    return frames;
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      return drain();
    },
    flush() {
      if (!buffer.trim()) {
        buffer = '';
        return [];
      }
      const frame = parseFrame(buffer);
      buffer = '';
      return frame ? [frame] : [];
    },
  };
}

function parseFrame(raw: string): SseFrame | null {
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'event') {
      event = value || 'message';
    } else if (field === 'data') {
      dataLines.push(value);
    }
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}
