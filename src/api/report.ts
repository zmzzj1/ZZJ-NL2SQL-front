import type { CreateReportRequest, Report } from './contract';
import { requestJson } from './http';

export async function createReport(body: CreateReportRequest): Promise<Report> {
  return requestJson<Report>('/v1/reports', { method: 'POST', body: JSON.stringify(body) });
}

export async function fetchReport(id: number): Promise<Report> {
  return requestJson<Report>(`/v1/reports/${id}`);
}

export async function listReports(): Promise<Report[]> {
  return requestJson<Report[]>('/v1/reports');
}

export async function deleteReport(id: number): Promise<void> {
  await requestJson<void>(`/v1/reports/${id}`, { method: 'DELETE' });
}
