import {useEffect, useState} from 'react';
import {getApiHealth} from '../services/api';

type ApiStatusState = 'checking' | 'ready' | 'degraded' | 'offline';

export function ApiStatus() {
  const [status, setStatus] = useState<ApiStatusState>('checking');

  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;

    const check = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const result = await getApiHealth(controller.signal);
        if (active) setStatus(result.httpOk && result.status === 'ok' ? 'ready' : 'degraded');
      } catch {
        if (active) setStatus('offline');
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), 30_000);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, []);

  const label = {
    checking: 'Connecting to service',
    ready: 'Services online',
    degraded: 'Service needs attention',
    offline: 'API unavailable',
  }[status];
  const color = {
    checking: 'bg-amber-400',
    ready: 'bg-emerald-500',
    degraded: 'bg-amber-500',
    offline: 'bg-slate-400',
  }[status];

  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#64748B]" role="status" aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
