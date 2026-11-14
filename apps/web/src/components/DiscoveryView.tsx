import {useEffect, useState} from 'react';
import {Ban, Flag, Heart, MapPin, Star, UserRound, X} from 'lucide-react';
import type {PublicProfileDto} from '@other-half/contracts';
import type {CityId, LifestylePreferences} from '../types';
import {CITY_THEMES} from '../data/indiaData';
import {calculateCompatibility} from '../utils/compatibility';
import {getDiscoveryProfiles, sendDiscoveryAction} from '../services/discovery';
import {blockMember} from '../services/safety';
import {ReportMemberDialog} from './ReportMemberDialog';

interface Props {
  cityId: CityId;
  userPrefs: LifestylePreferences;
  onOpenProfileSettings: () => void;
  onOpenConversation: (conversationId: string) => void;
}

function Initials({name}: {name: string}) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  return <div aria-hidden="true" className="grid h-36 w-36 place-items-center rounded-[36px] bg-gradient-to-br from-[#FDE3D8] via-[#FFD3C2] to-[#F3B2A6] text-5xl font-black tracking-tight text-[#91483D] shadow-inner">{initials || <UserRound className="h-16 w-16"/>}</div>;
}

export function DiscoveryView({cityId, userPrefs, onOpenProfileSettings, onOpenConversation}: Props) {
  const [profiles, setProfiles] = useState<PublicProfileDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [discoveryEnabled, setDiscoveryEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{text: string; conversationId?: string} | null>(null);
  const [reportTarget, setReportTarget] = useState<PublicProfileDto | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const city = CITY_THEMES[cityId];

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setNotice(null);
    void getDiscoveryProfiles(cityId, undefined, controller.signal).then((page) => {
      if (controller.signal.aborted) return;
      setProfiles(page.items); setNextCursor(page.nextCursor); setDiscoveryEnabled(page.discoveryEnabled);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {setError(cause instanceof Error ? cause.message : 'Could not load people.'); setProfiles([]);}
    }).finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [cityId, reloadKey]);

  const act = async (action: 'PASS' | 'LIKE' | 'SUPER_LIKE') => {
    const profile = profiles[0];
    if (!profile || busy) return;
    setBusy(true); setError('');
    try {
      const result = await sendDiscoveryAction(profile.id, action);
      setProfiles((current) => current.filter((item) => item.id !== profile.id));
      if (result.matched && result.conversationId) {
        setNotice({text: `It’s a mutual match with ${profile.displayName}! Your private conversation is ready.`, conversationId: result.conversationId});
      } else if (action === 'PASS') {
        setNotice({text: `You passed on ${profile.displayName}.`});
      } else {
        setNotice({text: `Your like for ${profile.displayName} is saved. You’ll match if they like you too.`});
      }
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not save your choice.');}
    finally {setBusy(false);}
  };

  const loadMore = async () => {
    if (!nextCursor || busy) return;
    setBusy(true); setError('');
    try {const page = await getDiscoveryProfiles(cityId, nextCursor); setProfiles((current) => [...current, ...page.items]); setNextCursor(page.nextCursor);}
    catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not load more people.');}
    finally {setBusy(false);}
  };

  const blockProfile = async () => {
    const profile = profiles[0];
    if (!profile || busy) return;
    setBusy(true); setError('');
    try {
      await blockMember(profile.id);
      setProfiles((current) => current.filter((item) => item.id !== profile.id));
      setNotice({text: `${profile.displayName} is blocked and hidden from your discovery.`});
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not block this member.');}
    finally {setBusy(false);}
  };

  if (loading) return <div className="rounded-3xl bg-white p-10 text-center text-sm text-[#64748B]">Finding people in {city.name}…</div>;
  if (!discoveryEnabled) return <section className="rounded-[32px] bg-white p-8 text-center shadow-kinship-1 sm:p-12"><UserRound className="mx-auto h-10 w-10 text-[#F05A4A]"/><h2 className="mt-4 text-xl font-extrabold">Choose when your profile is discoverable</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#64748B]">Roommate discovery is opt-in. Turn it on in Profile & Quiz when you’re ready to show your profile to other members in {city.name}.</p><button onClick={onOpenProfileSettings} className="mt-5 rounded-full bg-[#1E293B] px-5 py-3 text-sm font-bold text-white">Open profile settings</button></section>;

  const profile = profiles[0];
  const compatibility = profile ? calculateCompatibility(userPrefs, profile.preferences, profile.preferences.maxBudget) : null;
  return <>{reportTarget && <ReportMemberDialog userId={reportTarget.id} displayName={reportTarget.displayName} onClose={() => setReportTarget(null)} />}<section className="mx-auto max-w-[560px] space-y-4">
    <header className="flex items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#F05A4A]">Real member profiles</p><h1 className="mt-1 text-2xl font-extrabold">Find your other half</h1><p className="mt-1 text-sm text-[#64748B]">People who opted into discovery in {city.name}</p></div><span className="rounded-full bg-white px-3 py-2 text-xs font-bold text-[#475569]">{profiles.length} to explore</span></header>
    {notice && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><span>{notice.text}</span>{notice.conversationId && <button onClick={() => onOpenConversation(notice.conversationId!)} className="rounded-full bg-emerald-800 px-4 py-2 text-xs font-bold text-white">Open chat</button>}</div>}
    {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}<button className="ml-3 font-bold underline" onClick={() => setReloadKey((key) => key + 1)}>Retry</button></p>}
    {profile ? <article className="overflow-hidden rounded-[32px] border border-slate-900/5 bg-white p-5 shadow-kinship-2 sm:p-7">
      <div className="flex flex-col items-center text-center"><Initials name={profile.displayName}/><div className="mt-4 flex flex-wrap items-center justify-center gap-2"><h2 className="text-2xl font-extrabold text-[#1E293B]">{profile.displayName}{profile.age ? `, ${profile.age}` : ''}</h2>{compatibility && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-800">{compatibility.overallPercent}% lifestyle fit</span>}</div><p className="mt-1 text-sm font-semibold text-[#64748B]">{profile.role || 'Getting to know the city'}{profile.neighborhood ? ` · ${profile.neighborhood}` : ''}</p><p className="mt-4 max-w-md whitespace-pre-wrap text-sm leading-6 text-[#475569]">{profile.bio || 'This member has not added a bio yet.'}</p></div>
      <div className="mt-5 rounded-2xl bg-[#FAF9F6] p-4"><p className="text-xs font-extrabold uppercase tracking-wide text-[#64748B]">Lifestyle preferences</p><div className="mt-3 flex flex-wrap gap-2">{[profile.preferences.sleep, profile.preferences.kitchen, profile.preferences.work, profile.preferences.cleanliness, profile.preferences.social].map((item) => <span key={item} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#475569]">{item}</span>)}</div><p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-[#1E293B]"><MapPin className="h-4 w-4 text-[#F05A4A]"/>{profile.neighborhood || 'Neighborhood not set'}, {city.name}</p></div>
      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><button disabled={busy} onClick={() => void act('PASS')} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#F4F2EE] text-sm font-bold text-[#475569] disabled:opacity-50"><X className="h-4 w-4"/>Pass</button><button disabled={busy} aria-label="Super like" onClick={() => void act('SUPER_LIKE')} className="grid h-12 w-12 place-items-center rounded-full bg-[#E08738] text-white disabled:opacity-50"><Star className="h-5 w-5 fill-white"/></button><button disabled={busy} onClick={() => void act('LIKE')} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#F05A4A] text-sm font-bold text-white disabled:opacity-50"><Heart className="h-4 w-4 fill-white"/>Like</button></div>
      <div className="mt-3 flex justify-center gap-5 border-t border-slate-900/5 pt-3"><button disabled={busy} onClick={() => void blockProfile()} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#64748B] hover:text-[#1E293B] disabled:opacity-50"><Ban className="h-3.5 w-3.5"/>Block and hide</button><button onClick={() => setReportTarget(profile)} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#64748B] hover:text-[#B42318]"><Flag className="h-3.5 w-3.5"/>Report</button></div>
    </article> : <div className="rounded-[32px] border border-dashed border-slate-300 bg-white p-10 text-center"><UserRound className="mx-auto h-9 w-9 text-[#F05A4A]"/><h2 className="mt-3 font-extrabold">No more profiles in {city.name}</h2><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#64748B]">More people will appear when members in your city opt into discovery.</p>{nextCursor && <button disabled={busy} onClick={() => void loadMore()} className="mt-4 rounded-full bg-[#1E293B] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">Load more profiles</button>}</div>}
  </section></>;
}
