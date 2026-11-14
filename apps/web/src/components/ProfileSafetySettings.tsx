import {useEffect, useState} from 'react';
import {Ban, Download, Flag, RefreshCw, ShieldCheck, UserRound, Undo2} from 'lucide-react';
import type {BlockedUserDto, UserReportDto} from '@other-half/contracts';
import {getBlockedMembers, getMyReports, unblockMember} from '../services/safety';
import {downloadAccountData} from '../services/account';

const STATUS: Record<UserReportDto['status'], string> = {OPEN: 'Received', IN_REVIEW: 'In review', RESOLVED: 'Reviewed', DISMISSED: 'Closed'};

export function ProfileSafetySettings() {
  const [blocked, setBlocked] = useState<BlockedUserDto[]>([]);
  const [reports, setReports] = useState<UserReportDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
  const [exportError, setExportError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void Promise.all([getBlockedMembers(controller.signal), getMyReports(controller.signal)]).then(([blocks, ownReports]) => {
      if (!controller.signal.aborted) {setBlocked(blocks); setReports(ownReports);}
    }).catch((cause: unknown) => {if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load safety settings.');})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [reloadKey]);
  const unblock = async (userId: string) => {
    setBusyId(userId); setError('');
    try {await unblockMember(userId); setBlocked((current) => current.filter((item) => item.userId !== userId));}
    catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not unblock this member.');}
    finally {setBusyId(null);}
  };
  const exportData = async () => {
    setExporting(true); setExportError(''); setExportNotice('');
    try {await downloadAccountData(); setExportNotice('Your account export has been downloaded.');}
    catch (cause) {setExportError(cause instanceof Error ? cause.message : 'Could not export account data.');}
    finally {setExporting(false);}
  };
  return <section className="grid gap-4 lg:grid-cols-2">
    <div className="rounded-[28px] bg-white p-5 shadow-kinship-1 sm:p-6"><header className="flex items-center gap-2"><Ban className="h-5 w-5 text-[#F05A4A]"/><div><h2 className="font-extrabold">Blocked members</h2><p className="text-xs text-[#64748B]">They won’t appear in discovery or be able to message you.</p></div></header>
      {loading ? <p className="mt-4 text-sm text-[#64748B]">Loading…</p> : blocked.length === 0 ? <p className="mt-4 rounded-xl bg-[#FAF9F6] p-4 text-sm text-[#64748B]">You haven’t blocked anyone.</p> : <ul className="mt-4 divide-y divide-slate-900/5">{blocked.map((item) => <li key={item.userId} className="flex items-center justify-between gap-3 py-3"><div className="flex min-w-0 items-center gap-2"><UserRound className="h-4 w-4 shrink-0 text-[#94A3B8]"/><div className="min-w-0"><p className="truncate text-sm font-bold">{item.displayName}</p><p className="text-xs text-[#64748B]">Blocked {new Date(item.blockedAt).toLocaleDateString('en-IN')}</p></div></div><button disabled={busyId === item.userId} onClick={() => void unblock(item.userId)} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F4F2EE] px-3 py-2 text-xs font-bold disabled:opacity-50"><Undo2 className="h-3.5 w-3.5"/>Unblock</button></li>)}</ul>}
    </div>
      <div className="rounded-[28px] bg-white p-5 shadow-kinship-1 sm:p-6"><header className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-700"/><div><h2 className="font-extrabold">Your reports</h2><p className="text-xs text-[#64748B]">Only you and the safety team can see these.</p></div><button aria-label="Refresh safety settings" onClick={() => setReloadKey((key) => key + 1)} className="ml-auto rounded-full bg-[#F4F2EE] p-2 text-[#475569]"><RefreshCw className="h-3.5 w-3.5"/></button></header>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{loading ? <p className="mt-4 text-sm text-[#64748B]">Loading…</p> : reports.length === 0 ? <p className="mt-4 rounded-xl bg-[#FAF9F6] p-4 text-sm text-[#64748B]">No reports submitted.</p> : <ul className="mt-4 space-y-2">{reports.map((report) => <li key={report.id} className="rounded-xl bg-[#FAF9F6] p-3"><div className="flex items-start justify-between gap-2"><p className="text-sm font-bold">{report.reportedDisplayName}</p><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#475569]">{STATUS[report.status]}</span></div><p className="mt-1 flex items-center gap-1 text-xs text-[#64748B]"><Flag className="h-3 w-3"/>{report.reason.replaceAll('_', ' ').toLowerCase()}</p></li>)}</ul>}
    </div>
    <div className="rounded-[28px] bg-white p-5 shadow-kinship-1 sm:p-6"><header className="flex items-center gap-2"><Download className="h-5 w-5 text-[#F05A4A]"/><div><h2 className="font-extrabold">Export your data</h2><p className="text-xs text-[#64748B]">Download a JSON copy of your profile and activity.</p></div></header><p className="mt-3 text-xs leading-5 text-[#64748B]">Includes your listings, saved homes, visits, conversations, messages, discovery actions, community posts and comments, reports you submitted, blocks, and notifications. Passwords and session credentials are excluded. Photo links in the file expire after 15 minutes.</p>{exportError && <p role="alert" className="mt-3 text-sm text-red-700">{exportError}</p>}{exportNotice && <p role="status" className="mt-3 text-sm text-emerald-800">{exportNotice}</p>}<button disabled={exporting} onClick={() => void exportData()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1E293B] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Download className="h-3.5 w-3.5"/>{exporting ? 'Preparing export…' : 'Download my data'}</button></div>
  </section>;
}
