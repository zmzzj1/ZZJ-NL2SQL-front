import { useCallback, useEffect, useState } from 'react';
import { BarChart3, FileText, Loader2, RefreshCw } from 'lucide-react';
import type { AnalysisRun, QueryHistoryItem, Report, TypedChart } from '../api/contract';
import { streamCreateAnalysisRun, fetchAnalysisRun } from '../api/analysis';
import { createReport, listReports, fetchReport } from '../api/report';
import { listQueryHistory } from '../api/history';
import { describeError } from '../api/http';
import { EmptyState } from '../components/ui/EmptyState';

/**
 * P6 分析 + 报告：从真实查询历史选一条已执行的 SQL → 重新执行取真实数据 → 分析 → 图表 → HTML 报告。
 * 分析输入只来自服务端重新校验并执行的受限结果，不伪造图表；报告为服务端净化后的安全 HTML。
 */
export function ReportPage() {
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<QueryHistoryItem | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisRun | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [preview, setPreview] = useState<Report | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [historyPage, reportList] = await Promise.all([listQueryHistory({ limit: 20 }), listReports()]);
      setHistory(historyPage.items.filter((item) => item.status === 'SUCCESS'));
      setReports(reportList);
      setError(null);
    } catch (loadError) {
      setError(describeError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runAnalysis = async (item: QueryHistoryItem) => {
    setSelected(item);
    setAnalysis(null);
    setAnalyzing(true);
    setError(null);
    const controller = new AbortController();
    try {
      await streamCreateAnalysisRun(
        { queryHistoryId: item.id },
        (event, data) => {
          if (event === 'analysis.completed') {
            const id = Number(data.runId);
            if (Number.isFinite(id)) {
              void fetchAnalysisRun(id)
                .then(setAnalysis)
                .catch((err) => setError(describeError(err)));
            }
          } else if (event === 'analysis.failed') {
            setError((data.message as string) ?? '分析失败');
          }
        },
        controller.signal,
      );
    } catch (streamError) {
      setError(describeError(streamError));
    } finally {
      setAnalyzing(false);
    }
  };

  const generateReport = async () => {
    if (!analysis) return;
    setError(null);
    try {
      const report = await createReport({ analysisRunId: analysis.id });
      setReports((prev) => [report, ...prev]);
      setPreview(report);
    } catch (reportError) {
      setError(describeError(reportError));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">数据分析与报告</h2>
          <span className="text-xs text-ink-muted">基于真实查询结果生成图表与 HTML 报告；不伪造统计值。</span>
        </div>
        <button type="button" className="btn-muted px-2 py-1 text-xs" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          刷新
        </button>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-label="查询历史" className="card overflow-hidden">
          {loading ? (
            <p className="flex items-center gap-2 p-4 text-xs text-ink-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              正在加载查询历史…
            </p>
          ) : history.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="还没有成功的查询"
                description="先在「工作台」对真实数据源执行一条只读 SQL，这里才能基于真实结果做分析。"
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {history.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      selected?.id === item.id ? 'bg-accent-soft' : 'hover:bg-panel-muted'
                    }`}
                    onClick={() => void runAnalysis(item)}
                    disabled={analyzing}
                  >
                    <span className="block truncate font-mono text-xs text-ink">{item.sql}</span>
                    <span className="mt-1 block text-[11px] text-ink-muted">
                      {item.connectionName} · {item.rowCount ?? 0} 行 · {item.executedAt}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="分析结果" className="card space-y-3 p-4">
          {analyzing ? (
            <p className="flex items-center gap-2 text-xs text-ink-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              正在分析…
            </p>
          ) : analysis ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">
                  分析 # {analysis.id}（引擎 {analysis.engine}）
                </h3>
                <button type="button" className="btn-primary px-2 py-1 text-xs" onClick={() => void generateReport()}>
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  生成报告
                </button>
              </div>
              {analysis.summary ? <p className="text-xs text-ink-muted">{analysis.summary}</p> : null}
              {analysis.charts.map((chart, index) => (
                <ChartView key={index} chart={chart} />
              ))}
            </>
          ) : (
            <div>
              <p className="text-xs text-ink-muted">
                点击左侧一条成功查询，后端会重新校验权限并执行，用真实结果生成图表。
              </p>
            </div>
          )}
        </section>
      </div>

      <section aria-label="报告列表" className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <FileText className="h-4 w-4 text-accent" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-ink">报告</h3>
        </div>
        {reports.length === 0 ? (
          <p className="p-4 text-xs text-ink-muted">还没有生成报告。</p>
        ) : (
          <ul className="divide-y divide-line">
            {reports.map((report) => (
              <li key={report.id}>
                <button
                  type="button"
                  className="w-full px-4 py-3 text-left hover:bg-panel-muted"
                  onClick={() =>
                    void fetchReport(report.id)
                      .then(setPreview)
                      .catch((err) => setError(describeError(err)))
                  }
                >
                  <span className="block text-sm font-semibold text-ink">{report.title}</span>
                  <span className="text-[11px] text-ink-muted">
                    # {report.id} · {report.sizeBytes} 字节 · {report.createdAt}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {preview ? (
        <section aria-label="报告预览" className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <FileText className="h-4 w-4 text-accent" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-ink">报告预览：{preview.title}</h3>
          </div>
          <iframe
            title={preview.title}
            sandbox="allow-same-origin"
            srcDoc={preview.htmlContent}
            className="h-96 w-full border-0 bg-white"
          />
        </section>
      ) : null}
    </div>
  );
}

function ChartView({ chart }: { chart: TypedChart }) {
  if (chart.chartType === 'table' && chart.columns && chart.data) {
    return (
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-xs">
          <thead className="bg-panel-muted">
            <tr>
              {chart.columns.map((column) => (
                <th key={column.name} className="px-2 py-1.5 text-left font-semibold text-ink">
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.data.map((row, index) => (
              <tr key={index} className="border-t border-line">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-2 py-1.5 text-ink-muted">
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const categories = chart.categories ?? chart.labels ?? [];
  const values = chart.values ?? [];
  const max = Math.max(1, ...values.map((value) => Number(value)));
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-ink">{chart.title}</p>
      {categories.map((category, index) => (
        <div key={index} className="mb-1 flex items-center gap-2">
          <span className="w-24 truncate text-[11px] text-ink-muted">{category}</span>
          <div className="h-3 flex-1 rounded bg-panel-muted">
            <div
              className="h-3 rounded bg-accent"
              style={{ width: `${Math.max(2, (Number(values[index] ?? 0) / max) * 100)}%` }}
            />
          </div>
          <span className="w-16 text-right text-[11px] text-ink">{String(values[index] ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}
