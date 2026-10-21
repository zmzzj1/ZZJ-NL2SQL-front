import type {
  CreateScheduleRequest,
  Schedule,
  ScheduleOccurrence,
  UpdateScheduleRequest,
} from './contract';
import { requestJson } from './http';

export async function listSchedules(): Promise<Schedule[]> {
  return requestJson<Schedule[]>('/v1/schedules');
}

export async function createSchedule(body: CreateScheduleRequest): Promise<Schedule> {
  return requestJson<Schedule>('/v1/schedules', { method: 'POST', body: JSON.stringify(body) });
}

export async function fetchSchedule(id: number): Promise<Schedule> {
  return requestJson<Schedule>(`/v1/schedules/${id}`);
}

export async function updateSchedule(
  id: number,
  revision: number,
  body: UpdateScheduleRequest,
): Promise<Schedule> {
  return requestJson<Schedule>(`/v1/schedules/${id}?revision=${revision}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteSchedule(id: number): Promise<void> {
  await requestJson<void>(`/v1/schedules/${id}`, { method: 'DELETE' });
}

export async function previewSchedule(
  cron: string,
  timezone: string,
  count: number,
): Promise<string[]> {
  return requestJson<string[]>('/v1/schedules/preview', {
    method: 'POST',
    body: JSON.stringify({ cron, timezone, count }),
  });
}

export async function triggerSchedule(id: number): Promise<ScheduleOccurrence> {
  return requestJson<ScheduleOccurrence>(`/v1/schedules/${id}/trigger`, { method: 'POST' });
}

export async function listScheduleOccurrences(id: number): Promise<ScheduleOccurrence[]> {
  return requestJson<ScheduleOccurrence[]>(`/v1/schedules/${id}/runs`);
}
