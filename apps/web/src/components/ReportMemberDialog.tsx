import {useState, type FormEvent} from 'react';
import {Flag, X} from 'lucide-react';
import {reportMember} from '../services/safety';

const REASONS = [
  {id: 'HARASSMENT', label: 'Harassment or unsafe behavior'},
  {id: 'SCAM', label: 'Scam or suspicious activity'},
  {id: 'INAPPROPRIATE', label: 'Inappropriate content'},
  {id: 'FAKE_PROFILE', label: 'Fake or misleading profile'},
  {id: 'OTHER', label: 'Something else'},
] as const;

export function ReportMemberDialog({userId, displayName, onClose}: {userId: string; displayName: string; onClose: () => void}) {
  const [reason, setReason] = useState<(typeof REASONS)[number]['id']>('OTHER');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {await reportMember(userId, {reason, details}); setSubmitted(true);}
    catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not send the report.');}
    finally {setBusy(false);}
  };
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4" role="presentation" onMouseDown={(event) => {if (event.target === event.currentTarget) onClose();}}>
    <section role="dialog" aria-modal="true" aria-labelledby="report-member-title" className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-kinship-3 sm:p-6">
      <header className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><Flag className="h-5 w-5 text-[#F05A4A]"/><div><h2 id="report-member-title" className="font-extrabold">Report {displayName}</h2><p className="mt-0.5 text-xs text-[#64748B]">Reports are private and reviewed by the safety team.</p></div></div><button aria-label="Close report form" onClick={onClose} className="rounded-full p-1 text-[#64748B] hover:bg-[#F4F2EE]"><X className="h-4 w-4"/></button></header>
      {submitted ? <div role="status" className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"><p className="font-bold">Report received</p><p>Thank you for helping keep the community safe. You can review its status in Profile &amp; Quiz.</p><button onClick={onClose} className="mt-3 rounded-full bg-emerald-800 px-4 py-2 text-xs font-bold text-white">Done</button></div> : <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-3"><label className="block text-xs font-bold text-[#334155]">What happened?<select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)} className="mt-1.5 h-11 w-full rounded-xl bg-[#F4F2EE] px-3 text-sm"><option value="HARASSMENT">Harassment or unsafe behavior</option><option value="SCAM">Scam or suspicious activity</option><option value="INAPPROPRIATE">Inappropriate content</option><option value="FAKE_PROFILE">Fake or misleading profile</option><option value="OTHER">Something else</option></select></label><label className="block text-xs font-bold text-[#334155]">Details (optional)<textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} rows={4} placeholder="Share context that can help our moderators review this." className="mt-1.5 w-full resize-y rounded-xl bg-[#F4F2EE] p-3 text-sm outline-none focus:ring-2 focus:ring-[#F05A4A]/40"/></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button disabled={busy} className="w-full rounded-full bg-[#F05A4A] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Sending…' : 'Submit private report'}</button></form>}
    </section>
  </div>;
}
