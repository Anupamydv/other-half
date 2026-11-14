import {useState, type FormEvent} from 'react';
import {CalendarDays, X} from 'lucide-react';
import {isTourSlotAvailable, type ListingDto, type TourTimeSlot} from '@other-half/contracts';
import {createTourRequest} from '../services/tours';

const TIME_SLOTS: Array<{id: TourTimeSlot; label: string}> = [
  {id: 'MORNING', label: 'Morning · 9 AM–12 PM'},
  {id: 'AFTERNOON', label: 'Afternoon · 12–4 PM'},
  {id: 'EVENING', label: 'Evening · 4–7 PM'},
];

export function TourRequestForm({listing, onClose, onSent}: {
  listing: ListingDto; onClose: () => void; onSent: () => void;
}) {
  const [scheduledDate, setScheduledDate] = useState(listing.availableFrom > new Date().toISOString().slice(0, 10)
    ? listing.availableFrom
    : new Date().toISOString().slice(0, 10));
  const [timeSlot, setTimeSlot] = useState<TourTimeSlot>('AFTERNOON');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const currentSlots = TIME_SLOTS.filter((slot) => isTourSlotAvailable(scheduledDate, slot.id));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const selectedSlot = currentSlots.some((slot) => slot.id === timeSlot) ? timeSlot : currentSlots[0]?.id;
    if (!selectedSlot) {
      setError('No visit windows remain today. Choose a future date.');
      return;
    }
    setBusy(true);
    try {
      await createTourRequest(listing.id, {scheduledDate, timeSlot: selectedSlot, note});
      onSent();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send your visit request.');
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => {if (event.target === event.currentTarget) onClose();}}>
    <section role="dialog" aria-modal="true" aria-labelledby="tour-request-title" className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-kinship-3 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#F05A4A]">Visit request</p><h2 id="tour-request-title" className="mt-1 text-xl font-extrabold text-[#1E293B]">{listing.title}</h2><p className="mt-1 text-xs text-[#64748B]">{listing.neighborhood}</p></div>
        <button type="button" onClick={onClose} aria-label="Close visit request" className="rounded-full p-2 text-[#64748B] hover:bg-[#F4F2EE]"><X className="h-4 w-4" /></button>
      </div>
      <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900">Choose a preferred visit window. The owner will confirm or decline it. The app only shares neighborhood-level location; exchange exact meeting details separately after agreeing to a visit.</p>
      <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
        <label className="block text-xs font-bold text-[#1E293B]">Preferred date
          <span className="relative mt-1.5 block"><CalendarDays className="absolute left-3 top-3.5 h-4 w-4 text-[#64748B]" /><input type="date" required min={listing.availableFrom > new Date().toISOString().slice(0, 10) ? listing.availableFrom : new Date().toISOString().slice(0, 10)} value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} className="h-11 w-full rounded-xl bg-[#F4F2EE] pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#F05A4A]/40" /></span>
        </label>
        <label className="block text-xs font-bold text-[#1E293B]">Time window
          <select value={currentSlots.some((slot) => slot.id === timeSlot) ? timeSlot : currentSlots[0]?.id ?? ''} onChange={(event) => setTimeSlot(event.target.value as TourTimeSlot)} className="mt-1.5 h-11 w-full rounded-xl bg-[#F4F2EE] px-3 text-sm outline-none focus:ring-2 focus:ring-[#F05A4A]/40">{currentSlots.map((slot) => <option key={slot.id} value={slot.id}>{slot.label}</option>)}</select>
        </label>
        <label className="block text-xs font-bold text-[#1E293B]">Note to the owner <span className="font-medium text-[#64748B]">(optional)</span>
          <textarea maxLength={500} rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Share anything useful for arranging the visit. Don't include phone numbers or private information." className="mt-1.5 w-full rounded-xl bg-[#F4F2EE] p-3 text-sm leading-5 outline-none focus:ring-2 focus:ring-[#F05A4A]/40" />
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl bg-[#F4F2EE] px-5 py-3 text-sm font-bold text-[#475569]">Cancel</button><button disabled={busy} className="rounded-xl bg-[#F05A4A] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Sending…' : 'Send visit request'}</button></div>
      </form>
    </section>
  </div>;
}
