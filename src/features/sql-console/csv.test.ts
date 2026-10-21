import { describe, expect, it } from 'vitest';
import { escapeCsvCell, toCsv } from './csv';
import type { ExecutionResult } from '../../api/contract';

describe('CSV 序列化与公式注入防护', () => {
  it('= + - @ 前缀单元格加单引号转义', () => {
    expect(escapeCsvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(escapeCsvCell('+cmd|calc')).toBe("'+cmd|calc");
    expect(escapeCsvCell('-2+3')).toBe("'-2+3");
    expect(escapeCsvCell('@import')).toBe("'@import");
    expect(escapeCsvCell('\t tab')).toBe("'\t tab");
  });

  it('普通文本不加转义', () => {
    expect(escapeCsvCell('hello')).toBe('hello');
    expect(escapeCsvCell('123')).toBe('123');
    expect(escapeCsvCell('')).toBe('');
    expect(escapeCsvCell(null)).toBe('');
  });

  it('含逗号/引号/换行按 RFC 4180 加引号', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('布尔值与数值正确序列化', () => {
    expect(escapeCsvCell(true)).toBe('true');
    expect(escapeCsvCell(false)).toBe('false');
    expect(escapeCsvCell(42)).toBe('42');
  });

  it('toCsv 生成带 BOM 的完整 CSV，并对公式单元格做防护', () => {
    const result: ExecutionResult = {
      columns: ['id', 'name'],
      rows: [
        { id: 1, name: '=1+1' },
        { id: 2, name: 'normal' },
      ],
      rowCount: 2,
      truncated: false,
    };
    const csv = toCsv(result);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('id,name');
    expect(csv).toContain("1,'=1+1");
    expect(csv).toContain('2,normal');
  });

  it('空结果仍输出表头', () => {
    const result: ExecutionResult = { columns: ['a'], rows: [], rowCount: 0, truncated: false };
    const csv = toCsv(result);
    expect(csv).toContain('a');
    // BOM + 表头，且以 \r\n 结尾
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});
