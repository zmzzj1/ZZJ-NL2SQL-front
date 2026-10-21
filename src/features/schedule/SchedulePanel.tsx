import { useEffect, useState } from 'react';
import { CalendarClock, Pause, Play, RefreshCw, Trash2, Zap } from 'lucide-react';
import type { Schedule, ScheduleOccurrence } from '../../api/contract';
import { listScheduleOccurrences } from '../../api/schedule';
import { describeError } from '../../api/http';
import { useSchedules } from './useSchedules';

interface SchedulePanelProps {
  workflowId: number;
  connectionId: number | null;
}

const TIMEZONES = ['Asia/Shanghai', 'UTC', 'America/New_York', 'Europe/London'];

const CRON_PRESETS: { label: string; cron: string }[] = [
  { label: '每小时', cron: '0 * * * *' },
  { label: '每天 09:00', cron: '0 9 * * *' },
  { label: '每周一 09:00', cron: '0 9 * * 1' },
  { label: '每月 1 号 09:00', cron: '0 9 1 * *' },
];

function formatUtc(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function stateBadge(state: ScheduleOccurrence['state']): string {
  switch (state) {
    case 'SUCCEEDED':
      return 'bg-success/10 text-success';
    case 'WAITING_APPROVAL':
      return 'bg-warn/10 text-warn';
    case 'FAILED':
    case 'CANCELED':
    case 'SKIPPED':
      return 'bg-danger/10 text-danger';
    default:
      return 'bg-panel-muted text-ink-muted';
  }
}

/**
 * 定时计划面板：为指定工作流创建/编辑/启停计划，试算未来触发时刻，查看触发历史与手动触发。
 * SQL 审批不在此处处理——触发后含 SQL 的 Run 会停在 WAITING_APPROVAL，需到运行详情审批。
 */
export function SchedulePanel({ workflowId, connectionId }: SchedulePanelProps) {
  const { schedules, loading, error, reload, create, update, remove, trigger, preview } = useSchedules();

  const [cron, setCron] = useState('0 9 * * 1');
  const [timezone, setTimezone] = useState('Asia/Shanghai');
  const [userInput, setUserInput] = useState('统计各月订单金额');
  const [previewTimes, setPreviewTimes] = useState<string[]>([]);
  const [occurrences, setOccurrences] = useState<Record<number, ScheduleOccurrence[]>>({});
  const [saving, setSaving] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const workflowSchedules = schedules.filter((s) => s.workflowId === workflowId);

  useEffect(() => {
    const timer = setTimeout(() => {
      void preview(cron, timezone, 3)
        .then(setPreviewTimes)
        .catch(() => setPreviewTimes([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [cron, timezone, preview]);

  const loadOccurrences = async (scheduleId: number) => {
    try {
      const list = await listScheduleOccurrences(scheduleId);
      setOccurrences((current) => ({ ...current, [scheduleId]: list }));
    } catch (loadError) {
      setPanelError(describeError(loadError));
    }
  };

  useEffect(() => {
    for (const s of workflowSchedules) {
      void loadOccurrences(s.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowSchedules.length]);

  const save = async () => {
    if (connectionId === null) {
      setPanelError('请先在「数据库连接」页创建数据源，再创建计划。');
      return;
    }
    setSaving(true);
    setPanelError(null);
    try {
      await create({
        workflowId,
        connectionId,
        cron,
        timezone,
        userInput,
        misfirePolicy: 'SKIP',
        overlapPolicy: 'SKIP_WHILE_RUNNING',
      });
      await reload();
    } catch (saveError) {
      setPanelError(describeError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (schedule: Schedule) => {
    const next = schedule.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await update(schedule.id, schedule.revision, { status: next });
      await reload();
    } catch (updateError) {
      setPanelError(describeError(updateError));
    }
  };

  const handleTrigger = async (scheduleId: number) => {
    try {
      await trigger(scheduleId);
      await loadOccurrences(scheduleId);
    } catch (triggerError) {
      setPanelError(describeError(triggerError));
    }
  };

  const handleDelete = async (scheduleId: number) => {
    try {
      await remove(scheduleId);
      await reload();
    } catch (deleteError) {
      setPanelError(describeError(deleteError));
    }
  };

  return (
    <section aria-label="定时计划" className="card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-accent" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-ink">定时计划</h3>
        <span className="text-[11px] text-ink-muted">到点触发 Workflow Run，SQL 节点仍停在待审批。</span>
      </div>

      {(error || panelError) ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {panelError ?? error}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor={`cron-preset-${workflowId}`} className="field-label">
            周期
          </label>
          <select
            id={`cron-preset-${workflowId}`}
            className="input-field mt-1"
            value={cron}
            onChange={(event) => setCron(event.target.value)}
          >
            {CRON_PRESETS.map((preset) => (
              <option key={preset.cron} value={preset.cron}>
                {preset.label}（{preset.cron}）
              </option>
            ))}
          </select>
          <input
            className="input-field mt-1"
            value={cron}
            onChange={(event) => setCron(event.target.value)}
            aria-label="Cron 表达式"
            placeholder="0 9 * * 1"
          />
        </div>
        <div>
          <label htmlFor={`tz-${workflowId}`} className="field-label">
            时区
          </label>
          <select
            id={`tz-${workflowId}`}
            className="input-field mt-1"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <label htmlFor={`input-${workflowId}`} className="field-label mt-2">
            任务问题
          </label>
          <input
            id={`input-${workflowId}`}
            className="input-field mt-1"
            value={userInput}
            onChange={(event) => setUserInput(event.target.value)}
          />
        </div>
      </div>

      {previewTimes.length > 0 ? (
        <p className="text-[11px] text-ink-muted">
          未来触发：{previewTimes.map((t) => formatUtc(t)).join(' ｜ ')}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <button type="button" className="btn-primary px-2 py-1 text-xs" onClick={() => void save()} disabled={saving}>
          {saving ? '保存中…' : '创建计划'}
        </button>
        <button type="button" className="btn-muted px-2 py-1 text-xs" onClick={() => void reload()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          刷新
        </button>
      </div>

      {workflowSchedules.length > 0 ? (
        <ul className="space-y-2">
          {workflowSchedules.map((schedule) => (
            <li key={schedule.id} className="rounded-lg border border-line bg-panel-muted/60 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-ink">{schedule.cron}</span>
                <span className="text-[11px] text-ink-muted">{schedule.timezone}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    schedule.status === 'ACTIVE' ? 'bg-success/10 text-success' : 'bg-panel-muted text-ink-muted'
                  }`}
                >
                  {schedule.status === 'ACTIVE' ? '运行中' : '已暂停'}
                </span>
                <span className="text-[11px] text-ink-muted">下次 {formatUtc(schedule.nextFireAt)}</span>
                <span className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    className="btn-muted px-2 py-1 text-[11px]"
                    onClick={() => void toggle(schedule)}
                    aria-label={schedule.status === 'ACTIVE' ? '暂停' : '恢复'}
                  >
                    {schedule.status === 'ACTIVE' ? (
                      <Pause className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <Play className="h-3 w-3" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn-muted px-2 py-1 text-[11px]"
                    onClick={() => void handleTrigger(schedule.id)}
                    disabled={schedule.status !== 'ACTIVE'}
                    aria-label="立即触发"
                  >
                    <Zap className="h-3 w-3" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="text-ink-muted hover:text-danger"
                    onClick={() => void handleDelete(schedule.id)}
                    aria-label="删除计划"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              </div>

              {occurrences[schedule.id] && occurrences[schedule.id].length > 0 ? (
                <ul className="mt-2 space-y-1 border-t border-line pt-2">
                  {occurrences[schedule.id].slice(0, 5).map((occ) => (
                    <li key={occ.id} className="flex items-center gap-2 text-[11px]">
                      <span className={`rounded-full px-2 py-0.5 ${stateBadge(occ.state)}`}>{occ.state}</span>
                      <span className="text-ink-muted">{formatUtc(occ.fireAt)}</span>
                      {occ.workflowRunId !== null ? (
                        <span className="text-ink-muted">Run #{occ.workflowRunId}</span>
                      ) : null}
                      {occ.errorCode ? <span className="text-danger">{occ.errorCode}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
