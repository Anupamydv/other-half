import React, {useEffect, useState} from 'react';
import {CheckCircle2, RotateCcw, SlidersHorizontal, Sparkles} from 'lucide-react';
import {CITY_THEMES} from '../data/indiaData';
import {
  CityId,
  CleanlinessHabit,
  KitchenHabit,
  LifestylePreferences,
  SleepHabit,
  SocialHabit,
  UserSelfProfile,
  WorkHabit,
} from '../types';

interface ProfileQuizViewProps {
  userProfile: UserSelfProfile;
  onUpdatePreferences: (prefs: LifestylePreferences) => void | Promise<void>;
  onUpdateDetails: (updates: Partial<Omit<UserSelfProfile, 'preferences'>>) => void | Promise<void>;
  onResetSwipeDeck: () => void;
}

export const ProfileQuizView: React.FC<ProfileQuizViewProps> = ({
  userProfile,
  onUpdatePreferences,
  onUpdateDetails,
  onResetSwipeDeck,
}) => {
  const [prefs, setPrefs] = useState<LifestylePreferences>(userProfile.preferences);
  const [details, setDetails] = useState(userProfile);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorNotice, setErrorNotice] = useState('');

  useEffect(() => {
    setPrefs(userProfile.preferences);
    setDetails(userProfile);
  }, [userProfile]);

  const handleSaveQuiz = async (next: LifestylePreferences) => {
    setErrorNotice('');
    try {
      await onUpdatePreferences(next);
      setPrefs(next);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 1800);
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : 'Could not save your answers.');
    }
  };

  const handleSaveDetails = async () => {
    setErrorNotice('');
    try {
      await onUpdateDetails({name: details.name, role: details.role, cityId: details.cityId, bio: details.bio});
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 1800);
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : 'Could not save your profile.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Personal Profile Card */}
      <div className="lg:col-span-5 bg-white rounded-[28px] p-5 sm:p-6 shadow-kinship-1 border border-slate-900/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-[#1E293B]">Your Profile</h2>
            <p className="text-xs text-[#64748B]">
              Saved to your account. Public discovery is not active yet.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#10B981]/12 text-[#006947] text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Account active
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-[#1E293B] mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={details.name}
              onChange={(e) => setDetails((prev) => ({...prev, name: e.target.value}))}
              className="w-full h-11 px-4 rounded-xl bg-[#F4F2EE] text-sm font-semibold text-[#1E293B] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#F05A4A]/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1E293B] mb-1">
                Role
              </label>
              <input
                type="text"
                value={details.role}
                onChange={(e) => setDetails((prev) => ({...prev, role: e.target.value}))}
                className="w-full h-11 px-4 rounded-xl bg-[#F4F2EE] text-xs font-semibold text-[#1E293B] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#F05A4A]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1E293B] mb-1">
                Home City
              </label>
              <select
                value={details.cityId}
                onChange={(e) => setDetails((prev) => ({...prev, cityId: e.target.value as CityId}))}
                className="w-full h-11 px-3 rounded-xl bg-[#F4F2EE] text-xs font-semibold text-[#1E293B] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#F05A4A]/40"
              >
                {Object.values(CITY_THEMES).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1E293B] mb-1">
              About You
            </label>
            <textarea
              rows={3}
              value={details.bio}
              onChange={(e) => setDetails((prev) => ({...prev, bio: e.target.value}))}
              className="w-full p-3.5 rounded-2xl bg-[#F4F2EE] text-xs text-[#1E293B] leading-relaxed focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#F05A4A]/40"
            />
          </div>
        </div>

        <button type="button" onClick={() => void handleSaveDetails()} className="w-full rounded-xl bg-[#1E293B] px-4 py-3 text-sm font-bold text-white hover:bg-[#334155]">Save profile</button>

        <div className="pt-2 border-t border-slate-900/5 flex items-center justify-between gap-3">
          <span className="text-xs text-[#64748B]">Want to revisit passed cards?</span>
          <button
            type="button"
            onClick={onResetSwipeDeck}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#F4F2EE] hover:bg-[#EAE6DF] text-xs font-bold text-[#1E293B]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Swipe Deck</span>
          </button>
        </div>
      </div>

      {/* Right: Interactive 6-Axis Lifestyle Compatibility Quiz */}
      <div className="lg:col-span-7 bg-white rounded-[28px] p-5 sm:p-6 shadow-kinship-1 border border-slate-900/5 space-y-5">
        {errorNotice && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{errorNotice}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-[#1E293B] flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#F05A4A]" />
              <span>Lifestyle Compatibility Quiz</span>
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Your answers are saved to your account. Compatibility scores are preview-only.
            </p>
          </div>
          {savedNotice && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#10B981]/12 text-[#006947] text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              Answers Saved
            </span>
          )}
        </div>

        {/* 1. Sleep */}
        <div>
          <p className="text-xs font-bold text-[#1E293B] mb-2">1. Sleep Schedule</p>
          <div className="flex flex-wrap gap-2">
            {(['Early Bird', 'Balanced', 'Night Owl'] as SleepHabit[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleSaveQuiz({...prefs, sleep: opt})}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  prefs.sleep === opt
                    ? 'bg-[#F05A4A] text-white'
                    : 'bg-[#F4F2EE] text-[#1E293B] hover:bg-[#EAE6DF]'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Kitchen & Food */}
        <div>
          <p className="text-xs font-bold text-[#1E293B] mb-2">
            2. Kitchen &amp; Dietary Preference
          </p>
          <div className="flex flex-wrap gap-2">
            {(['Pure Veg', 'Eggetarian', 'Non-Veg Friendly'] as KitchenHabit[]).map(
              (opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSaveQuiz({...prefs, kitchen: opt})}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                    prefs.kitchen === opt
                      ? 'bg-[#F05A4A] text-white'
                      : 'bg-[#F4F2EE] text-[#1E293B] hover:bg-[#EAE6DF]'
                  }`}
                >
                  {opt}
                </button>
              )
            )}
          </div>
        </div>

        {/* 3. Work Rhythm */}
        <div>
          <p className="text-xs font-bold text-[#1E293B] mb-2">3. Work / Study Setup</p>
          <div className="flex flex-wrap gap-2">
            {(['WFH Mostly', 'Hybrid', 'Office Daily'] as WorkHabit[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleSaveQuiz({...prefs, work: opt})}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  prefs.work === opt
                    ? 'bg-[#F05A4A] text-white'
                    : 'bg-[#F4F2EE] text-[#1E293B] hover:bg-[#EAE6DF]'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Cleanliness */}
        <div>
          <p className="text-xs font-bold text-[#1E293B] mb-2">4. Cleanliness Standard</p>
          <div className="flex flex-wrap gap-2">
            {(['Neat Freak', 'Tidy', 'Relaxed'] as CleanlinessHabit[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleSaveQuiz({...prefs, cleanliness: opt})}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  prefs.cleanliness === opt
                    ? 'bg-[#F05A4A] text-white'
                    : 'bg-[#F4F2EE] text-[#1E293B] hover:bg-[#EAE6DF]'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* 5. Social Battery */}
        <div>
          <p className="text-xs font-bold text-[#1E293B] mb-2">5. Social Battery at Home</p>
          <div className="flex flex-wrap gap-2">
            {(['Quiet Sanctuary', 'Balanced', 'Social Host'] as SocialHabit[]).map(
              (opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSaveQuiz({...prefs, social: opt})}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                    prefs.social === opt
                      ? 'bg-[#F05A4A] text-white'
                      : 'bg-[#F4F2EE] text-[#1E293B] hover:bg-[#EAE6DF]'
                  }`}
                >
                  {opt}
                </button>
              )
            )}
          </div>
        </div>

        {/* 6. Monthly Budget Slider + Toggles */}
        <div className="pt-2 border-t border-slate-900/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#1E293B]">
              6. Max Monthly Room Budget
            </span>
            <span className="text-sm font-extrabold text-[#F05A4A] tabular-nums">
              ₹{prefs.maxBudget.toLocaleString('en-IN')}/mo
            </span>
          </div>
          <input
            type="range"
            min={14000}
            max={45000}
            step={1000}
            value={prefs.maxBudget}
            onChange={(e) =>
              handleSaveQuiz({...prefs, maxBudget: Number(e.target.value)})
            }
            className="w-full accent-[#F05A4A]"
          />

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                handleSaveQuiz({...prefs, petFriendly: !prefs.petFriendly})
              }
              className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                prefs.petFriendly
                  ? 'bg-[#10B981]/15 text-[#006947] border border-[#10B981]/30'
                  : 'bg-[#F4F2EE] text-[#64748B]'
              }`}
            >
              Pet Friendly: {prefs.petFriendly ? 'Yes' : 'No'}
            </button>
            <button
              type="button"
              onClick={() => handleSaveQuiz({...prefs, nonSmoker: !prefs.nonSmoker})}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-colors ${
                prefs.nonSmoker
                  ? 'bg-[#10B981]/15 text-[#006947] border border-[#10B981]/30'
                  : 'bg-[#F4F2EE] text-[#64748B]'
              }`}
            >
              Non-Smoking Flat: {prefs.nonSmoker ? 'Preferred' : 'Flexible'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
