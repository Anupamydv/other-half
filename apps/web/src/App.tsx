import React, {Suspense, lazy, useCallback, useEffect, useMemo, useState} from 'react';
import {
  Compass,
  Heart,
  Map as MapIcon,
  MessageCircle,
  Plus,
  User,
  LogOut,
} from 'lucide-react';
import {CityLandmarkStrip} from './components/CityLandmarkStrip';
import {ApiStatus} from './components/ApiStatus';
import {AuthScreen} from './components/AuthScreen';
import {CITY_THEMES} from './data/indiaData';
import {useOtherHalfState} from './hooks/useOtherHalfState';
import {ApiRequestError, apiRequest, getCurrentAccount, type AccountResponse} from './services/api';
import {
  AppTab,
  CityId,
  ExploreMode,
  FeedPost,
  LandmarkPlace,
  RoommateProfile,
} from './types';

const GoogleMapsNavigator = lazy(() =>
  import('./components/GoogleMapsNavigator').then((module) => ({default: module.GoogleMapsNavigator}))
);
const FeedView = lazy(() =>
  import('./components/FeedView').then((module) => ({default: module.FeedView}))
);
const SwipeDeckView = lazy(() =>
  import('./components/SwipeDeckView').then((module) => ({default: module.SwipeDeckView}))
);
const MatchesView = lazy(() =>
  import('./components/MatchesView').then((module) => ({default: module.MatchesView}))
);
const MessagesView = lazy(() =>
  import('./components/MessagesView').then((module) => ({default: module.MessagesView}))
);
const ProfileQuizView = lazy(() =>
  import('./components/ProfileQuizView').then((module) => ({default: module.ProfileQuizView}))
);
const CreatePostModal = lazy(() =>
  import('./components/CreatePostModal').then((module) => ({default: module.CreatePostModal}))
);
const DetailAndTourModal = lazy(() =>
  import('./components/DetailAndTourModal').then((module) => ({default: module.DetailAndTourModal}))
);
const MatchCelebrationModal = lazy(() =>
  import('./components/MatchCelebrationModal').then((module) => ({default: module.MatchCelebrationModal}))
);

export default function App() {
  const {
    selectedCity,
    selectedNeighborhood,
    currentCityTheme,
    userProfile,
    profiles,
    feedPosts,
    passedIds,
    matchedIds,
    superIds,
    conversations,
    bookedTours,
    unreadMessagesCount,
    canUndoSwipe,
    celebrationProfile,
    setCelebrationProfile,
    setSelectedCity,
    setSelectedNeighborhood,
    toggleLikePost,
    toggleSavePost,
    addCommentToPost,
    createFeedPost,
    handleSwipeAction,
    undoLastSwipe,
    resetSwipeDeck,
    sendMessage,
    markConversationRead,
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
      age: next.profile.age ?? 0,
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
      ...(updates.cityId !== undefined ? {cityId: updates.cityId} : {}),
      ...(updates.neighborhood !== undefined ? {neighborhood: updates.neighborhood} : {}),
      ...(updates.bio !== undefined ? {bio: updates.bio} : {}),
    };
    const result = await apiRequest<{profile: AccountResponse['profile']}>('/profile/me', {
      method: 'PATCH', body: JSON.stringify(payload),
    });
    updateUserProfileDetails(updates);
    if (account) setAccount({...account, profile: result.profile});
  };

  const savePreferences = async (preferences: AccountResponse['profile']['preferences']) => {
    const result = await apiRequest<{profile: AccountResponse['profile']}>('/profile/me', {
      method: 'PATCH', body: JSON.stringify({preferences}),
    });
    updateUserPreferences(result.profile.preferences);
    if (account) setAccount({...account, profile: result.profile});
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

  const [activeTab, setActiveTab] = useState<AppTab>('explore');
  const [exploreMode, setExploreMode] = useState<ExploreMode>('feed');
  const [selectedFlatId, setSelectedFlatId] = useState<string | null>(null);
  const [focusedLandmark, setFocusedLandmark] = useState<LandmarkPlace | null>(null);
  const [detailProfile, setDetailProfile] = useState<RoommateProfile | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [activeChatProfileId, setActiveChatProfileId] = useState<string | null>(null);
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

  const swipeDeckProfiles = useMemo(
    () =>
      cityProfiles.filter(
        (p) => !passedIds.includes(p.id) && !matchedIds.includes(p.id)
      ),
    [cityProfiles, passedIds, matchedIds]
  );

  const cityPosts = useMemo(() => {
    return feedPosts.filter((post) => {
      if (post.cityId !== selectedCity) return false;
      if (
        selectedNeighborhood !== 'All Areas' &&
        post.neighborhood !== selectedNeighborhood
      ) {
        return false;
      }
      return true;
    });
  }, [feedPosts, selectedCity, selectedNeighborhood]);

  const savedPosts = useMemo(
    () => feedPosts.filter((p) => p.savedByMe),
    [feedPosts]
  );

  const handleNavigateToProfile = (profile: RoommateProfile) => {
    setSelectedCity(profile.cityId);
    setSelectedNeighborhood('All Areas');
    setSelectedFlatId(profile.id);
    setFocusedLandmark(null);
    if (window.innerWidth < 1024 || activeTab !== 'explore') {
      setActiveTab('map');
    }
  };

  const handleNavigateToPost = (post: FeedPost) => {
    setSelectedCity(post.cityId);
    setSelectedNeighborhood('All Areas');
    if (post.linkedProfileId) {
      setSelectedFlatId(post.linkedProfileId);
    }
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

  const handleOpenChat = (profileId: string) => {
    setActiveChatProfileId(profileId);
    markConversationRead(profileId);
    setActiveTab('messages');
  };

  const handleSendIcebreaker = (profileId: string, text: string) => {
    sendMessage(profileId, text);
    setCelebrationProfile(null);
    setActiveChatProfileId(profileId);
    setActiveTab('messages');
  };

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
                {id: 'map', label: 'Live Map'},
                {id: 'matches', label: `Matches (${matchedIds.length})`},
                {
                  id: 'messages',
                  label:
                    unreadMessagesCount > 0
                      ? `Messages (${unreadMessagesCount})`
                      : 'Messages',
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
            <ApiStatus />
            <span className="hidden lg:inline max-w-36 truncate px-3 text-xs font-semibold text-[#64748B]" title={account.user.email}>{account.user.email}</span>
            <button type="button" onClick={() => void handleSignOut()} aria-label="Sign out" title="Sign out" className="mr-2 rounded-full p-2 text-[#64748B] hover:bg-[#F4F2EE] hover:text-[#1E293B]"><LogOut className="h-4 w-4" /></button>
            <button
              type="button"
              onClick={() => setShowCreatePost(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F05A4A] text-white text-xs sm:text-sm font-bold hover:bg-[#df4d3d] shadow-sm transition-all active:scale-[0.98] whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Post Flat / Reel</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-3 max-w-[1240px] px-4 sm:px-6 lg:px-10">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs leading-5 text-amber-900">
          Preview content: listings, roommate cards, matches, and chats are sample data. Your account and profile edits are saved; live discovery features are coming in later milestones.
        </p>
      </div>

      {/* Main Content Canvas */}
      <main className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-10 pt-5 space-y-5">
        {/* City Theme Switcher & Explore Mode Toolbar (Explore & Map tabs) */}
        {(activeTab === 'explore' || activeTab === 'map') && (
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
                    Scroll Feed
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
                    Swipe Deck
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
                      posts={cityPosts}
                      city={currentCityTheme}
                      profiles={profiles}
                      matchedIds={matchedIds}
                      userPrefs={userProfile.preferences}
                      onToggleLike={toggleLikePost}
                      onToggleSave={toggleSavePost}
                      onAddComment={addCommentToPost}
                      onNavigateToFlat={handleNavigateToPost}
                      onOpenDetail={(prof) => setDetailProfile(prof)}
                      onQuickMatch={(id) => handleSwipeAction(id, 'match')}
                      onOpenCreatePost={() => setShowCreatePost(true)}
                    />
                  </Suspense>
                ) : (
                  <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-center text-sm text-[#64748B]">Loading roommate discovery…</div>}>
                    <SwipeDeckView
                      profiles={swipeDeckProfiles}
                      city={currentCityTheme}
                      userPrefs={userProfile.preferences}
                      canUndo={canUndoSwipe}
                      onSwipe={handleSwipeAction}
                      onUndo={undoLastSwipe}
                      onResetDeck={resetSwipeDeck}
                      onOpenDetail={(prof) => setDetailProfile(prof)}
                      onNavigate={handleNavigateToProfile}
                    />
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

        {/* MATCHES TAB */}
        {activeTab === 'matches' && (
          <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-center text-sm text-[#64748B]">Loading matches…</div>}>
            <MatchesView
              profiles={profiles}
              matchedIds={matchedIds}
              superIds={superIds}
              bookedTours={bookedTours}
              savedPosts={savedPosts}
              userPrefs={userProfile.preferences}
              onOpenChat={handleOpenChat}
              onOpenDetail={(prof) => setDetailProfile(prof)}
              onNavigateToProfile={handleNavigateToProfile}
              onNavigateToPost={handleNavigateToPost}
            />
          </Suspense>
        )}

        {/* MESSAGES TAB */}
        {activeTab === 'messages' && (
          <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-center text-sm text-[#64748B]">Loading conversations…</div>}>
            <MessagesView
              profiles={profiles}
              matchedIds={matchedIds}
              conversations={conversations}
              activeProfileId={activeChatProfileId}
              onSelectConversation={(id) => {
                setActiveChatProfileId(id);
                markConversationRead(id);
              }}
              onSendMessage={(id, text) => sendMessage(id, text)}
              onOpenDetail={(prof) => setDetailProfile(prof)}
              onNavigateToProfile={handleNavigateToProfile}
            />
          </Suspense>
        )}

        {/* PROFILE & QUIZ TAB */}
        {activeTab === 'profile' && (
          <Suspense fallback={<div className="rounded-3xl bg-white p-8 text-center text-sm text-[#64748B]">Loading your profile…</div>}>
            <ProfileQuizView
              userProfile={userProfile}
              onUpdatePreferences={savePreferences}
              onUpdateDetails={saveProfileDetails}
              onResetSwipeDeck={resetSwipeDeck}
            />
          </Suspense>
        )}
      </main>

      {/* Mobile Floating Navigation Dock (< 15% Viewport Height) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-3 left-3 right-3 z-40 h-14 rounded-full bg-white/94 backdrop-blur-md border border-white/60 shadow-kinship-dock px-2 grid grid-cols-5 items-center"
      >
        {(
          [
            {id: 'explore', label: 'Explore', icon: Compass},
            {id: 'map', label: 'Map', icon: MapIcon},
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
              {tab.id === 'messages' && unreadMessagesCount > 0 && (
                <span className="absolute top-1.5 right-4 w-2 h-2 rounded-full bg-[#F05A4A]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Create Post Modal */}
      {showCreatePost && (
        <Suspense fallback={null}>
          <CreatePostModal
            defaultCity={selectedCity}
            onClose={() => setShowCreatePost(false)}
            onPublish={async (input) => {
              await createFeedPost(input);
              setActiveTab('explore');
              setExploreMode('feed');
            }}
          />
        </Suspense>
      )}

      {/* Roommate / Flat Detail, Split Rent & Tour Booking Modal */}
      {detailProfile && (
        <Suspense fallback={null}>
          <DetailAndTourModal
            profile={detailProfile}
            userPrefs={userProfile.preferences}
            isMatched={matchedIds.includes(detailProfile.id)}
            onClose={() => setDetailProfile(null)}
            onMatch={(id) => handleSwipeAction(id, 'match')}
            onNavigateToFlat={handleNavigateToProfile}
            onBookTour={bookHouseTour}
          />
        </Suspense>
      )}

      {/* Match Celebration Modal */}
      {celebrationProfile && (
        <Suspense fallback={null}>
          <MatchCelebrationModal
            profile={celebrationProfile}
            userPrefs={userProfile.preferences}
            onClose={() => setCelebrationProfile(null)}
            onSendIcebreaker={handleSendIcebreaker}
          />
        </Suspense>
      )}
    </div>
  );
}
