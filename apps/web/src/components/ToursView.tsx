import {useEffect, useState} from 'react';
import {CalendarCheck, CalendarDays, Check, Clock3, MapPin, MessageCircle, X} from 'lucide-react';
import type {TourRequestDto} from '@other-half/contracts';
import {cancelTourRequest, getTourRequests, resolveTourRequest} from '../services/tours';
import {startConversationForTour} from '../services/conversations';

type Direction = 'incoming' | 'outgoing';

const TIME_LABELS: Record<TourRequestDto['timeSlot'], string> = {
  MORNING: 'Morning · 9 AM–12 PM',
  AFTERNOON: 'Afternoon · 12–4 PM',
  EVENING: 'Evening · 4–7 PM',
};

const STATUS_LABELS: Record<TourRequestDto['status'], string> = {
  PENDING: 'Waiting for response',
  CONFIRMED: 'Visit window accepted',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

export function ToursView({onOpenConversation}: {onOpenConversation: (conversationId: string) => void}) {
  const [direction, setDirection] = useState<Direction>('outgoing');
  const [items, setItems] = useState<TourRequestDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void getTourRequests(direction, undefined, controller.signal).then((page) => {
      if (controller.signal.aborted) return;
      setItems(page.items);
      setNextCursor(page.nextCursor);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Could not load visit requests.');
        setItems([]);
        setNextCursor(null);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [direction, reloadKey]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const page = await getTourRequests(direction, nextCursor);
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load more visit requests.');
    } finally {
      setLoadingMore(false);
    }
  };

  const resolve = async (item: TourRequestDto, decision: 'CONFIRM' | 'DECLINE') => {
    setBusyId(item.id);
    setError('');
    try {
      await resolveTourRequest(item.id, decision);
      setNotice(decision === 'CONFIRM'
        ? 'Visit window accepted. Other pending requests for the same window were declined.'
        : 'Visit request declined.');
      setReloadKey((key) => key + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this visit request.');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (item: TourRequestDto) => {
    setBusyId(item.id);
    setError('');
    try {
      await cancelTourRequest(item.id);
      setNotice('Visit request cancelled.');
      setReloadKey((key) => key + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not cancel this visit request.');
    } finally {
      setBusyId(null);
    }
  };

  const messageParticipant = async (item: TourRequestDto) => {
    setOpeningId(item.id); setError('');
    try {onOpenConversation(await startConversationForTour(item.id));}
    catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not open the conversation.');}
    finally {setOpeningId(null);}
  };

  return <section className="space-y-5">
    <div className="rounded-[28px] bg-white p-5 shadow-kinship-1 sm:p-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#F05A4A]">Arrange a visit</p>
      <h1 className="mt-1 text-2xl font-extrabold text-[#1E293B]">Tour requests</h1>
      <p className="mt-1 text-sm leading-6 text-[#64748B]">Request a visit window as a guest, or confirm and manage requests for your listings.</p>
    </div>
    <div className="flex gap-2">
      <button onClick={() => {setDirection('outgoing'); setNotice('');}} className={`rounded-full px-4 py-2 text-sm font-bold ${direction === 'outgoing' ? 'bg-[#1E293B] text-white' : 'bg-white text-[#64748B]'}`}><CalendarDays className="mr-1 inline h-4 w-4" /> My requests</button>
      <button onClick={() => {setDirection('incoming'); setNotice('');}} className={`rounded-full px-4 py-2 text-sm font-bold ${direction === 'incoming' ? 'bg-[#1E293B] text-white' : 'bg-white text-[#64748B]'}`}><CalendarCheck className="mr-1 inline h-4 w-4" /> For my listings</button>
    </div>
    {notice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span>{items.length === 0 && <button onClick={() => setReloadKey((key) => key + 1)} className="font-bold underline">Retry</button>}</p>}
    {loading ? <div className="rounded-3xl bg-white p-10 text-center text-sm text-[#64748B]">Loading visit requests…</div>
      : error && items.length === 0 ? null
      : items.length === 0 ? <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center"><CalendarCheck className="mx-auto h-8 w-8 text-[#F05A4A]" /><h2 className="mt-3 font-bold text-[#1E293B]">{direction === 'outgoing' ? 'No visit requests yet' : 'No requests for your listings'}</h2><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#64748B]">{direction === 'outgoing' ? 'Request a visit from a home listing; updates will appear here.' : 'When someone asks to visit one of your homes, you can respond here.'}</p></div>
      : <div className="grid gap-4 lg:grid-cols-2">{items.map((item) => {
        const isIncoming = direction === 'incoming';
        const personName = isIncoming ? item.requesterDisplayName : item.ownerDisplayName;
        const date = new Date(`${item.scheduledDate}T00:00:00`).toLocaleDateString('en-IN', {weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'});
        const pending = item.status === 'PENDING';
        return <article key={item.id} className="rounded-[24px] bg-white p-5 shadow-kinship-1">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-extrabold uppercase tracking-wide text-[#F05A4A]">{isIncoming ? 'Visit request from' : 'Visit requested with'}</p><h2 className="mt-1 text-lg font-extrabold text-[#1E293B]">{personName}</h2></div><span className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${item.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-800' : item.status === 'PENDING' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{STATUS_LABELS[item.status]}</span></div>
          <h3 className="mt-4 font-bold text-[#1E293B]">{item.listingTitle}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[#64748B]"><MapPin className="h-3.5 w-3.5" />{item.neighborhood}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-[#475569]"><span><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{date}</span><span><Clock3 className="mr-1 inline h-3.5 w-3.5" />{TIME_LABELS[item.timeSlot]}</span></div>
          {item.note && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-[#F8F7F4] p-3 text-xs leading-5 text-[#475569]">{item.note}</p>}
          {(pending || item.status === 'CONFIRMED') && <div className="mt-4 flex flex-wrap gap-2">
            {item.status === 'CONFIRMED' && <button disabled={openingId === item.id} onClick={() => void messageParticipant(item)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#F05A4A] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><MessageCircle className="h-3.5 w-3.5" />{openingId === item.id ? 'Opening…' : 'Message to coordinate'}</button>}
            {pending && isIncoming && <><button disabled={busyId === item.id} onClick={() => void resolve(item, 'CONFIRM')} className="inline-flex items-center gap-1.5 rounded-xl bg-[#F05A4A] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Accept window</button><button disabled={busyId === item.id} onClick={() => void resolve(item, 'DECLINE')} className="inline-flex items-center gap-1.5 rounded-xl bg-[#F4F2EE] px-4 py-2.5 text-xs font-bold text-[#475569] disabled:opacity-50"><X className="h-3.5 w-3.5" /> Decline</button></>}
            {(pending && !isIncoming || item.status === 'CONFIRMED') && <button disabled={busyId === item.id} onClick={() => void cancel(item)} className="rounded-xl bg-[#F4F2EE] px-4 py-2.5 text-xs font-bold text-[#475569] disabled:opacity-50">{item.status === 'CONFIRMED' ? 'Cancel accepted visit' : 'Cancel request'}</button>}
          </div>}
        </article>;
      })}</div>}
    {!loading && nextCursor && <div className="text-center"><button disabled={loadingMore} onClick={() => void loadMore()} className="rounded-full bg-white px-5 py-3 text-sm font-bold text-[#1E293B] disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load more requests'}</button></div>}
  </section>;
}
