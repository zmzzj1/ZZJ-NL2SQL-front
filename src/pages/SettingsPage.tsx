import { useState } from 'react';
import { Moon, RotateCcw, RotateCw, Sun } from 'lucide-react';
import { DEFAULT_PREFERENCES, FONT_SIZE_RANGE } from '../hooks/useUiPreferences';
import { demoSqlExamples } from '../mocks/sqlExamples';
import type { ThemePreference, UiPreferences } from '../types';
import { DemoBadge } from '../components/ui/DemoBadge';
import { SqlBlock } from '../components/ui/SqlBlock';

interface SettingsPageProps {
  preferences: UiPreferences;
  onThemeChange: (theme: ThemePreference) => void;
  onFontSizeChange: (size: number) => void;
  onReset: () => void;
}

/**
 * Settings 只开放真正生效的两项偏好（主题、SQL 字号），
 * 其余能力明确标注为后续阶段，不做摆设控件。
 */
export function SettingsPage({ preferences, onThemeChange, onFontSizeChange, onReset }: SettingsPageProps) {
  const [resetNotice, setResetNotice] = useState(false);
  const previewExample = demoSqlExamples[0];

  const handleReset = () => {
    onReset();
    setResetNotice(true);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-ink">外观主题</h2>
        <p className="mt-1 text-xs text-ink-muted">切换后立即生效，并保存在浏览器本地。</p>

        <fieldset className="mt-4">
          <legend className="sr-only">选择主题</legend>
          <div className="flex flex-wrap gap-3">
            {(
              [
                { value: 'light', label: '浅色', icon: Sun },
                { value: 'dark', label: '深色', icon: Moon },
              ] as const
            ).map((option) => {
              const Icon = option.icon;
              const active = preferences.theme === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                    active
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line bg-panel-muted text-ink-muted hover:bg-panel'
                  }`}
                >
                  <input
                    type="radio"
                    name="theme"
                    className="sr-only"
                    value={option.value}
                    checked={active}
                    onChange={() => onThemeChange(option.value)}
                  />
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-ink">SQL 字号</h2>
        <p className="mt-1 text-xs text-ink-muted">
          影响 Dashboard 与历史记录中的 SQL 展示区，范围 {FONT_SIZE_RANGE.min}–{FONT_SIZE_RANGE.max}
          px。
        </p>

        <div className="mt-4 flex items-center gap-4">
          <label className="sr-only" htmlFor="editor-font-size">
            SQL 展示字号
          </label>
          <input
            id="editor-font-size"
            type="range"
            min={FONT_SIZE_RANGE.min}
            max={FONT_SIZE_RANGE.max}
            step={1}
            value={preferences.editorFontSize}
            onChange={(event) => onFontSizeChange(Number(event.target.value))}
            className="w-full max-w-sm accent-accent"
          />
          <output htmlFor="editor-font-size" className="font-mono text-sm text-ink">
            {preferences.editorFontSize}px
          </output>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <p className="field-label mb-0">实时预览</p>
            <DemoBadge variant="neutral">固定示例</DemoBadge>
          </div>
          <SqlBlock sql={previewExample.sql} fontSize={preferences.editorFontSize} title="preview.sql" />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold text-ink">恢复默认</h2>
        <p className="mt-1 text-xs text-ink-muted">回到浅色主题与 {DEFAULT_PREFERENCES.editorFontSize}px 字号。</p>
        <button type="button" className="btn-secondary mt-3" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          恢复默认设置
        </button>
        <p role="status" aria-live="polite" className="mt-2 text-[11px] text-ink-muted">
          {resetNotice ? '已恢复默认设置，界面已同步更新。' : ''}
        </p>
      </section>

      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <RotateCw className="h-4 w-4 text-ink-muted" aria-hidden="true" />
          关于本阶段设置
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-ink-muted">
          <li>偏好仅保存在本机浏览器的 localStorage，不会上传。</li>
          <li>数据源凭据、LLM 供应商、API Key、安全审计等设置不在本阶段范围。</li>
          <li>它们会在后端与联调阶段逐步开放。</li>
        </ul>
      </section>
    </div>
  );
}
