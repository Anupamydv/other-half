import React, {Suspense, lazy, useCallback, useEffect, useMemo, useState} from 'react';
import {
  Compass,
  CalendarCheck,
  Heart,
  House,
  Map as MapIcon,
  MessageCircle,
  Plus,
  User,
  LogOut,
} from 'lucide-react';
import {CityLandmarkStrip} from './components/CityLandmarkStrip';
import {ApiStatus} from './components/ApiStatus';
import {NotificationBell} from './components/NotificationBell';
import {AuthScreen} from './components/AuthScreen';
import {CITY_THEMES} from './data/indiaData';
import {useOtherHalfState} from './hooks/useOtherHalfState';
import {ApiRequestError, apiRequest, getCurrentAccount, type AccountResponse} from './services/api';
import {
  AppTab,
  CityId,
  ExploreMode,
  LandmarkPlace,
  RoommateProfile,
} from './types';

const GoogleMapsNavigator = lazy(() =>
  import('./components/GoogleMapsNavigator').then((module) => ({default: module.GoogleMapsNavigator}))
);
const FeedView = lazy(() =>
  import('./components/FeedView').then((module) => ({default: module.FeedView}))
);
const DiscoveryView = lazy(() =>
  import('./components/DiscoveryView').then((module) => ({default: module.DiscoveryView}))
);
const RealMatchesView = lazy(() =>
  import('./components/RealMatchesView').then((module) => ({default: module.RealMatchesView}))
);
const ConversationsView = lazy(() =>
  import('./components/ConversationsView').then((module) => ({default: module.ConversationsView}))
);
const ProfileQuizView = lazy(() =>
  import('./components/ProfileQuizView').then((module) => ({default: module.ProfileQuizView}))
);
const ProfileSafetySettings = lazy(() =>
  import('./components/ProfileSafetySettings').then((module) => ({default: module.ProfileSafetySettings}))
);
const ModeratorQueueView = lazy(() =>
  import('./components/ModeratorQueueView').then((module) => ({default: module.ModeratorQueueView}))
);
const ListingsView = lazy(() =>
  import('./components/ListingsView').then((module) => ({default: module.ListingsView}))
);
const ToursView = lazy(() =>
  import('./components/ToursView').then((module) => ({default: module.ToursView}))
);
const DetailAndTourModal = lazy(() =>
  import('./components/DetailAndTourModal').then((module) => ({default: module.DetailAndTourModal}))
);

export default function App() {
  const {
    selectedCity,
    selectedNeighborhood,
    currentCityTheme,
    userProfile,
    profiles,
    setSelectedCity,
    setSelectedNeighborhood,
    bookHouseTour,
    updateUserPreferences,
    updateUserProfileDetails,
  } = useOtherHalfState();

  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'loading' | 'authenticated' | 'anonymous' | 'unavailable'>('loading');
  const [sessionMessage, setSessionMessage] = useState('');

  const acceptAccount = useCallback((next: AccountResponse) => {
    setAccount(next);
    setSessionStatus('authenticated');
    setSessionMessage('');
    setSelectedCity(next.profile.cityId);
    updateUserProfileDetails({
      name: next.profile.displayName,
      age: next.profile.age,
      role: next.profile.role ?? '',
      cityId: next.profile.cityId,
      neighborhood: next.profile.neighborhood ?? 'All Areas',
      bio: next.profile.bio,
    });
    updateUserPreferences(next.profile.preferences);
  }, [setSelectedCity, updateUserProfileDetails, updateUserPreferences]);

  const loadSession = useCallback(async (signal?: AbortSignal) => {
    setSessionStatus('loading');
    try {
      acceptAccount(await getCurrentAccount(signal));
    } catch (error) {
      if (signal?.aborted) return;
      setAccount(null);
      if (error instanceof ApiRequestError && error.status === 401) {
        setSessionStatus('anonymous');
        setSessionMessage('');
      } else {
        setSessionStatus('unavailable');
        setSessionMessage(error instanceof Error ? error.message : 'Could not reach the account service.');
      }
    }
  }, [acceptAccount]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSession(controller.signal);
    return () => controller.abort();
  }, [loadSession]);

  const handleSignOut = async () => {
    try {
      await apiRequest<void>('/auth/logout', {method: 'POST'});
      setAccount(null);
      setSessionStatus('anonymous');
      setActiveTab('explore');
    } catch (error) {
      setSessionMessage(error instanceof Error ? error.message : 'Could not sign out. Please retry.');
    }
  };

  const saveProfileDetails = async (updates: Partial<Omit<import('./types').UserSelfProfile, 'preferences'>>) => {
    const payload = {
      ...(updates.name !== undefined ? {displayName: updates.name} : {}),
      ...(updates.role !== undefined ? {role: updates.role} : {}),
      ...(updates.age !== undefined ? {age: updates.age} : {}),
      ...(updates.cityId !== undefined ? {cityId: updates.cityId} : {}),
      ...(updates.neighborhood !== undefined ? {neighborhood: updates.neighborhood} : {}),
      ...(updates.bio !== undefined ? {bio: updates.bio} : {}),
    };
    const result = await apiRequest<{profile: AccountResponse['profile']}>('/profile/me', {
      method: 'PATCH', body: JSON.stringify(payload),
    });
    updateUserProfileDetails(updates);
    if (updates.cityId) setSelectedCity(updates.cityId);
    if (account) setAccount({...account, profile: result.profile});
  };

  const savePreferences = async (preferences: AccountResponse['profile']['preferences']) => {
    const result = await apiRequest<{profile: AccountResponse['profile']}>('/profile/me', {
      method: 'PATCH', body: JSON.stringify({preferences}),
    });
    updateUserPreferences(result.profile.preferences);
    if (account) setAccount({...account, profile: result.profile});
  };

  const saveDiscoveryEnabled = async (discoveryEnabled: boolean) => {
    const result = await apiRequest<{profile: AccountResponse['profile']}>('/profile/me', {
      method: 'PATCH', body: JSON.stringify({discoveryEnabled}),
    });
    if (account) setAccount({...account, profile: result.profile});
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await apiRequest<void>('/auth/password', {
      method: 'POST', body: JSON.stringify({currentPassword, newPassword}),
    });
  };

  const [activeTab, setActiveTab] = useState<AppTab>('explore');
  const [exploreMode, setExploreMode] = useState<ExploreMode>('feed');
  const [selectedFlatId, setSelectedFlatId] = useState<string | null>(null);
  const [focusedLandmark, setFocusedLandmark] = useState<LandmarkPlace | null>(null);
  const [detailProfile, setDetailProfile] = useState<RoommateProfile | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [interactionNotice, setInteractionNotice] = useState('');
  // Filtered city flats/profiles
  const cityProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (p.cityId !== selectedCity) return false;
      if (
        selectedNeighborhood !== 'All Areas' &&
        p.neighborhood !== selectedNeighborhood
      ) {
        return false;
      }
      return true;
    });
  }, [profiles, selectedCity, selectedNeighborhood]);

  // Ensure selectedFlatId stays synced to current city
  useEffect(() => {
    if (
      !selectedFlatId ||
      !cityProfiles.some((f) => f.id === selectedFlatId)
    ) {
      setSelectedFlatId(cityProfiles[0]?.id || null);
    }
    setFocusedLandmark(null);
  }, [cityProfiles, selectedFlatId]);

  const handleNavigateToProfile = (profile: RoommateProfile) => {
    setSelectedCity(profile.cityId);
    setSelectedNeighborhood('All Areas');
    setSelectedFlatId(profile.id);
    setFocusedLandmark(null);
    if (window.innerWidth < 1024 || activeTab !== 'explore') {
      setActiveTab('map');
    }
  };

  const handleFocusLandmark = (landmark: LandmarkPlace) => {
    setFocusedLandmark(landmark);
    if (window.innerWidth < 1024) {
      setActiveTab('map');
    }
  };

  const handleOpenTourConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setActiveTab('messages');
  };

  if (sessionStatus === 'loading') {
    return <main className="min-h-screen flex items-center justify-center text-sm font-semibold text-[#64748B]">Connecting to your account…</main>;
  }
  if (sessionStatus === 'unavailable') {
    return <main className="min-h-screen flex items-center justify-center px-4"><section className="max-w-md rounded-3xl bg-white p-7 text-center shadow-kinship-2"><h1 className="text-xl font-extrabold">Account service unavailable</h1><p className="mt-2 text-sm text-[#64748B]">{sessionMessage}</p><button onClick={() => void loadSession()} className="mt-5 rounded-xl bg-[#1E293B] px-5 py-3 text-sm font-bold text-white">Try again</button></section></main>;
  }
  if (!account || sessionStatus !== 'authenticated') {
    return <AuthScreen onAuthenticated={acceptAccount} />;
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#1E293B] pb-24 md:pb-12">
      {/* Clean 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-[#FAF9F6]/90 backdrop-blur-md border-b border-slate-900/5">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-10 h-14 md:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('explore')}
            className="text-xl md:text-2xl font-extrabold tracking-tight text-[#1E293B] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Other Half
          </button>

          {/* Zone 2: Desktop Navigation Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#64748B]"
          >
            {(
              [
                {id: 'explore', label: 'Explore'},
                {id: 'listings', label: 'Homes'},
                {id: 'map', label: 'Live Map'},
                {id: 'tours', label: 'Tours'},
                {id: 'matches', label: 'Matches'},
                {
                  id: 'messages',
                  label: 'Messages',
                },
                {id: 'profile', label: 'Profile & Quiz'},
              ] as const
            ).map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-[#F05A4A] border-[#F05A4A]'
                      : 'border-transparent hover:text-[#1E293B]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <NotificationBell onOpenTours={() => setActiveTab('tours')} />
            <ApiStatus />
            <span className="hidden lg:inline max-w-36 truncate px-3 text-xs font-semibold text-[#64748B]" title={account.user.email}>{account.user.email}</span>
            <button type="button" onClick={() => void handleSignOut()} aria-label="Sign out" title="Sign out" className="mr-2 rounded-full p-2 text-[#64748B] hover:bg-[#F4F2EE] hover:text-[#1E293B]"><LogOut className="h-4 w-4" /></button>
            <button
              type="button"
              onClick={() => setActiveTab('listings')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F05A4A] text-white text-xs sm:text-sm font-bold hover:bg-[#df4d3d] shadow-sm transition-all active:scale-[0.98] whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>List a Home</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-3 max-w-[1240px] px-4 sm:px-6 lg:px-10">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs leading-5 text-amber-900">
          Homes, Tours, Messages, and roommate discovery use saved API data. Community feed and map cards are sample content.
        </p>
        {interactionNotice && <div role="status" className="mt-2 flex items-start justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs leading-5 text-sky-900"><span>{interactionNotice}</span><button aria-label="Dismiss" onClick={() => setInteractionNotice('')} className="font-bold">×</button></div>}
      </div>

      {/* Main Content Canvas */}
      <main className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-10 pt-5 space-y-5">
        {/* City Theme Switcher & Explore Mode Toolbar (Explore & Map tabs) */}
        {(activeTab === 'explore' || activeTab === 'map' || activeTab === 'listings') && (
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Indian Metro City Switcher */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {(Object.keys(CITY_THEMES) as CityId[]).map((cityKey) => {
                  const c = CITY_THEMES[cityKey];
                  const active = selectedCity === cityKey;
                  return (
                    <button
                      key={cityKey}
                      type="button"
                      onClick={() => setSelectedCity(cityKey)}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#1E293B] text-white shadow-sm'
                          : 'bg-white text-[#1E293B] border border-slate-900/5 hover:bg-[#F4F2EE]'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>

              {/* Feed / Swipe Deck Switch */}
              {activeTab === 'explore' && (
                <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[#F4F2EE] shrink-0">
                  <button
                    type="button"
                    onClick={() => setExploreMode('feed')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                      exploreMode === 'feed'
                        ? 'bg-white text-[#1E293B] shadow-sm'
                        : 'text-[#64748B] hover:text-[#1E293B]'
                    }`}
                  >
                    Community Feed
                  </button>
                  <button
                    type="button"
                    onClick={() => setExploreMode('swipe')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                      exploreMode === 'swipe'
                        ? 'bg-white text-[#1E293B] shadow-sm'
                        : 'text-[#64748B] hover:text-[#1E293B]'
                    }`}
                  >
                    Find Roommates
                  </button>
                </div>
              )}
            </div>

            {/* Locality Filter Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {currentCityTheme.neighborhoods.map((area) => {
                const active = selectedNeighborhood === area;
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setSelectedNeighborhood(area)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#F05A4A]/12 text-[#AD2A20]'
                        : 'bg-[#F4F2EE] text-[#64748B] hover:text-[#1E293B]'
                    }`}
                  >
                    {area}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* EXPLORE TAB */}
        {activeTab === 'explore' && (
          <div className="space-y-5">
            <CityLandmarkStrip
              city={currentCityTheme}
              onFocusLandmark={handleFocusLandmark}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7">
                {exploreMode === 'feed' ? (
                  <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-center text-sm text-[#64748B]">Loading community feed…</div>}>
                    <FeedView
                      city={currentCityTheme}
                      cityId={selectedCity}
                      neighborhood={selectedNeighborhood}
                      userId={account.user.id}
                    />
                  </Suspense>
                ) : (
                  <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-center text-sm text-[#64748B]">Loading roommate discovery…</div>}>
                    <DiscoveryView cityId={selectedCity} userPrefs={userProfile.preferences}
                      onOpenProfileSettings={() => setActiveTab('profile')}
                      onOpenConversation={handleOpenTourConversation} />
                  </Suspense>
                )}
              </div>

              {/* Desktop Companion Live Google Maps Navigation */}
              <aside className="hidden lg:block lg:col-span-5 lg:sticky lg:top-20">
                <Suspense fallback={<div className="h-[360px] rounded-2xl bg-white animate-pulse" aria-label="Loading map" />}>
                  <GoogleMapsNavigator
                    city={currentCityTheme}
                    flats={cityProfiles}
                    selectedFlatId={selectedFlatId}
                    onSelectFlat={(flat) => setSelectedFlatId(flat.id)}
                    onOpenFlatDetail={(flat) => setDetailProfile(flat)}
                    focusedLandmark={focusedLandmark}
                    compact
                  />
                </Suspense>
              </aside>
            </div>
          </div>
        )}

        {/* FULL MAP TAB */}
        {activeTab === 'map' && (
          <div className="space-y-5">
            <CityLandmarkStrip
              city={currentCityTheme}
              onFocusLandmark={handleFocusLandmark}
            />
            <Suspense fallback={<div className="h-[440px] rounded-2xl bg-white animate-pulse" aria-label="Loading map" />}>
              <GoogleMapsNavigator
                city={currentCityTheme}
                flats={cityProfiles}
                selectedFlatId={selectedFlatId}
                onSelectFlat={(flat) => setSelectedFlatId(flat.id)}
                onOpenFlatDetail={(flat) => setDetailProfile(flat)}
                focusedLandmark={focusedLandmark}
              />
            </Suspense>
          </div>
        )}

        {activeTab === 'listings' && (
          <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-center text-sm text-[#64748B]">Loading homes…</div>}>
            <ListingsView cityId={selectedCity} neighborhood={selectedNeighborhood} userId={account.user.id} />
          </Suspense>
        )}

        {activeTab === 'tours' && (
          <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-center text-sm text-[#64748B]">Loading visit requests…</div>}>
            <ToursView onOpenConversation={handleOpenTourConversation} />
          </Suspense>
        )}

        {/* MATCHES TAB */}
        {activeTab === 'matches' && (
          <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-center text-sm text-[#64748B]">Loading matches…</div>}>
            <RealMatchesView userPrefs={userProfile.preferences} onOpenConversation={handleOpenTourConversation} />
          </Suspense>
        )}

        {/* MESSAGES TAB */}
        {activeTab === 'messages' && (
          <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-center text-sm text-[#64748B]">Loading conversations…</div>}>
            <ConversationsView userId={account.user.id} initialConversationId={activeConversationId} />
          </Suspense>
        )}

        {/* PROFILE & QUIZ TAB */}
        {activeTab === 'profile' && (
          <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-center text-sm text-[#64748B]">Loading your profile…</div>}>
            <ProfileQuizView
              userProfile={userProfile}
              onUpdatePreferences={savePreferences}
              onUpdateDetails={saveProfileDetails}
              discoveryEnabled={account.profile.discoveryEnabled}
              onUpdateDiscoveryEnabled={saveDiscoveryEnabled}
              onChangePassword={changePassword}
            />
          </Suspense>
        )}
        {activeTab === 'profile' && <Suspense fallback={null}><ProfileSafetySettings />{account.user.isModerator && <ModeratorQueueView />}</Suspense>}
      </main>

      {/* Mobile Floating Navigation Dock (< 15% Viewport Height) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-3 left-3 right-3 z-40 h-14 rounded-full bg-white/94 backdrop-blur-md border border-white/60 shadow-kinship-dock px-2 grid grid-cols-7 items-center"
      >
        {(
          [
            {id: 'explore', label: 'Explore', icon: Compass},
            {id: 'listings', label: 'Homes', icon: House},
            {id: 'map', label: 'Map', icon: MapIcon},
            {id: 'tours', label: 'Tours', icon: CalendarCheck},
            {id: 'matches', label: 'Matches', icon: Heart},
            {id: 'messages', label: 'Chats', icon: MessageCircle},
            {id: 'profile', label: 'Profile', icon: User},
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-col items-center justify-center h-11 rounded-full transition-colors ${
                active
                  ? 'bg-[#F05A4A]/12 text-[#F05A4A]'
                  : 'text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-bold mt-0.5 leading-none">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Roommate / Flat Detail, Split Rent & Tour Booking Modal */}
      {detailProfile && (
        <Suspense fallback={null}>
          <DetailAndTourModal
            profile={detailProfile}
            userPrefs={userProfile.preferences}
            isMatched={false}
            bookingDisabled
            onClose={() => setDetailProfile(null)}
            onMatch={() => setInteractionNotice('This map profile is sample content. Use Find Roommates to connect with real members.')}
            onNavigateToFlat={handleNavigateToProfile}
            onBookTour={bookHouseTour}
          />
        </Suspense>
      )}

    </div>
  );
}
