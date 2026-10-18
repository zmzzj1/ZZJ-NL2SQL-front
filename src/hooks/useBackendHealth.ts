import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchHealth } from '../api/client';

export type BackendStatus = 'checking' | 'online' | 'offline';

interface BackendHealth {
  status: BackendStatus;
  checkedAt: Date | null;
  recheck: () => void;
}

const PROBE_TIMEOUT_MS = 5000;

/**
 * 周期性探测 /api/health。后端停止后状态变为 offline，
 * 重启后下一次探测自动恢复。超时也按离线处理，避免永久停留在「检测中」。
 */
export function useBackendHealth(intervalMs = 10000): BackendHealth {
  const [status, setStatus] = useState<BackendStatus>('checking');
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const check = useCallback(async () => {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;

    const timeoutId = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      await fetchHealth(controller.signal);
      if (!controller.signal.aborted) {
        setStatus('online');
        setCheckedAt(new Date());
      }
    } catch {
      // 仅当前探测仍有效时才更新状态：卸载或已被新探测替代时忽略。
      if (controllerRef.current === controller) {
        setStatus('offline');
        setCheckedAt(new Date());
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  useEffect(() => {
    void check();
    const timer = window.setInterval(() => void check(), intervalMs);
    return () => {
      window.clearInterval(timer);
      const active = controllerRef.current;
      controllerRef.current = null;
      active?.abort();
    };
  }, [check, intervalMs]);

  const recheck = useCallback(() => {
    setStatus('checking');
    void check();
  }, [check]);

  return { status, checkedAt, recheck };
}
