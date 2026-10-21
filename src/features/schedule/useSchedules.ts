import { useCallback, useEffect, useState } from 'react';
import type { CreateScheduleRequest, Schedule } from '../../api/contract';
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  previewSchedule,
  triggerSchedule,
  updateSchedule,
} from '../../api/schedule';

/**
 * 定时计划列表与操作的加载封装。错误抛给调用方展示，列表保留最近成功结果。
 */
export function useSchedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSchedules(await listSchedules());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载计划失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(async (input: CreateScheduleRequest) => {
    const created = await createSchedule(input);
    setSchedules((current) => [...current, created]);
    return created;
  }, []);

  const update = useCallback(async (id: number, revision: number, input: Parameters<typeof updateSchedule>[2]) => {
    const updated = await updateSchedule(id, revision, input);
    setSchedules((current) => current.map((item) => (item.id === id ? updated : item)));
    return updated;
  }, []);

  const remove = useCallback(async (id: number) => {
    await deleteSchedule(id);
    setSchedules((current) => current.filter((item) => item.id !== id));
  }, []);

  const trigger = useCallback((id: number) => triggerSchedule(id), []);

  const preview = useCallback(
    (cron: string, timezone: string, count: number) => previewSchedule(cron, timezone, count),
    [],
  );

  return { schedules, loading, error, reload, create, update, remove, trigger, preview };
}
