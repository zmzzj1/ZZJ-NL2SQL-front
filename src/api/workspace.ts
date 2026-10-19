import type { ResourceGrant, ResourceType, GrantScope, Workspace, WorkspaceMember, WorkspaceRole } from './contract';
import { requestJson } from './http';

export async function listWorkspaces(): Promise<Workspace[]> {
  return requestJson<Workspace[]>('/v1/workspaces');
}

export async function createWorkspace(name: string, description?: string): Promise<Workspace> {
  return requestJson<Workspace>('/v1/workspaces', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function getWorkspace(id: number): Promise<Workspace> {
  return requestJson<Workspace>(`/v1/workspaces/${id}`);
}

export async function updateWorkspace(id: number, name: string, description?: string): Promise<Workspace> {
  return requestJson<Workspace>(`/v1/workspaces/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, description }),
  });
}

export async function listMembers(workspaceId: number): Promise<WorkspaceMember[]> {
  return requestJson<WorkspaceMember[]>(`/v1/workspaces/${workspaceId}/members`);
}

export async function addMember(workspaceId: number, userId: number, role: WorkspaceRole): Promise<WorkspaceMember> {
  return requestJson<WorkspaceMember>(`/v1/workspaces/${workspaceId}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId, role }),
  });
}

export async function removeMember(workspaceId: number, userId: number): Promise<void> {
  await requestJson<void>(`/v1/workspaces/${workspaceId}/members/${userId}`, { method: 'DELETE' });
}

export async function listGrants(workspaceId: number, resourceType?: ResourceType): Promise<ResourceGrant[]> {
  const query = resourceType ? `?resourceType=${resourceType}` : '';
  return requestJson<ResourceGrant[]>(`/v1/workspaces/${workspaceId}/resources${query}`);
}

export async function grantResource(
  workspaceId: number,
  resourceType: ResourceType,
  resourceId: number,
  scope: GrantScope,
): Promise<ResourceGrant> {
  return requestJson<ResourceGrant>(`/v1/workspaces/${workspaceId}/resources`, {
    method: 'POST',
    body: JSON.stringify({ resourceType, resourceId, scope }),
  });
}

export async function revokeResource(
  workspaceId: number,
  resourceType: ResourceType,
  resourceId: number,
): Promise<void> {
  await requestJson<void>(`/v1/workspaces/${workspaceId}/resources/${resourceType}/${resourceId}`, {
    method: 'DELETE',
  });
}
