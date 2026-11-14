import React, {useMemo, useState} from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  Home,
  MapPin,
  Navigation,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
  X,
} from 'lucide-react';
import {CITY_THEMES} from '../data/indiaData';
import {LifestylePreferences, RoommateProfile} from '../types';
import {calculateCompatibility} from '../utils/compatibility';
import {ResilientImage} from './ResilientImage';

interface DetailAndTourModalProps {
  profile: RoommateProfile;
  userPrefs: LifestylePreferences;
  isMatched: boolean;
  onClose: () => void;
  onMatch: (profileId: string) => void;
  onNavigateToFlat: (profile: RoommateProfile) => void;
  onBookTour: (input: {
    profile: RoommateProfile;
    date: string;
    timeSlot: string;
    mode: 'In-Person' | 'Live Video Tour';
    note: string;
  }) => void;
}

export const DetailAndTourModal: React.FC<DetailAndTourModalProps> = ({
  profile,
  userPrefs,
  isMatched,
  onClose,
  onMatch,
  onNavigateToFlat,
  onBookTour,
}) => {
  const city = CITY_THEMES[profile.cityId];
  const compat = useMemo(
    () =>
      calculateCompatibility(
        userPrefs,
        profile.preferences,
        profile.roomRent || profile.rentBudget
      ),
    [userPrefs, profile]
  );

  // Split Rent Estimator state
  const [flatmatesCount, setFlatmatesCount] = useState(profile.roommatesCount || 2);
  const [includeCook, setIncludeCook] = useState(true);
  const [includeMaid, setIncludeMaid] = useState(true);
  const [includeWifi, setIncludeWifi] = useState(true);
  const [includeElectricity, setIncludeElectricity] = useState(true);

  // House Tour Booking state
  const [tourMode, setTourMode] = useState<'In-Person' | 'Live Video Tour'>('In-Person');
  const [tourDate, setTourDate] = useState('2026-11-18');
  const [tourSlot, setTourSlot] = useState('6:00 PM');
  const [tourNote, setTourNote] = useState('');
  const [tourBooked, setTourBooked] = useState(false);

  const baseRent = profile.roomRent || profile.rentBudget;
  const baseSplits = profile.utilitiesSplit || {
    cook: 2200,
    maid: 1300,
    wifi: 450,
    electricity: 900,
  };

  // Scale shared household bills relative to default roommate count
  const defaultCount = profile.roommatesCount || 2;
  const scaleFactor = defaultCount / flatmatesCount;
  const cookCost = includeCook ? Math.round(baseSplits.cook * scaleFactor) : 0;
  const maidCost = includeMaid ? Math.round(baseSplits.maid * scaleFactor) : 0;
  const wifiCost = includeWifi ? Math.round(baseSplits.wifi * scaleFactor) : 0;
  const elecCost = includeElectricity
    ? Math.round(baseSplits.electricity * scaleFactor)
    : 0;
  const totalMonthlyOutgo = baseRent + cookCost + maidCost + wifiCost + elecCost;

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    onBookTour({
      profile,
      date: tourDate,
      timeSlot: tourSlot,
      mode: tourMode,
      note: tourNote,
    });
    setTourBooked(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${profile.name} flat and compatibility details`}
    >
      <div className="bg-white w-full sm:max-w-2xl rounded-t-[32px] sm:rounded-[32px] shadow-kinship-3 max-h-[92vh] overflow-y-auto">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-900/5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-[#1E293B] truncate">
                {profile.name}, {profile.age}
              </h2>
              {profile.verifiedId && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#10B981]/12 text-[#006947] text-[11px] font-bold">
                  <ShieldCheck className="w-3 h-3" />
                  Verified
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748B] truncate">
              {profile.role} at {profile.company} · {profile.neighborhood}, {city.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="w-9 h-9 rounded-full bg-[#F4F2EE] flex items-center justify-center text-[#1E293B] hover:bg-[#EAE6DF] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Media Gallery */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profile.photos.map((photo, idx) => (
              <ResilientImage
                key={idx}
                src={photo}
                alt={`${profile.name} photo ${idx + 1}`}
                className="w-full h-52 rounded-2xl object-cover bg-[#F4F2EE]"
              />
            ))}
          </div>

          {/* Bio & Quick Action Buttons */}
          <div>
            <p className="text-sm text-[#1E293B] leading-relaxed">{profile.bio}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onNavigateToFlat(profile);
                  onClose();
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1E293B] text-white text-xs font-bold hover:bg-[#0f172a] transition-colors"
              >
                <Navigation className="w-3.5 h-3.5 text-[#F05A4A]" />
                <span>Navigate from My Location</span>
              </button>

              {!isMatched ? (
                <button
                  type="button"
                  onClick={() => onMatch(profile.id)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#F05A4A] text-white text-xs font-bold hover:bg-[#e04c3c] transition-colors"
                >
                  <Heart className="w-3.5 h-3.5 fill-white" />
                  <span>Match &amp; Say Hello</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#10B981]/12 text-[#006947] text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Connected in Matches</span>
                </span>
              )}
            </div>
          </div>

          {/* 6-Axis Compatibility Breakdown */}
          <section className="rounded-[24px] bg-[#FAF9F6] p-4 sm:p-5 border border-slate-900/5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#F05A4A]" />
                <h3 className="text-sm font-extrabold text-[#1E293B]">
                  6-Axis Compatibility Breakdown
                </h3>
              </div>
              <span className="text-sm font-extrabold text-[#006947] bg-[#10B981]/12 px-3 py-1 rounded-full tabular-nums">
                {compat.overallPercent}% Match
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {compat.axes.map((axis) => (
                <div
                  key={axis.key}
                  className="bg-white rounded-2xl p-3 border border-slate-900/5"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-[#1E293B]">{axis.label}</span>
                    <span
                      className={`font-bold tabular-nums ${
                        axis.matched ? 'text-[#006947]' : 'text-[#E08738]'
                      }`}
                    >
                      {axis.score}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#F4F2EE] overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full ${
                        axis.matched ? 'bg-[#10B981]' : 'bg-[#E08738]'
                      }`}
                      style={{width: `${axis.score}%`}}
                    />
                  </div>
                  <div className="text-[11px] text-[#64748B] flex items-center justify-between gap-2">
                    <span className="truncate">You: {axis.userValue}</span>
                    <span className="truncate font-semibold text-[#1E293B]">
                      {profile.name.split(' ')[0]}: {axis.otherValue}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Nearby Famous & New Places */}
          <section>
            <h3 className="text-sm font-extrabold text-[#1E293B] mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#F05A4A]" />
              <span>Nearby Landmarks &amp; Hangouts in {profile.neighborhood}</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {profile.nearbyHighlights.map((spot) => (
                <span
                  key={spot}
                  className="px-3 py-1.5 rounded-full bg-[#FFF8F0] border border-[#E08738]/20 text-xs font-semibold text-[#59413D]"
                >
                  {spot}
                </span>
              ))}
            </div>
          </section>

          {/* Interactive Split Rent & Household Expense Estimator */}
          <section className="rounded-[24px] bg-[#FAF9F6] p-4 sm:p-5 border border-slate-900/5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#1E293B]">
                  Split Rent &amp; Monthly Living Estimator (₹)
                </h3>
                <p className="text-xs text-[#64748B]">
                  {profile.flatTitle || `${profile.neighborhood} Flat`} · Deposit ₹
                  {(profile.deposit || baseRent * 2).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="inline-flex items-center gap-1 bg-white p-1 rounded-full border border-slate-900/5">
                {[2, 3, 4].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setFlatmatesCount(count)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${
                      flatmatesCount === count
                        ? 'bg-[#1E293B] text-white'
                        : 'text-[#64748B] hover:text-[#1E293B]'
                    }`}
                  >
                    <Users className="w-3 h-3" />
                    <span>{count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {[
                {
                  label: 'Cook',
                  cost: Math.round(baseSplits.cook * scaleFactor),
                  checked: includeCook,
                  toggle: () => setIncludeCook((v) => !v),
                },
                {
                  label: 'Maid',
                  cost: Math.round(baseSplits.maid * scaleFactor),
                  checked: includeMaid,
                  toggle: () => setIncludeMaid((v) => !v),
                },
                {
                  label: 'WiFi Fiber',
                  cost: Math.round(baseSplits.wifi * scaleFactor),
                  checked: includeWifi,
                  toggle: () => setIncludeWifi((v) => !v),
                },
                {
                  label: 'Power / Water',
                  cost: Math.round(baseSplits.electricity * scaleFactor),
                  checked: includeElectricity,
                  toggle: () => setIncludeElectricity((v) => !v),
                },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.toggle}
                  className={`text-left p-2.5 rounded-xl border transition-all ${
                    item.checked
                      ? 'bg-white border-[#10B981]/50 shadow-sm'
                      : 'bg-[#F4F2EE] border-transparent opacity-65'
                  }`}
                >
                  <div className="text-[11px] font-semibold text-[#64748B]">
                    {item.label}
                  </div>
                  <div className="text-xs font-extrabold text-[#1E293B] tabular-nums mt-0.5">
                    ₹{item.cost.toLocaleString('en-IN')}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 border border-slate-900/5">
              <div>
                <div className="text-xs font-semibold text-[#64748B]">
                  Estimated All-In Monthly Share (per person)
                </div>
                <div className="text-[11px] text-[#59413D] tabular-nums">
                  Room ₹{baseRent.toLocaleString('en-IN')} + Shared Expenses ₹
                  {(totalMonthlyOutgo - baseRent).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="text-xl font-extrabold text-[#F05A4A] tabular-nums">
                ₹{totalMonthlyOutgo.toLocaleString('en-IN')}
              </div>
            </div>
          </section>

          {/* House Tour Booking Form */}
          <section className="rounded-[24px] bg-[#FFF8F0] p-4 sm:p-5 border border-[#F05A4A]/15">
            <h3 className="text-sm font-extrabold text-[#1E293B] mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#F05A4A]" />
              <span>Book a House Tour</span>
            </h3>

            {tourBooked ? (
              <div className="bg-white rounded-2xl p-4 border border-[#10B981]/30 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#006947]">
                    Tour Confirmed for {tourDate} at {tourSlot}
                  </p>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Sent {tourMode} invite to {profile.name} in Messages &amp; saved to Matches.
                  </p>
                </div>
                <CheckCircle2 className="w-6 h-6 text-[#10B981] shrink-0" />
              </div>
            ) : (
              <form onSubmit={handleBook} className="space-y-3">
                <div className="flex gap-2">
                  {(
                    [
                      {id: 'In-Person', icon: Home},
                      {id: 'Live Video Tour', icon: Video},
                    ] as const
                  ).map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTourMode(opt.id)}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-full text-xs font-bold transition-colors ${
                          tourMode === opt.id
                            ? 'bg-[#1E293B] text-white'
                            : 'bg-white text-[#1E293B] border border-slate-900/10'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{opt.id}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#59413D] mb-1">
                      Preferred Date
                    </label>
                    <input
                      type="date"
                      value={tourDate}
                      onChange={(e) => setTourDate(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-white text-xs font-semibold text-[#1E293B] border border-slate-900/10 focus:outline-none focus:ring-2 focus:ring-[#F05A4A]/40"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-[#59413D] mb-1">
                      Time Slot
                    </label>
                    <div className="relative">
                      <Clock className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <select
                        value={tourSlot}
                        onChange={(e) => setTourSlot(e.target.value)}
                        className="w-full h-10 pl-8 pr-3 rounded-xl bg-white text-xs font-semibold text-[#1E293B] border border-slate-900/10 focus:outline-none focus:ring-2 focus:ring-[#F05A4A]/40"
                      >
                        <option value="11:00 AM">11:00 AM (Morning Sun)</option>
                        <option value="2:30 PM">2:30 PM (Afternoon)</option>
                        <option value="6:00 PM">6:00 PM (Post-Work)</option>
                        <option value="7:30 PM">7:30 PM (Evening)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <input
                  type="text"
                  value={tourNote}
                  onChange={(e) => setTourNote(e.target.value)}
                  placeholder="Optional note (e.g., bringing bike for parking check)"
                  className="w-full h-10 px-3.5 rounded-xl bg-white text-xs text-[#1E293B] placeholder-[#64748B] border border-slate-900/10 focus:outline-none focus:ring-2 focus:ring-[#F05A4A]/40"
                />

                <button
                  type="submit"
                  className="w-full h-11 rounded-full bg-[#F05A4A] text-white text-xs font-bold hover:bg-[#e04c3c] transition-all active:scale-[0.98]"
                >
                  Confirm {tourMode} with {profile.name.split(' ')[0]}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
