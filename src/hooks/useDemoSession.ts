import { useCallback, useState } from 'react';
import type { DemoSession } from '../types';

const STORAGE_KEY = 'queryforge.demo-session';

/**
 * 演示会话：只记录邮箱（用于顶部展示），从不记录密码。
 * 它没有任何鉴权含义，退出时清理本地标记。
 */
function readStoredSession(): DemoSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DemoSession>;
    if (typeof parsed.email !== 'string' || parsed.email.length === 0) return null;
    return {
      email: parsed.email,
      signedInAt: typeof parsed.signedInAt === 'string' ? parsed.signedInAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function useDemoSession() {
  const [session, setSession] = useState<DemoSession | null>(readStoredSession);

  const signIn = useCallback((email: string) => {
    const next: DemoSession = { email, signedInAt: new Date().toISOString() };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 忽略存储失败：会话仍在当前页面生效。
    }
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 同上。
    }
    setSession(null);
  }, []);

  return { session, signIn, signOut };
}
