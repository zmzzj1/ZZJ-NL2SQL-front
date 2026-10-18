import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DEFAULT_PREFERENCES, clampFontSize, useUiPreferences } from './useUiPreferences';

const STORAGE_KEY = 'queryforge.ui-preferences';

/** AC-18 / AC-19 / AC-20 / AC-21：主题实时切换、字号生效、刷新保留、恢复默认。 */
describe('useUiPreferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('AC-18 切换主题立即作用于 <html> 并写入本地存储', () => {
    const { result } = renderHook(() => useUiPreferences());

    expect(document.documentElement.classList.contains('dark')).toBe(false);

    act(() => result.current.setTheme('dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('"theme":"dark"');

    act(() => result.current.setTheme('light'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('AC-19 字号限制在 12–20px 之间', () => {
    const { result } = renderHook(() => useUiPreferences());

    act(() => result.current.setEditorFontSize(18));
    expect(result.current.preferences.editorFontSize).toBe(18);

    act(() => result.current.setEditorFontSize(99));
    expect(result.current.preferences.editorFontSize).toBe(20);

    act(() => result.current.setEditorFontSize(1));
    expect(result.current.preferences.editorFontSize).toBe(12);

    expect(clampFontSize(Number.NaN)).toBe(DEFAULT_PREFERENCES.editorFontSize);
  });

  it('AC-20 已保存的偏好在新的 hook 实例中被读取（模拟刷新）', () => {
    const first = renderHook(() => useUiPreferences());
    act(() => first.result.current.setTheme('dark'));
    act(() => first.result.current.setEditorFontSize(19));
    first.unmount();

    const second = renderHook(() => useUiPreferences());
    expect(second.result.current.preferences.theme).toBe('dark');
    expect(second.result.current.preferences.editorFontSize).toBe(19);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('AC-21 恢复默认设置回到初始值', () => {
    const { result } = renderHook(() => useUiPreferences());
    act(() => result.current.setTheme('dark'));
    act(() => result.current.setEditorFontSize(20));

    act(() => result.current.resetPreferences());

    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('"editorFontSize":14');
  });

  it('损坏的存储内容不会导致崩溃，回退到默认值', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not-json');
    const { result } = renderHook(() => useUiPreferences());
    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
  });
});
