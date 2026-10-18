import type { ExecutionResult, QueryCell } from '../../api/contract';
import { EmptyState } from './EmptyState';
import { Table2 } from 'lucide-react';

interface ResultTableProps {
  result: ExecutionResult;
}

function renderCell(value: QueryCell): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

/**
 * 真实查询结果表格。列顺序来自后端 columns，行值按同一顺序读取。
 */
export function ResultTable({ result }: ResultTableProps) {
  if (result.rowCount === 0) {
    return (
      <EmptyState
        icon={Table2}
        title="查询成功，返回 0 行"
        description="SQL 已执行，但没有匹配的数据。这不是错误，也不会伪造占位行。"
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="bg-panel-muted">
            <tr>
              {result.columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="whitespace-nowrap border-b border-line px-3 py-2 font-semibold text-ink-muted"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-panel-muted/60">
                {result.columns.map((column) => {
                  const value = row[column];
                  const isNull = value === null || value === undefined;
                  return (
                    <td
                      key={column}
                      className={`whitespace-nowrap px-3 py-2 font-mono ${
                        isNull ? 'italic text-ink-muted' : 'text-ink'
                      }`}
                    >
                      {renderCell(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
        <span>共 {result.rowCount} 行</span>
        {result.truncated ? <span className="font-semibold text-warn">结果已截断：超过服务端最大返回行数</span> : null}
      </div>
    </div>
  );
}
