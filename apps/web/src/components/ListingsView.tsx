import {useEffect, useState, type FormEvent} from 'react';
import {Archive, ArrowLeft, Bookmark, BookmarkCheck, Building2, CalendarDays, Check, ChevronDown, Home, MapPin, Pencil, Plus, Search, Trash2, Upload} from 'lucide-react';
import {
  listingCreateSchema,
  type ListingAmenity,
  type ListingDto,
  type ListingInput,
  type ListingType,
} from '@other-half/contracts';
import {CITY_THEMES} from '../data/indiaData';
import {archiveListing, createListing, deleteListingPhoto, getListings, getMyListings, getSavedListings, saveListing, unsaveListing, updateListing, uploadListingPhoto} from '../services/listings';
import {TourRequestForm} from './TourRequestForm';
import type {CityId} from '../types';

interface ListingsViewProps {
  cityId: CityId;
  neighborhood: string;
  userId: string;
}

type ViewMode = 'browse' | 'saved' | 'mine' | 'form';

const TYPE_LABELS: Record<ListingType, string> = {
  PRIVATE_ROOM: 'Private room',
  SHARED_ROOM: 'Shared room',
  ENTIRE_FLAT: 'Entire flat',
};

const AMENITIES: Array<{id: ListingAmenity; label: string}> = [
  {id: 'FURNISHED', label: 'Furnished'},
  {id: 'WIFI', label: 'Wi-Fi'},
  {id: 'AIR_CONDITIONING', label: 'Air conditioning'},
  {id: 'LAUNDRY', label: 'Laundry'},
  {id: 'PARKING', label: 'Parking'},
  {id: 'PET_FRIENDLY', label: 'Pet friendly'},
  {id: 'VEGETARIAN_HOUSEHOLD', label: 'Vegetarian household'},
];

export function ListingsView({cityId, neighborhood, userId}: ListingsViewProps) {
  const [mode, setMode] = useState<ViewMode>('browse');
  const [items, setItems] = useState<ListingDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [rentInput, setRentInput] = useState('');
  const [maxRent, setMaxRent] = useState('');
  const [availableBy, setAvailableBy] = useState('');
  const [filterType, setFilterType] = useState<ListingType | ''>('');
  const [filterAmenities, setFilterAmenities] = useState<ListingAmenity[]>([]);
  const [mineStatus, setMineStatus] = useState<'' | 'ACTIVE' | 'ARCHIVED'>('');
  const [editing, setEditing] = useState<ListingDto | null>(null);
  const [tourTarget, setTourTarget] = useState<ListingDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingListingId, setSavingListingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setMaxRent(rentInput), 350);
    return () => window.clearTimeout(timeout);
  }, [rentInput]);

  useEffect(() => {
    if (mode === 'form') return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const request = mode === 'browse'
      ? getListings({
          cityId,
          ...(neighborhood !== 'All Areas' ? {neighborhood} : {}),
          ...(maxRent ? {maxRent: Number(maxRent)} : {}),
          ...(filterType ? {listingType: filterType} : {}),
          ...(availableBy ? {availableBy} : {}),
          ...(filterAmenities.length ? {amenities: filterAmenities} : {}),
        }, controller.signal)
      : mode === 'mine'
        ? getMyListings({...(mineStatus ? {status: mineStatus} : {})}, controller.signal)
        : getSavedListings({}, controller.signal);
    void request.then((page) => {
      if (controller.signal.aborted) return;
      setItems(page.items);
      setNextCursor(page.nextCursor);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Could not load listings.');
        setItems([]);
        setNextCursor(null);
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [mode, cityId, neighborhood, maxRent, availableBy, filterType, filterAmenities, mineStatus, reloadKey]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const page = mode === 'browse'
        ? await getListings({
            cityId,
            ...(neighborhood !== 'All Areas' ? {neighborhood} : {}),
            ...(maxRent ? {maxRent: Number(maxRent)} : {}),
            ...(filterType ? {listingType: filterType} : {}),
            ...(availableBy ? {availableBy} : {}),
            ...(filterAmenities.length ? {amenities: filterAmenities} : {}),
            cursor: nextCursor,
          })
        : mode === 'mine'
          ? await getMyListings({...(mineStatus ? {status: mineStatus} : {}), cursor: nextCursor})
          : await getSavedListings({cursor: nextCursor});
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load more listings.');
    } finally {
      setLoadingMore(false);
    }
  };

  const startCreate = () => {
    setEditing(null);
    setNotice('');
    setMode('form');
  };

  const finishSave = () => {
    setNotice(editing ? 'Listing changes saved.' : 'Your listing is live.');
    setEditing(null);
    setMode('mine');
    setMineStatus('ACTIVE');
    setReloadKey((key) => key + 1);
  };

  const handleArchive = async (listing: ListingDto) => {
    if (!window.confirm(`Archive “${listing.title}”? It will be removed from public search but remain in your account.`)) return;
    setError('');
    try {
      await archiveListing(listing.id);
      setNotice('Listing archived and removed from public search.');
      setReloadKey((key) => key + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not archive this listing.');
    }
  };

  const handleToggleSaved = async (listing: ListingDto) => {
    setSavingListingId(listing.id);
    setError('');
    try {
      if (listing.savedByMe) {
        await unsaveListing(listing.id);
        if (mode === 'saved') setItems((current) => current.filter((item) => item.id !== listing.id));
      } else {
        await saveListing(listing.id);
      }
      setItems((current) => current.map((item) => item.id === listing.id
        ? {...item, savedByMe: !listing.savedByMe}
        : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update saved homes.');
    } finally {
      setSavingListingId(null);
    }
  };

  if (mode === 'form') {
    return <ListingForm
      cityId={cityId}
      listing={editing}
      onCancel={() => {setEditing(null); setMode('mine');}}
      onSaved={finishSave}
    />;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 rounded-[28px] bg-white p-5 shadow-kinship-1 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#F05A4A]">Homes and rooms</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#1E293B]">Find a place that fits.</h1>
          <p className="mt-1 text-sm text-[#64748B]">Active listings are stored by the API. Exact street addresses are never requested or shown.</p>
        </div>
        <button onClick={startCreate} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#F05A4A] px-5 text-sm font-bold text-white hover:bg-[#df4d3d]"><Plus className="h-4 w-4" /> List a room or flat</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => {setMode('browse'); setNotice('');}} className={`rounded-full px-4 py-2 text-sm font-bold ${mode === 'browse' ? 'bg-[#1E293B] text-white' : 'bg-white text-[#64748B]'}`}><Search className="mr-1 inline h-4 w-4" /> Browse homes</button>
        <button onClick={() => {setMode('saved'); setNotice('');}} className={`rounded-full px-4 py-2 text-sm font-bold ${mode === 'saved' ? 'bg-[#1E293B] text-white' : 'bg-white text-[#64748B]'}`}><Bookmark className="mr-1 inline h-4 w-4" /> Saved homes</button>
        <button onClick={() => {setMode('mine'); setNotice('');}} className={`rounded-full px-4 py-2 text-sm font-bold ${mode === 'mine' ? 'bg-[#1E293B] text-white' : 'bg-white text-[#64748B]'}`}><Home className="mr-1 inline h-4 w-4" /> My listings</button>
        {mode === 'browse' ? <>
          <label className="ml-auto flex h-10 items-center gap-2 rounded-full bg-white px-3 text-xs font-semibold text-[#64748B]">
            <span>Max rent ₹</span><input aria-label="Maximum monthly rent" inputMode="numeric" value={rentInput} onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, '').slice(0, 7);
              if (!digits || (Number(digits) >= 1_000 && Number(digits) <= 2_000_000)) setRentInput(digits);
            }} className="w-20 bg-transparent text-sm text-[#1E293B] outline-none" placeholder="Any" />
          </label>
          <label className="flex h-10 items-center gap-2 rounded-full bg-white px-3 text-xs font-semibold text-[#64748B]">
            <span className="sr-only">Room type</span><select aria-label="Filter by room type" value={filterType} onChange={(event) => setFilterType(event.target.value as ListingType | '')} className="bg-transparent text-sm text-[#1E293B] outline-none"><option value="">Any room type</option>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown className="h-3.5 w-3.5" />
          </label>
          <label className="flex h-10 items-center gap-2 rounded-full bg-white px-3 text-xs font-semibold text-[#64748B]">
            <span>Move in by</span><input aria-label="Available by date" type="date" min={new Date().toISOString().slice(0, 10)} value={availableBy} onChange={(event) => setAvailableBy(event.target.value)} className="max-w-32 bg-transparent text-xs text-[#1E293B] outline-none" />
          </label>
        </> : mode === 'mine' ? <label className="ml-auto flex h-10 items-center gap-2 rounded-full bg-white px-3 text-xs font-semibold text-[#64748B]">
          <span className="sr-only">Listing status</span><select aria-label="Filter my listings by status" value={mineStatus} onChange={(event) => setMineStatus(event.target.value as '' | 'ACTIVE' | 'ARCHIVED')} className="bg-transparent text-sm text-[#1E293B] outline-none"><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option></select><ChevronDown className="h-3.5 w-3.5" />
        </label> : null}
      {mode === 'browse' && <div className="flex flex-wrap items-center gap-2" aria-label="Filter by amenities">
        <span className="mr-1 text-xs font-bold text-[#64748B]">Must have:</span>
        {AMENITIES.map((amenity) => {
          const selected = filterAmenities.includes(amenity.id);
          return <button key={amenity.id} type="button" aria-pressed={selected} onClick={() => setFilterAmenities((current) => selected ? current.filter((item) => item !== amenity.id) : [...current, amenity.id])} className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${selected ? 'bg-[#1E293B] text-white' : 'bg-white text-[#64748B]'}`}>{amenity.label}</button>;
        })}
      </div>}
      </div>

      {notice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</p>}
      {error && <p role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span>{items.length === 0 && <button onClick={() => setReloadKey((key) => key + 1)} className="font-bold underline">Retry</button>}</p>}
      {loading ? <div className="rounded-3xl bg-white p-10 text-center text-sm text-[#64748B]">Loading listings…</div> : error && items.length === 0 ? null : items.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-10 text-center">
          <Building2 className="mx-auto h-8 w-8 text-[#F05A4A]" />
          <h2 className="mt-3 font-bold text-[#1E293B]">{mode === 'mine' ? 'No listings yet' : mode === 'saved' ? 'No saved homes yet' : 'No homes match these filters'}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#64748B]">{mode === 'mine' ? 'Create a listing to help flatmates find your available room or home.' : mode === 'saved' ? 'Save a listing while browsing to keep it here for later.' : 'Try a later move-in date, fewer amenities, a higher rent limit, or a different area.'}</p>
          {mode === 'mine' && <button onClick={startCreate} className="mt-4 rounded-full bg-[#F05A4A] px-5 py-2.5 text-sm font-bold text-white">Create a listing</button>}
          {mode === 'saved' && <button onClick={() => setMode('browse')} className="mt-4 rounded-full bg-[#1E293B] px-5 py-2.5 text-sm font-bold text-white">Browse homes</button>}
        </div>
      ) : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((listing) => <ListingCard
          key={listing.id}
          listing={listing}
          isOwner={listing.ownerId === userId}
          showSave={mode === 'saved' || (mode === 'browse' && listing.ownerId !== userId)}
          showRequest={listing.status === 'ACTIVE' && listing.ownerId !== userId && (mode === 'browse' || mode === 'saved')}
          saving={savingListingId === listing.id}
          onEdit={() => {setEditing(listing); setMode('form'); setNotice('');}}
          onArchive={() => void handleArchive(listing)}
          onToggleSave={() => void handleToggleSaved(listing)}
          onRequestTour={() => setTourTarget(listing)}
        />)}
      </div>}
      {!loading && nextCursor && <div className="text-center"><button disabled={loadingMore} onClick={() => void loadMore()} className="rounded-full bg-white px-5 py-3 text-sm font-bold text-[#1E293B] disabled:opacity-50">{loadingMore ? 'Loading…' : 'Load more homes'}</button></div>}
      {tourTarget && <TourRequestForm
        listing={tourTarget}
        onClose={() => setTourTarget(null)}
        onSent={() => {setTourTarget(null); setNotice('Visit request sent. Track replies in the Tours tab.');}}
      />}
    </section>
  );
}

function ListingCard({listing, isOwner, showSave, showRequest, saving, onEdit, onArchive, onToggleSave, onRequestTour}: {
  listing: ListingDto; isOwner: boolean; showSave: boolean; showRequest: boolean; saving: boolean;
  onEdit: () => void; onArchive: () => void; onToggleSave: () => void; onRequestTour: () => void;
}) {
  const city = CITY_THEMES[listing.cityId];
  const rent = new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 0}).format(listing.monthlyRent);
  const labels = listing.amenities.map((amenity) => AMENITIES.find((item) => item.id === amenity)?.label ?? amenity);
  return <article className="flex flex-col rounded-[24px] bg-white p-5 shadow-kinship-1">
    {listing.media.length > 0 && <div className="-mx-5 -mt-5 mb-4 overflow-hidden rounded-t-[24px] bg-slate-100">
      <img src={listing.media[0].url} alt={listing.media[0].altText || `${listing.title} listing photo`} loading="lazy" className="h-48 w-full object-cover" />
      {listing.media.length > 1 && <p className="px-3 py-1.5 text-right text-[11px] font-semibold text-slate-600">1 of {listing.media.length} photos</p>}
    </div>}
    <div className="flex items-start justify-between gap-3">
      <span className="rounded-full bg-[#F05A4A]/10 px-3 py-1 text-[11px] font-extrabold text-[#AD2A20]">{TYPE_LABELS[listing.listingType]}</span>
      <div className="flex items-center gap-2">
        {listing.status === 'ARCHIVED' && <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">Archived</span>}
        {showSave && <button disabled={saving} onClick={onToggleSave} aria-pressed={listing.savedByMe} aria-label={listing.savedByMe ? 'Remove saved listing' : 'Save listing'} className="inline-flex items-center gap-1 rounded-full bg-[#F4F2EE] px-2.5 py-1.5 text-[11px] font-bold text-[#475569] disabled:opacity-50">{listing.savedByMe ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}{listing.savedByMe ? 'Saved' : 'Save'}</button>}
      </div>
    </div>
    <h2 className="mt-3 text-lg font-extrabold leading-snug text-[#1E293B]">{listing.title}</h2>
    <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[#64748B]"><MapPin className="h-3.5 w-3.5" />{listing.neighborhood}, {city.name}</p>
    <p className="mt-4 text-2xl font-extrabold text-[#1E293B]">{rent}<span className="ml-1 text-xs font-semibold text-[#64748B]">/ month</span></p>
    <p className="mt-3 line-clamp-4 flex-1 whitespace-pre-wrap text-sm leading-6 text-[#475569]">{listing.description}</p>
    <div className="mt-4 flex flex-wrap gap-1.5">
      {labels.map((label) => <span key={label} className="rounded-full bg-[#F4F2EE] px-2.5 py-1 text-[10px] font-bold text-[#475569]">{label}</span>)}
    </div>
    <div className="mt-4 space-y-1 border-t border-slate-900/5 pt-3 text-xs text-[#64748B]">
      <p className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Available {new Date(`${listing.availableFrom}T00:00:00`).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'})} · {listing.minimumStay} month minimum</p>
      <p>Deposit: {listing.deposit === null ? 'Not specified' : `₹${new Intl.NumberFormat('en-IN').format(listing.deposit)}`}</p>
      <p>Listed by {listing.ownerDisplayName}</p>
    </div>
    {isOwner && listing.status === 'ACTIVE' && <div className="mt-4 flex gap-2">
      <button onClick={onEdit} className="flex-1 rounded-xl bg-[#F4F2EE] px-3 py-2.5 text-xs font-bold text-[#1E293B] hover:bg-[#EAE6DF]"><Pencil className="mr-1 inline h-3.5 w-3.5" /> Edit</button>
      <button onClick={onArchive} className="rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100"><Archive className="mr-1 inline h-3.5 w-3.5" /> Archive</button>
    </div>}
    {showRequest && <button onClick={onRequestTour} className="mt-4 w-full rounded-xl bg-[#F05A4A] px-3 py-2.5 text-xs font-bold text-white hover:bg-[#df4d3d]">Request a visit</button>}
  </article>;
}

function ListingForm({cityId, listing, onCancel, onSaved}: {
  cityId: CityId; listing: ListingDto | null; onCancel: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(listing?.title ?? '');
  const [description, setDescription] = useState(listing?.description ?? '');
  const [city, setCity] = useState<CityId>(listing?.cityId ?? cityId);
  const [neighborhood, setNeighborhood] = useState(listing?.neighborhood ?? '');
  const [listingType, setListingType] = useState<ListingType>(listing?.listingType ?? 'PRIVATE_ROOM');
  const [monthlyRent, setMonthlyRent] = useState(listing?.monthlyRent ? String(listing.monthlyRent) : '');
  const [deposit, setDeposit] = useState(listing?.deposit == null ? '' : String(listing.deposit));
  const [availableFrom, setAvailableFrom] = useState(listing?.availableFrom ?? new Date().toISOString().slice(0, 10));
  const [minimumStay, setMinimumStay] = useState(String(listing?.minimumStay ?? 6));
  const [amenities, setAmenities] = useState<ListingAmenity[]>(listing?.amenities ?? []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [persisted, setPersisted] = useState<ListingDto | null>(listing);
  const [removedMedia, setRemovedMedia] = useState<string[]>([]);

  useEffect(() => {
    const urls = photos.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const result = listingCreateSchema.safeParse({
      title, description, cityId: city, neighborhood, listingType,
      monthlyRent: Number(monthlyRent), deposit: deposit === '' ? null : Number(deposit),
      availableFrom, minimumStay: Number(minimumStay), amenities,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Review the listing details.');
      return;
    }
    setBusy(true);
    try {
      const input: ListingInput = result.data;
      const target = persisted ? await updateListing(persisted.id, input) : await createListing(input);
      setPersisted(target);
      for (const photo of photos) {
        await uploadListingPhoto(target.id, photo, photo.name.replace(/\.[^.]+$/, '').slice(0, 200));
        setPhotos((current) => current.filter((item) => item !== photo));
      }
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this listing.');
    } finally {
      setBusy(false);
    }
  };

  const toggleAmenity = (amenity: ListingAmenity) => {
    setAmenities((current) => current.includes(amenity)
      ? current.filter((item) => item !== amenity)
      : [...current, amenity]);
  };

  const handlePhotoSelection = (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files);
    if ((persisted?.media.length ?? 0) + photos.length + selected.length > 5) {
      setError('A listing can have up to five photos. Remove a photo or choose fewer files.');
      return;
    }
    const invalid = selected.find((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024 || file.size === 0);
    if (invalid) {
      setError('Choose JPEG, PNG, or WebP photos under 10 MB each.');
      return;
    }
    setError('');
    setPhotos((current) => [...current, ...selected]);
  };

  const removeExistingPhoto = async (mediaId: string) => {
    if (!persisted) return;
    setBusy(true);
    setError('');
    try {
      await deleteListingPhoto(persisted.id, mediaId);
      setRemovedMedia((current) => [...current, mediaId]);
      setPersisted({...persisted, media: persisted.media.filter((media) => media.id !== mediaId)});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove this photo.');
    } finally {
      setBusy(false);
    }
  };

  const existingPhotos = (persisted?.media ?? []).filter((media) => !removedMedia.includes(media.id));

  const inputClass = 'mt-1.5 h-11 w-full rounded-xl bg-[#F4F2EE] px-3.5 text-sm text-[#1E293B] outline-none focus:ring-2 focus:ring-[#F05A4A]/40';
  const labelClass = 'block text-xs font-bold text-[#1E293B]';
  return <section className="mx-auto max-w-3xl rounded-[28px] bg-white p-5 shadow-kinship-1 sm:p-7">
    <button onClick={onCancel} className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-[#64748B] hover:text-[#1E293B]"><ArrowLeft className="h-3.5 w-3.5" /> Back to my listings</button>
    <h1 className="text-2xl font-extrabold text-[#1E293B]">{listing ? 'Edit listing' : 'List a room or flat'}</h1>
    <p className="mt-1 text-sm leading-6 text-[#64748B]">Share the area and household details. Do not include an exact street address or private access codes.</p>
    <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
      <label className={labelClass}>Listing title<input required minLength={6} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Sunny private room near Indiranagar Metro" /></label>
      <label className={labelClass}>Description<textarea required minLength={30} maxLength={2000} rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5 w-full rounded-xl bg-[#F4F2EE] p-3.5 text-sm leading-6 text-[#1E293B] outline-none focus:ring-2 focus:ring-[#F05A4A]/40" placeholder="Describe the room, household, and what rent includes." /><span className="mt-1 block text-right text-[11px] font-medium text-[#64748B]">{description.length}/2000</span></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>City<select value={city} onChange={(e) => setCity(e.target.value as CityId)} className={inputClass}>{Object.values(CITY_THEMES).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className={labelClass}>Neighborhood<input required minLength={2} maxLength={100} value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={inputClass} placeholder="e.g. HSR Layout" /></label>
        <label className={labelClass}>Home type<select value={listingType} onChange={(e) => setListingType(e.target.value as ListingType)} className={inputClass}>{Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className={labelClass}>Monthly rent (₹)<input required type="number" min={1000} max={2000000} step={500} value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} className={inputClass} placeholder="18000" /></label>
        <label className={labelClass}>Deposit (₹)<input type="number" min={0} max={10000000} step={500} value={deposit} onChange={(e) => setDeposit(e.target.value)} className={inputClass} placeholder="Leave blank if not decided" /></label>
        <label className={labelClass}>Available from<input required type="date" min={new Date().toISOString().slice(0, 10)} value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Minimum stay<select value={minimumStay} onChange={(e) => setMinimumStay(e.target.value)} className={inputClass}>{[1, 3, 6, 9, 12, 18, 24, 36].map((months) => <option key={months} value={months}>{months} months</option>)}</select></label>
      </div>
      <fieldset>
        <legend className={labelClass}>Amenities and household expectations</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {AMENITIES.map((amenity) => <label key={amenity.id} className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#F8F7F4] px-3 py-2.5 text-xs font-semibold text-[#475569]">
            <input type="checkbox" checked={amenities.includes(amenity.id)} onChange={() => toggleAmenity(amenity.id)} className="accent-[#F05A4A]" />{amenity.label}
          </label>)}
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className={labelClass}>Listing photos <span className="font-medium text-[#64748B]">({existingPhotos.length + photos.length}/5)</span></legend>
        <p className="text-xs leading-5 text-[#64748B]">JPEG, PNG, or WebP up to 10 MB each. Photos are private in storage and shown through temporary links.</p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#F4F2EE] px-4 py-3 text-xs font-bold text-[#1E293B] hover:bg-[#EAE6DF]"><Upload className="h-4 w-4" /> Choose photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || existingPhotos.length + photos.length >= 5} onChange={(event) => {handlePhotoSelection(event.target.files); event.currentTarget.value = '';}} className="sr-only" /></label>
        {(existingPhotos.length > 0 || photos.length > 0) && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {existingPhotos.map((media) => <div key={media.id} className="relative overflow-hidden rounded-xl"><img src={media.url} alt={media.altText || 'Listing photo'} className="h-28 w-full object-cover" /><button type="button" disabled={busy} onClick={() => void removeExistingPhoto(media.id)} aria-label="Remove listing photo" className="absolute right-2 top-2 rounded-full bg-white/95 p-2 text-red-700 shadow disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></div>)}
          {photos.map((photo, index) => <div key={`${photo.name}-${photo.lastModified}-${index}`} className="relative overflow-hidden rounded-xl"><img src={previews[index]} alt={`Selected photo ${photo.name}`} className="h-28 w-full object-cover" /><button type="button" onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))} aria-label="Remove selected photo" className="absolute right-2 top-2 rounded-full bg-white/95 p-2 text-red-700 shadow"><Trash2 className="h-4 w-4" /></button><span className="block truncate px-2 py-1 text-[10px] text-slate-600">{photo.name}</span></div>)}
        </div>}
      </fieldset>
      {persisted && photos.length > 0 && <p role="status" className="rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900">Listing details are saved. If an upload fails, your selected photos remain here so you can retry.</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="rounded-xl bg-[#F4F2EE] px-5 py-3 text-sm font-bold text-[#475569]">Cancel</button>
        <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F05A4A] px-5 py-3 text-sm font-bold text-white hover:bg-[#df4d3d] disabled:opacity-60">{busy ? 'Saving…' : <><Check className="h-4 w-4" />{listing ? 'Save changes' : 'Publish listing'}</>}</button>
      </div>
    </form>
  </section>;
}
