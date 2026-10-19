import type { ModelProfile, ModelProvider, RoutePolicyVersion } from './contract';
import { requestJson } from './http';

// ---- Providers ----

export async function listProviders(): Promise<ModelProvider[]> {
  return requestJson<ModelProvider[]>('/v1/model/providers');
}

export async function createProvider(input: {
  name: string;
  protocol: string;
  baseUrl: string;
  apiKey: string;
}): Promise<ModelProvider> {
  return requestJson<ModelProvider>('/v1/model/providers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateProvider(
  id: number,
  input: { name?: string; baseUrl?: string; enabled: boolean },
): Promise<ModelProvider> {
  return requestJson<ModelProvider>(`/v1/model/providers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function rotateProviderKey(id: number, apiKey: string): Promise<ModelProvider> {
  return requestJson<ModelProvider>(`/v1/model/providers/${id}/rotate-key`, {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
}

export async function testProvider(id: number): Promise<{ ok: boolean; httpStatus: number | null; latencyMs: number }> {
  return requestJson(`/v1/model/providers/${id}/test`, { method: 'POST' });
}

// ---- Profiles ----

export async function listProfiles(): Promise<ModelProfile[]> {
  return requestJson<ModelProfile[]>('/v1/model/profiles');
}

export async function createProfile(input: {
  providerId: number;
  modelId: string;
  modelType: string;
  supportsStreaming: boolean;
  supportsToolCalls: boolean;
  supportsJson: boolean;
  contextLimit: number;
  outputLimit: number;
  embeddingDim?: number;
}): Promise<ModelProfile> {
  return requestJson<ModelProfile>('/v1/model/profiles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function grantModel(profileId: number, grantType: string, granteeId: number): Promise<void> {
  await requestJson<void>(`/v1/model/profiles/${profileId}/grants`, {
    method: 'POST',
    body: JSON.stringify({ grantType, granteeId }),
  });
}

export async function revokeModel(profileId: number, grantType: string, granteeId: number): Promise<void> {
  await requestJson<void>(`/v1/model/profiles/${profileId}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ grantType, granteeId }),
  });
}

// ---- Route Policies ----

export async function savePolicy(input: {
  policyId: number;
  strategy: string;
  candidates: number[];
  fallbackChain?: number[];
  weights?: number[];
  affinityTtlSeconds?: number;
}): Promise<RoutePolicyVersion> {
  return requestJson<RoutePolicyVersion>('/v1/model/policies', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function publishPolicy(versionId: number): Promise<RoutePolicyVersion> {
  return requestJson<RoutePolicyVersion>(`/v1/model/policies/${versionId}/publish`, { method: 'POST' });
}

export async function rollbackPolicy(versionId: number): Promise<RoutePolicyVersion> {
  return requestJson<RoutePolicyVersion>(`/v1/model/policies/${versionId}/rollback`, { method: 'POST' });
}

export async function listPolicyVersions(policyId: number): Promise<RoutePolicyVersion[]> {
  return requestJson<RoutePolicyVersion[]>(`/v1/model/policies/${policyId}/versions`);
}

// ---- Admin ----

export interface AdminOverview {
  totalCalls: number;
  failedCalls: number;
  activeModels: number;
}

export interface ModelUsageSummary {
  modelId: string;
  providerName: string;
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  successRate: number;
  totalTokens: number;
  costStatus: string;
  avgLatencyMs: number;
}

export interface FailureSummary {
  errorClass: string;
  count: number;
  lastOccurred: string;
}

export async function adminOverview(): Promise<AdminOverview> {
  return requestJson<AdminOverview>('/v1/admin/overview');
}

export async function adminModelUsage(minutes = 60): Promise<{
  models: ModelUsageSummary[];
  failures: FailureSummary[];
  since: string;
}> {
  return requestJson(`/v1/admin/model-usage?minutes=${minutes}`);
}

export async function upsertQuota(input: {
  scopeType: string;
  scopeId: number;
  requestsLimit?: number;
  concurrentLimit?: number;
  tokenLimit?: number;
  costLimit?: number;
  costCurrency?: string;
}): Promise<void> {
  await requestJson<void>('/v1/admin/quotas', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
