import { useCallback, useEffect, useState } from 'react';
import {
  fetchCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '../api/auth';
import { ensureCsrfToken } from '../api/http';
import type { User } from '../api/contract';

export type AuthStatus = 'checking' | 'anonymous' | 'authenticated';

/**
 * 服务端 Session 身份：启动时先取 CSRF Token，再通过 /auth/me 恢复会话。
 * 任何接口返回 401 时会清空本地用户，页面回到登录。
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('checking');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await ensureCsrfToken();
        const current = await fetchCurrentUser();
        if (!active) return;
        setUser(current);
        setStatus('authenticated');
      } catch {
        if (!active) return;
        setUser(null);
        setStatus('anonymous');
      }
    })();

    const onUnauthorized = () => {
      setUser(null);
      setStatus('anonymous');
    };
    window.addEventListener('qf:unauthorized', onUnauthorized);
    return () => {
      active = false;
      window.removeEventListener('qf:unauthorized', onUnauthorized);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const current = await loginRequest({ email, password });
    setUser(current);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (email: string, displayName: string, password: string) => {
    await registerRequest({ email, displayName, password });
    const current = await loginRequest({ email, password });
    setUser(current);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  return { user, status, login, register, signOut };
}
