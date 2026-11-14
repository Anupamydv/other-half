import {useState, type FormEvent} from 'react';
import {X} from 'lucide-react';
import {communityPostCreateSchema, type CommunityPostInput, type CommunityPostType} from '@other-half/contracts';
import {CITY_THEMES} from '../data/indiaData';
import type {CityId} from '../types';

const POST_TYPES: Array<{id: CommunityPostType; label: string}> = [
  {id: 'ROOM_AVAILABLE', label: 'Room available'},
  {id: 'LOOKING_FOR_FLATMATE', label: 'Looking for a flatmate'},
  {id: 'GENERAL', label: 'Community update'},
];

export function CreatePostModal({defaultCity, defaultNeighborhood, onClose, onPublish}: {
  defaultCity: CityId;
  defaultNeighborhood?: string;
  onClose: () => void;
  onPublish: (input: CommunityPostInput) => Promise<void>;
}) {
  const cityId = defaultCity;
  const [neighborhood, setNeighborhood] = useState(defaultNeighborhood && defaultNeighborhood !== 'All Areas'
    ? defaultNeighborhood
    : CITY_THEMES[defaultCity].neighborhoods.find((item) => item !== 'All Areas') ?? '');
  const [postType, setPostType] = useState<CommunityPostType>('ROOM_AVAILABLE');
  const [caption, setCaption] = useState('');
  const [flatTitle, setFlatTitle] = useState('');
  const [rent, setRent] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const city = CITY_THEMES[cityId];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError('');
    const parsed = communityPostCreateSchema.safeParse({
      cityId, neighborhood, postType, caption,
      rentPerMonth: rent.trim() ? Number(rent) : null,
      flatTitle: flatTitle.trim() || null,
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 4),
    });
    if (!parsed.success) {setError(parsed.error.issues[0]?.message ?? 'Review your post.'); return;}
    setBusy(true);
    try {await onPublish(parsed.data); onClose();}
    catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not publish this update.');}
    finally {setBusy(false);}
  };

  const inputClass = 'mt-1.5 h-11 w-full rounded-xl bg-[#F4F2EE] px-3.5 text-sm text-[#1E293B] outline-none focus:ring-2 focus:ring-[#F05A4A]/40';
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Create community post">
    <section className="max-h-[90vh] w-full overflow-y-auto rounded-t-[32px] bg-white p-5 shadow-kinship-3 sm:max-w-lg sm:rounded-[32px] sm:p-6">
      <header className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-extrabold text-[#1E293B]">Share with your city</h2><p className="mt-1 text-xs text-[#64748B]">Updates are saved to your account and visible to signed-in members in that city.</p></div><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-[#F4F2EE]"><X className="h-4 w-4"/></button></header>
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <div className="flex flex-wrap gap-2">{POST_TYPES.map((type) => <button key={type.id} type="button" aria-pressed={postType === type.id} onClick={() => setPostType(type.id)} className={`rounded-full px-3.5 py-2 text-xs font-bold ${postType === type.id ? 'bg-[#F05A4A] text-white' : 'bg-[#F4F2EE] text-[#1E293B]'}`}>{type.label}</button>)}</div>
        <label className="block text-xs font-bold text-[#1E293B]">Neighborhood in {city.name}<select value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} className={inputClass}>{city.neighborhoods.filter((item) => item !== 'All Areas').map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        {postType !== 'GENERAL' && <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-bold text-[#1E293B]">{postType === 'ROOM_AVAILABLE' ? 'Room or flat title' : 'What kind of home?' }<input value={flatTitle} onChange={(event) => setFlatTitle(event.target.value)} maxLength={120} className={inputClass} placeholder="e.g. Private room near metro"/></label>
          {postType === 'ROOM_AVAILABLE' && <label className="block text-xs font-bold text-[#1E293B]">Monthly rent (₹)<input type="number" min={1000} max={2000000} step={500} value={rent} onChange={(event) => setRent(event.target.value)} className={inputClass} placeholder="Optional"/></label>}
        </div>}
        <label className="block text-xs font-bold text-[#1E293B]">Your update<textarea required minLength={10} maxLength={2000} rows={5} value={caption} onChange={(event) => setCaption(event.target.value)} className="mt-1.5 w-full rounded-xl bg-[#F4F2EE] p-3.5 text-sm leading-6 text-[#1E293B] outline-none focus:ring-2 focus:ring-[#F05A4A]/40" placeholder="Share the key details, what you’re looking for, and how members can get in touch."/><span className="mt-1 block text-right text-[11px] text-[#64748B]">{caption.length}/2000</span></label>
        <label className="block text-xs font-bold text-[#1E293B]">Tags <span className="font-medium text-[#64748B]">(up to 4, comma separated)</span><input value={tags} onChange={(event) => setTags(event.target.value)} className={inputClass} placeholder="Metro, furnished, pet friendly"/></label>
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">Community updates are text-only. To publish verified rent, amenities, and photos, create a housing listing instead.</p>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl bg-[#F4F2EE] px-5 py-3 text-sm font-bold text-[#475569]">Cancel</button><button disabled={busy} className="rounded-xl bg-[#F05A4A] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Publishing…' : 'Publish update'}</button></div>
      </form>
    </section>
  </div>;
}
