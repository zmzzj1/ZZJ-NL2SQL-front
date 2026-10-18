import { useCallback, useEffect, useState } from 'react';
import type { ThemePreference, UiPreferences } from '../types';

const STORAGE_KEY = 'queryforge.ui-preferences';

export const DEFAULT_PREFERENCES: UiPreferences = {
  theme: 'light',
  editorFontSize: 14,
};

export const FONT_SIZE_RANGE = { min: 12, max: 20 } as const;

function readStoredPreferences(): UiPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UiPreferences>;
    return {
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      editorFontSize: clampFontSize(Number(parsed.editorFontSize) || DEFAULT_PREFERENCES.editorFontSize),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function clampFontSize(size: number): number {
  if (Number.isNaN(size)) return DEFAULT_PREFERENCES.editorFontSize;
  return Math.min(FONT_SIZE_RANGE.max, Math.max(FONT_SIZE_RANGE.min, Math.round(size)));
}

/**
 * UI 偏好只写浏览器的 localStorage，不上传、不含凭据。
 * 主题切换通过 <html> 上的 dark class 生效。
 */
export function useUiPreferences() {
  const [preferences, setPreferences] = useState<UiPreferences>(readStoredPreferences);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', preferences.theme === 'dark');
  }, [preferences.theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // 隐私模式下 localStorage 不可用：偏好仅在当前会话生效，不影响功能。
    }
  }, [preferences]);

  const setTheme = useCallback((theme: ThemePreference) => {
    setPreferences((current) => ({ ...current, theme }));
  }, []);

  const setEditorFontSize = useCallback((editorFontSize: number) => {
    setPreferences((current) => ({ ...current, editorFontSize: clampFontSize(editorFontSize) }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  return { preferences, setTheme, setEditorFontSize, resetPreferences };
}
