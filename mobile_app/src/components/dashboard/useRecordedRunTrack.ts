import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { driverApi, type RecordedRunTrack } from '@/src/lib/api';

export function useRecordedRunTrack(runId: string | undefined, token: string | undefined, enabled: boolean) {
  const [window, setWindow] = useState<{ runId?: string; before?: string }>({});
  const before = window.runId === runId ? window.before : undefined;
  const setBefore = (value: string | undefined) => setWindow({ runId, before: value });
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; value: RecordedRunTrack } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = `${token}:${runId}:${before ?? ''}`;
  useEffect(() => {
    if (!enabled || !runId || !token) return;
    let cancelled = false, pending = false, active = true;
    const refresh = async () => {
      if (pending || AppState.currentState !== 'active') return;
      pending = true;
      try {
        const value = await driverApi.runTrack(token, runId, before);
        if (!cancelled) { active = value.active; setResult({ key, value }); setError(null); }
      } catch { if (!cancelled) setError('Could not refresh recorded GPS.'); }
      finally { pending = false; }
    };
    void refresh();
    const timer = setInterval(() => { if (active && !before) void refresh(); }, 60000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active' && active && !before) void refresh(); });
    return () => { cancelled = true; clearInterval(timer); subscription.remove(); };
  }, [runId, token, enabled, before, key, retry]);
  return { track: result?.key === key ? result.value : null, error, before, setBefore, retry: () => setRetry(v => v + 1) };
}
