import React, {useEffect, useState, type FormEvent} from 'react';
import {CheckCircle2, Eye, EyeOff, SlidersHorizontal, Sparkles} from 'lucide-react';
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
  discoveryEnabled: boolean;
  onUpdateDiscoveryEnabled: (enabled: boolean) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export const ProfileQuizView: React.FC<ProfileQuizViewProps> = ({
  userProfile,
  onUpdatePreferences,
  onUpdateDetails,
  discoveryEnabled,
  onUpdateDiscoveryEnabled,
  onChangePassword,
}) => {
  const [prefs, setPrefs] = useState<LifestylePreferences>(userProfile.preferences);
  const [details, setDetails] = useState(userProfile);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorNotice, setErrorNotice] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [discoveryBusy, setDiscoveryBusy] = useState(false);

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
      await onUpdateDetails({
        name: details.name, age: details.age, role: details.role, cityId: details.cityId,
        neighborhood: details.neighborhood, bio: details.bio,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 1800);
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : 'Could not save your profile.');
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword !== confirmPassword) {
      setPasswordError('The new password and confirmation do not match.');
      return;
    }
    setPasswordBusy(true);
    try {
      await onChangePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Password changed. Other signed-in sessions have been signed out.');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Could not change your password.');
    } finally {
      setPasswordBusy(false);
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
              Saved to your account. Discovery is opt-in and controlled by you.
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1E293B] mb-1">Age</label>
              <input
                type="number" min={18} max={100} value={details.age ?? ''}
                onChange={(e) => setDetails((prev) => ({...prev, age: e.target.value === '' ? null : Number(e.target.value)}))}
                className="w-full h-11 px-4 rounded-xl bg-[#F4F2EE] text-xs font-semibold text-[#1E293B] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#F05A4A]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1E293B] mb-1">Neighborhood</label>
              <input
                type="text" maxLength={100} value={details.neighborhood}
                onChange={(e) => setDetails((prev) => ({...prev, neighborhood: e.target.value}))}
                className="w-full h-11 px-4 rounded-xl bg-[#F4F2EE] text-xs font-semibold text-[#1E293B] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#F05A4A]/40"
                placeholder="e.g. Indiranagar"
              />
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

        <div className="rounded-2xl border border-slate-900/5 bg-[#FAF9F6] p-4">
          <div className="flex items-start justify-between gap-4"><div><h3 className="text-sm font-extrabold text-[#1E293B]">Roommate discovery</h3><p className="mt-1 max-w-sm text-xs leading-5 text-[#64748B]">{discoveryEnabled ? 'Your profile can be shown to opted-in members in your selected city.' : 'Your profile is private from roommate discovery until you turn this on.'}</p></div><button type="button" disabled={discoveryBusy} aria-pressed={discoveryEnabled} onClick={() => {setDiscoveryBusy(true); void onUpdateDiscoveryEnabled(!discoveryEnabled).catch((error: unknown) => setErrorNotice(error instanceof Error ? error.message : 'Could not update discovery settings.')).finally(() => setDiscoveryBusy(false));}} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold disabled:opacity-50 ${discoveryEnabled ? 'bg-emerald-100 text-emerald-900' : 'bg-[#1E293B] text-white'}`}>{discoveryEnabled ? <Eye className="h-3.5 w-3.5"/> : <EyeOff className="h-3.5 w-3.5"/>}{discoveryBusy ? 'Saving…' : discoveryEnabled ? 'Visible' : 'Enable'}</button></div>
          {errorNotice && <p role="alert" className="mt-2 text-xs text-red-700">{errorNotice}</p>}
        </div>

        <form onSubmit={(event) => void handleChangePassword(event)} className="space-y-3 border-t border-slate-900/5 pt-4">
          <div>
            <h3 className="text-sm font-extrabold text-[#1E293B]">Change password</h3>
            <p className="mt-1 text-xs leading-5 text-[#64748B]">Use a passphrase with at least 12 characters. Other devices will need to sign in again.</p>
          </div>
          <input aria-label="Current password" type="password" autoComplete="current-password" required maxLength={128} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className="h-11 w-full rounded-xl bg-[#F4F2EE] px-4 text-sm outline-none focus:ring-2 focus:ring-[#F05A4A]/40" />
          <input aria-label="New password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (12+ characters)" className="h-11 w-full rounded-xl bg-[#F4F2EE] px-4 text-sm outline-none focus:ring-2 focus:ring-[#F05A4A]/40" />
          <input aria-label="Confirm new password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="h-11 w-full rounded-xl bg-[#F4F2EE] px-4 text-sm outline-none focus:ring-2 focus:ring-[#F05A4A]/40" />
          {passwordError && <p role="alert" className="text-sm text-red-700">{passwordError}</p>}
          {passwordSuccess && <p role="status" className="text-sm text-emerald-700">{passwordSuccess}</p>}
          <button disabled={passwordBusy} className="w-full rounded-xl bg-[#F4F2EE] px-4 py-3 text-sm font-bold text-[#1E293B] hover:bg-[#EAE6DF] disabled:opacity-60">{passwordBusy ? 'Updating…' : 'Update password'}</button>
        </form>
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
