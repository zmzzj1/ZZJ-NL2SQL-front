import type { Skill, SkillInput, SkillVersion } from './contract';
import { requestJson } from './http';

export async function listSkills(status?: string): Promise<Skill[]> {
  const query = status ? `?status=${status}` : '';
  return requestJson<Skill[]>(`/v1/skills${query}`);
}

export async function createSkill(input: SkillInput): Promise<Skill> {
  return requestJson<Skill>('/v1/skills', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getSkill(id: number): Promise<Skill> {
  return requestJson<Skill>(`/v1/skills/${id}`);
}

export async function updateSkill(id: number, expectedRevision: number, input: SkillInput): Promise<Skill> {
  return requestJson<Skill>(`/v1/skills/${id}?expectedRevision=${expectedRevision}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function disableSkill(id: number): Promise<void> {
  await requestJson<void>(`/v1/skills/${id}`, { method: 'DELETE' });
}

export async function listSkillVersions(id: number): Promise<SkillVersion[]> {
  return requestJson<SkillVersion[]>(`/v1/skills/${id}/versions`);
}

export async function publishSkill(id: number, expectedRevision: number): Promise<SkillVersion> {
  return requestJson<SkillVersion>(`/v1/skills/${id}/publish?expectedRevision=${expectedRevision}`, {
    method: 'POST',
  });
}
