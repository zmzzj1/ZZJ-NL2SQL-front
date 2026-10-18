import type { Connection, ConnectionInput, ConnectionTestResult, SchemaResponse } from './contract';
import { requestJson } from './http';

export async function listConnections(): Promise<Connection[]> {
  return requestJson<Connection[]>('/v1/connections');
}

export async function createConnection(input: ConnectionInput): Promise<Connection> {
  return requestJson<Connection>('/v1/connections', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateConnection(id: number, input: ConnectionInput): Promise<Connection> {
  return requestJson<Connection>(`/v1/connections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteConnection(id: number): Promise<void> {
  await requestJson<void>(`/v1/connections/${id}`, { method: 'DELETE' });
}

export async function testConnection(id: number): Promise<ConnectionTestResult> {
  return requestJson<ConnectionTestResult>(`/v1/connections/${id}/test`, { method: 'POST' });
}

export async function fetchConnectionSchema(id: number): Promise<SchemaResponse> {
  return requestJson<SchemaResponse>(`/v1/connections/${id}/schema`);
}
