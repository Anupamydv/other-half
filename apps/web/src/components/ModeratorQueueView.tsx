import {useEffect, useState} from 'react';
import {Check, Eye, Flag, X} from 'lucide-react';
import type {ModerationReportDto} from '@other-half/contracts';
import {getModerationReports, updateReportStatus} from '../services/safety';

export function ModeratorQueueView() {
  const [items, setItems] = useState<ModerationReportDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void getModerationReports(controller.signal).then((reports) => {if (!controller.signal.aborted) setItems(reports);})
      .catch((cause: unknown) => {if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load the moderation queue.');})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [reloadKey]);
  const update = async (item: ModerationReportDto, status: 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED') => {
    setBusyId(item.id); setError('');
    try {const updated = await updateReportStatus(item.id, status); setItems((current) => current.map((entry) => entry.id === item.id ? updated : entry));}
    catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not update this report.');}
    finally {setBusyId(null);}
  };
  return <section className="rounded-[28px] bg-white p-5 shadow-kinship-1 sm:p-6"><header className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><ShieldIcon/><div><h2 className="font-extrabold">Safety review queue</h2><p className="text-xs text-[#64748B]">Private member reports requiring moderator attention.</p></div></div><button onClick={() => setReloadKey((key) => key + 1)} className="rounded-full bg-[#F4F2EE] px-3 py-2 text-xs font-bold">Refresh</button></header>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{loading ? <p className="mt-4 text-sm text-[#64748B]">Loading reports…</p> : items.length === 0 ? <p className="mt-4 rounded-xl bg-[#FAF9F6] p-5 text-sm text-[#64748B]">No reports need review.</p> : <div className="mt-4 space-y-3">{items.map((item) => <article key={item.id} className="rounded-2xl border border-slate-900/5 bg-[#FAF9F6] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-1.5 text-sm font-extrabold"><Flag className="h-4 w-4 text-[#F05A4A]"/>{item.reason.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-[#64748B]">Reported member: <strong>{item.reportedDisplayName}</strong> · Reported by: <strong>{item.reporterDisplayName}</strong> · {new Date(item.createdAt).toLocaleString('en-IN')}</p></div><span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold">{item.status.replaceAll('_', ' ')}</span></div>{item.details && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white p-3 text-sm leading-5 text-[#475569]">{item.details}</p>}<div className="mt-3 flex flex-wrap gap-2">{item.status === 'OPEN' && <button disabled={busyId === item.id} onClick={() => void update(item, 'IN_REVIEW')} className="inline-flex items-center gap-1 rounded-full bg-[#1E293B] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Eye className="h-3.5 w-3.5"/>Take for review</button>}{item.status !== 'RESOLVED' && <button disabled={busyId === item.id} onClick={() => void update(item, 'RESOLVED')} className="inline-flex items-center gap-1 rounded-full bg-emerald-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Check className="h-3.5 w-3.5"/>Resolve</button>}{item.status !== 'DISMISSED' && <button disabled={busyId === item.id} onClick={() => void update(item, 'DISMISSED')} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-bold text-[#475569] disabled:opacity-50"><X className="h-3.5 w-3.5"/>Dismiss</button>}</div></article>)}</div>}
  </section>;
}

function ShieldIcon() { return <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-emerald-800"><Check className="h-4 w-4"/></div>; }
