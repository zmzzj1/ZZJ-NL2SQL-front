import { useCallback, useEffect, useState } from 'react';
import { BookMarked, Loader2, RefreshCw, Rocket, Trash2 } from 'lucide-react';
import type { Skill, SkillInput, SkillVersion } from '../api/contract';
import { createSkill, disableSkill, listSkills, listSkillVersions, publishSkill, updateSkill } from '../api/skill';
import { describeError } from '../api/http';
import { EmptyState } from '../components/ui/EmptyState';

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  DISABLED: '已停用',
};

/**
 * Skill Registry：用户可配置的领域任务指引。发布后生成不可变版本，Agent 才能绑定。
 * Skill 是低信任提示词模板，只允许白名单变量，不授予任何执行权限。
 */
export function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Skill | 'new' | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [triggerScenes, setTriggerScenes] = useState('');
  const [guidanceTemplate, setGuidanceTemplate] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  const [versions, setVersions] = useState<SkillVersion[]>([]);
  const [publishing, setPublishing] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setSkills(await listSkills());
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

  const startEdit = (skill: Skill) => {
    setEditing(skill);
    setName(skill.name);
    setSlug(skill.slug);
    setDescription(skill.description);
    setTriggerScenes(skill.content.triggerScenes);
    setGuidanceTemplate(skill.content.guidanceTemplate);
    setTags(skill.content.tags.join(', '));
  };

  const startCreate = () => {
    setEditing('new');
    setName('');
    setSlug('');
    setDescription('');
    setTriggerScenes('');
    setGuidanceTemplate('');
    setTags('');
  };

  const save = async () => {
    if (!name.trim() || !triggerScenes.trim() || !guidanceTemplate.trim()) return;
    setSaving(true);
    try {
      const input: SkillInput = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        triggerScenes: triggerScenes.trim(),
        guidanceTemplate,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
      if (editing !== null && editing !== 'new') {
        await updateSkill(editing.id, editing.draftRevision, input);
      } else {
        await createSkill(input);
      }
      setEditing(null);
      await reload();
    } catch (saveError) {
      setError(describeError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const publish = async (skill: Skill) => {
    setPublishing(true);
    try {
      await publishSkill(skill.id, skill.draftRevision);
      await reload();
      setError(null);
    } catch (publishError) {
      setError(describeError(publishError));
    } finally {
      setPublishing(false);
    }
  };

  const disable = async (id: number) => {
    try {
      await disableSkill(id);
      await reload();
    } catch (disableError) {
      setError(describeError(disableError));
    }
  };

  const loadVersions = async (id: number) => {
    try {
      setVersions(await listSkillVersions(id));
    } catch (versionError) {
      setError(describeError(versionError));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookMarked className="h-4 w-4 text-accent" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink">Skills</h2>
          <span className="text-xs text-ink-muted">
            发布后生成不可变版本，Agent 才能绑定；模板只允许 taskQuestion / schemaSummary 变量。
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-muted px-2 py-1 text-xs"
            onClick={() => void reload()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            刷新
          </button>
          <button type="button" className="btn-primary px-2 py-1 text-xs" onClick={startCreate}>
            新增 Skill
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <section aria-label="Skill 列表" className="card overflow-hidden">
          {loading && skills.length === 0 ? (
            <p className="flex items-center gap-2 p-4 text-xs text-ink-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              正在加载 Skills…
            </p>
          ) : skills.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="还没有 Skill"
                description="创建领域任务指引（如「有效成交额分析」），发布后即可在 Agent Studio 中绑定。"
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {skills.map((skill) => (
                <li key={skill.id}>
                  <div
                    className={`px-4 py-3 transition-colors ${
                      editing !== null && editing !== 'new' && editing.id === skill.id
                        ? 'bg-accent-soft'
                        : 'hover:bg-panel-muted'
                    }`}
                  >
                    <button type="button" className="w-full text-left" onClick={() => startEdit(skill)}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{skill.name}</span>
                        <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-muted">
                          {STATUS_LABEL[skill.status] ?? skill.status}
                        </span>
                      </span>
                      <span className="mt-1 block text-[11px] text-ink-muted">{skill.slug}</span>
                      <span className="mt-1 block truncate text-xs text-ink-muted">{skill.description}</span>
                    </button>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-secondary px-2 py-0.5 text-[11px]"
                        onClick={() => void publish(skill)}
                        disabled={publishing || skill.status === 'DISABLED'}
                      >
                        <Rocket className="h-3 w-3" aria-hidden="true" />
                        发布
                      </button>
                      <button
                        type="button"
                        className="btn-muted px-2 py-0.5 text-[11px]"
                        onClick={() => void loadVersions(skill.id)}
                      >
                        版本历史
                      </button>
                      <button
                        type="button"
                        className="btn-muted px-2 py-0.5 text-[11px] text-danger"
                        onClick={() => void disable(skill.id)}
                        disabled={skill.status === 'DISABLED'}
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                        停用
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Skill 编辑与版本" className="card space-y-3 p-4">
          {editing === null ? (
            <div className="space-y-3">
              <p className="text-xs text-ink-muted">
                点击左侧 Skill 编辑，或右上角新增。指引模板会按任务相关性选择后注入 Agent 上下文，不授予执行权限。
              </p>
              {versions.length > 0 ? (
                <div className="border-t border-line pt-3">
                  <h3 className="text-sm font-semibold text-ink">版本历史</h3>
                  <ul className="mt-2 space-y-1.5">
                    {versions.map((v) => (
                      <li key={v.id} className="rounded-lg border border-line px-2 py-1.5 text-[11px]">
                        <span className="font-semibold text-ink">v{v.versionNo}</span>
                        <span className="ml-2 text-ink-muted">{v.publishedAt}</span>
                        <span className="ml-2 truncate text-ink-muted">{v.contentHash.slice(0, 12)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-ink">{editing === 'new' ? '新增 Skill' : '编辑 Skill'}</h3>
              <div>
                <label htmlFor="skill-name" className="field-label">
                  名称
                </label>
                <input
                  id="skill-name"
                  className="input-field mt-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="skill-slug" className="field-label">
                  slug（英文标识）
                </label>
                <input
                  id="skill-slug"
                  className="input-field mt-1"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="skill-desc" className="field-label">
                  说明
                </label>
                <input
                  id="skill-desc"
                  className="input-field mt-1"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="skill-trigger" className="field-label">
                  触发场景（关键词）
                </label>
                <input
                  id="skill-trigger"
                  className="input-field mt-1"
                  placeholder="例如：有效成交额 有效订单 GMV"
                  value={triggerScenes}
                  onChange={(e) => setTriggerScenes(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="skill-template" className="field-label">
                  指引模板（可用变量：{'{{taskQuestion}}'} {'{{schemaSummary}}'}）
                </label>
                <textarea
                  id="skill-template"
                  className="input-field mt-1 h-28 resize-none"
                  placeholder="统计 {{taskQuestion}}，只保留已支付订单"
                  value={guidanceTemplate}
                  onChange={(e) => setGuidanceTemplate(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="skill-tags" className="field-label">
                  标签（逗号分隔）
                </label>
                <input
                  id="skill-tags"
                  className="input-field mt-1"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                  取消
                </button>
                <button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}>
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
