import {useEffect, useState} from 'react';
import {Heart, MessageCircle, UserRound} from 'lucide-react';
import type {MatchDto} from '@other-half/contracts';
import {CITY_THEMES} from '../data/indiaData';
import {calculateCompatibility} from '../utils/compatibility';
import {getMatches, openMatchConversation} from '../services/discovery';
import type {LifestylePreferences} from '../types';

export function RealMatchesView({userPrefs, onOpenConversation}: {userPrefs: LifestylePreferences; onOpenConversation: (id: string) => void}) {
  const [items, setItems] = useState<MatchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    const refresh = async (signal?: AbortSignal) => {
      const matches = await getMatches(signal);
      if (!signal?.aborted) setItems(matches);
    };
    void refresh(controller.signal)
      .catch((cause: unknown) => {if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load matches.');})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    const poll = window.setInterval(() => {if (!document.hidden) void refresh().catch(() => undefined);}, 30_000);
    const onFocus = () => void refresh().catch(() => undefined);
    window.addEventListener('focus', onFocus);
    return () => {controller.abort(); window.clearInterval(poll); window.removeEventListener('focus', onFocus);};
  }, [reloadKey]);
  const openChat = async (item: MatchDto) => {
    setBusyId(item.id); setError('');
    try {onOpenConversation(await openMatchConversation(item.id));}
    catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not open this conversation.');}
    finally {setBusyId(null);}
  };
  return <section className="space-y-5"><header className="rounded-[28px] bg-white p-5 shadow-kinship-1 sm:p-6"><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#F05A4A]">Mutual interest</p><h1 className="mt-1 text-2xl font-extrabold">Your matches</h1><p className="mt-1 text-sm text-[#64748B]">A match appears when both members choose to connect.</p></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}<button className="ml-3 font-bold underline" onClick={() => setReloadKey((key) => key + 1)}>Retry</button></p>}
    {loading ? <div className="rounded-3xl bg-white p-10 text-center text-sm text-[#64748B]">Loading your matches…</div> : items.length === 0 ? <div className="rounded-[28px] bg-white p-10 text-center shadow-kinship-1"><Heart className="mx-auto h-9 w-9 text-[#F05A4A]"/><h2 className="mt-3 font-extrabold">No mutual matches yet</h2><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#64748B]">Turn on discovery in Profile & Quiz and like real member profiles. You’ll see someone here when they like you back.</p></div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => {const profile = item.profile; const compatibility = calculateCompatibility(userPrefs, profile.preferences, profile.preferences.maxBudget); const initials = profile.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(''); return <article key={item.id} className="rounded-[28px] bg-white p-5 shadow-kinship-1"><div className="flex items-center gap-3"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#FDE3D8] to-[#F3B2A6] text-xl font-black text-[#91483D]">{initials || <UserRound/>}</div><div className="min-w-0"><h2 className="truncate font-extrabold">{profile.displayName}{profile.age ? `, ${profile.age}` : ''}</h2><p className="truncate text-xs text-[#64748B]">{profile.neighborhood || 'Neighborhood not set'}, {CITY_THEMES[profile.cityId].name}</p></div></div><p className="mt-3 text-xs leading-5 text-[#64748B]">{profile.bio || 'No bio added yet.'}</p><div className="mt-3 flex items-center justify-between"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{compatibility.overallPercent}% lifestyle fit</span><span className="text-xs text-[#94A3B8]">Matched {new Date(item.createdAt).toLocaleDateString('en-IN', {day: 'numeric', month: 'short'})}</span></div><button disabled={busyId === item.id} onClick={() => void openChat(item)} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#F05A4A] text-sm font-bold text-white disabled:opacity-50"><MessageCircle className="h-4 w-4"/>{busyId === item.id ? 'Opening…' : 'Message'}</button></article>;})}</div>}</section>;
}
