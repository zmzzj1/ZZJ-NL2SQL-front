import type { ExecutionResult, QueryCell } from '../../api/contract';

/** 单元格转字符串。 */
function cellText(value: QueryCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/**
 * CSV 单元格转义：先做公式注入防护（= + - @ TAB CR 前缀加单引号），
 * 再按 RFC 4180 处理逗号/引号/换行。与后端 CsvExportService.escape 保持一致。
 */
export function escapeCsvCell(value: QueryCell): string {
  let body = cellText(value);
  if (
    body.length > 0 &&
    (body[0] === '=' || body[0] === '+' || body[0] === '-' || body[0] === '@' || body[0] === '\t' || body[0] === '\r')
  ) {
    body = `'${body}`;
  }
  if (/[",\r\n]/.test(body)) {
    body = `"${body.replace(/"/g, '""')}"`;
  }
  return body;
}

/** 把查询结果序列化为带 UTF-8 BOM 的 CSV 文本。 */
export function toCsv(result: ExecutionResult): string {
  const lines: string[] = [];
  lines.push(result.columns.map((column) => escapeCsvCell(column)).join(','));
  for (const row of result.rows) {
    lines.push(result.columns.map((column) => escapeCsvCell(row[column])).join(','));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** 触发浏览器下载一个文本文件。 */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
