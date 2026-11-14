import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  CITY_THEMES,
  DEFAULT_USER_PROFILE,
  INITIAL_CONVERSATIONS,
  INITIAL_FEED_POSTS,
  INITIAL_MATCHED_IDS,
  INITIAL_PROFILES,
  INITIAL_SUPER_IDS,
  INITIAL_TOURS,
} from '../data/indiaData';
import {
  BookedTour,
  ChatMessage,
  CityId,
  Conversation,
  FeedPost,
  LifestylePreferences,
  MediaAsset,
  RoommateProfile,
  UserSelfProfile,
} from '../types';
import {loadMediaBlobUrl, saveMediaBlob} from '../utils/mediaDb';

const STORAGE_KEY = 'other_half_app_state_v1';

interface PersistedState {
  selectedCity: CityId;
  selectedNeighborhood: string;
  userProfile: UserSelfProfile;
  feedPosts: FeedPost[];
  passedIds: string[];
  matchedIds: string[];
  superIds: string[];
  conversations: Record<string, Conversation>;
  bookedTours: BookedTour[];
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      return {
        selectedCity: parsed.selectedCity || 'bengaluru',
        selectedNeighborhood: parsed.selectedNeighborhood || 'All Areas',
        userProfile: parsed.userProfile || DEFAULT_USER_PROFILE,
        feedPosts: parsed.feedPosts && parsed.feedPosts.length > 0 ? parsed.feedPosts : INITIAL_FEED_POSTS,
        passedIds: parsed.passedIds || [],
        matchedIds: parsed.matchedIds || INITIAL_MATCHED_IDS,
        superIds: parsed.superIds || INITIAL_SUPER_IDS,
        conversations: parsed.conversations || INITIAL_CONVERSATIONS,
        bookedTours: parsed.bookedTours || INITIAL_TOURS,
      };
    }
  } catch (err) {
    console.warn('Failed to parse persisted state:', err);
  }

  return {
    selectedCity: 'bengaluru',
    selectedNeighborhood: 'All Areas',
    userProfile: DEFAULT_USER_PROFILE,
    feedPosts: INITIAL_FEED_POSTS,
    passedIds: [],
    matchedIds: INITIAL_MATCHED_IDS,
    superIds: INITIAL_SUPER_IDS,
    conversations: INITIAL_CONVERSATIONS,
    bookedTours: INITIAL_TOURS,
  };
}

export function useOtherHalfState() {
  const [state, setState] = useState<PersistedState>(loadInitialState);
  const [profiles] = useState<RoommateProfile[]>(INITIAL_PROFILES);
  const [swipeHistory, setSwipeHistory] = useState<
    Array<{profileId: string; action: 'pass' | 'match' | 'super'}>
  >([]);
  const [celebrationProfile, setCelebrationProfile] = useState<RoommateProfile | null>(null);

  // Persist state to localStorage (strip volatile blob URLs if storedBlobKey exists)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to save state to localStorage:', err);
    }
  }, [state]);

  // Rehydrate user-uploaded media blobs from IndexedDB after reload
  useEffect(() => {
    let active = true;
    const rehydrate = async () => {
      const postsToHydrate = state.feedPosts.filter((p) =>
        p.media.some((m) => Boolean(m.storedBlobKey))
      );
      if (postsToHydrate.length === 0) return;

      const updated = await Promise.all(
        state.feedPosts.map(async (post) => {
          const hasBlob = post.media.some((m) => Boolean(m.storedBlobKey));
          if (!hasBlob) return post;
          const hydratedMedia = await Promise.all(
            post.media.map(async (item) => {
              if (!item.storedBlobKey) return item;
              const freshUrl = await loadMediaBlobUrl(item.storedBlobKey);
              return freshUrl ? {...item, url: freshUrl} : item;
            })
          );
          return {...post, media: hydratedMedia};
        })
      );

      if (active) {
        setState((prev) => ({...prev, feedPosts: updated}));
      }
    };
    rehydrate();
    return () => {
      active = false;
    };
    // Run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentCityTheme = useMemo(
    () => CITY_THEMES[state.selectedCity],
    [state.selectedCity]
  );

  const setSelectedCity = useCallback((cityId: CityId) => {
    setState((prev) => ({
      ...prev,
      selectedCity: cityId,
      selectedNeighborhood: 'All Areas',
    }));
  }, []);

  const setSelectedNeighborhood = useCallback((neighborhood: string) => {
    setState((prev) => ({...prev, selectedNeighborhood: neighborhood}));
  }, []);

  const toggleLikePost = useCallback((postId: string, forceLike?: boolean) => {
    setState((prev) => ({
      ...prev,
      feedPosts: prev.feedPosts.map((post) => {
        if (post.id !== postId) return post;
        const nextLiked = forceLike !== undefined ? forceLike : !post.likedByMe;
        if (nextLiked === post.likedByMe) return post;
        return {
          ...post,
          likedByMe: nextLiked,
          likes: nextLiked ? post.likes + 1 : Math.max(0, post.likes - 1),
        };
      }),
    }));
  }, []);

  const toggleSavePost = useCallback((postId: string) => {
    setState((prev) => ({
      ...prev,
      feedPosts: prev.feedPosts.map((post) =>
        post.id === postId ? {...post, savedByMe: !post.savedByMe} : post
      ),
    }));
  }, []);

  const addCommentToPost = useCallback((postId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      feedPosts: prev.feedPosts.map((post) => {
        if (post.id !== postId) return post;
        return {
          ...post,
          comments: [
            ...post.comments,
            {
              id: `c-${Date.now()}`,
              authorName: prev.userProfile.name,
              text: trimmed,
              createdAt: 'Just now',
            },
          ],
        };
      }),
    }));
  }, []);

  const createFeedPost = useCallback(
    async (input: {
      cityId: CityId;
      neighborhood: string;
      postType: 'Room Available' | 'Looking for Flatmate' | 'City Reel';
      caption: string;
      rentPerMonth?: number;
      flatTitle?: string;
      flatPosition: {lat: number; lng: number};
      tags: string[];
      files: Array<{file: File; kind: 'image' | 'video'}>;
    }) => {
      const mediaAssets: MediaAsset[] = [];
      for (let i = 0; i < input.files.length; i++) {
        const entry = input.files[i];
        const blobKey = `blob_${Date.now()}_${i}`;
        await saveMediaBlob(blobKey, entry.file);
        const objectUrl = URL.createObjectURL(entry.file);
        mediaAssets.push({
          id: `media_${Date.now()}_${i}`,
          kind: entry.kind,
          url: objectUrl,
          storedBlobKey: blobKey,
        });
      }

      const newPost: FeedPost = {
        id: `post-user-${Date.now()}`,
        authorId: 'self',
        authorName: state.userProfile.name,
        authorRole: `${state.userProfile.role} · ${input.neighborhood}`,
        authorAvatar: state.feedPosts[0]?.authorAvatar || '',
        verified: true,
        cityId: input.cityId,
        neighborhood: input.neighborhood,
        postType: input.postType,
        caption: input.caption.trim(),
        media: mediaAssets,
        isWalkthroughReel: mediaAssets.some((m) => m.kind === 'video'),
        likes: 1,
        likedByMe: true,
        savedByMe: false,
        comments: [],
        createdAt: 'Just now',
        rentPerMonth: input.rentPerMonth,
        flatTitle: input.flatTitle || `${input.neighborhood} Flat Share`,
        flatPosition: input.flatPosition,
        tags: input.tags,
      };

      setState((prev) => ({
        ...prev,
        selectedCity: input.cityId,
        selectedNeighborhood: 'All Areas',
        feedPosts: [newPost, ...prev.feedPosts],
      }));
      return newPost;
    },
    [state.userProfile.name, state.userProfile.role, state.feedPosts]
  );

  const handleSwipeAction = useCallback(
    (profileId: string, action: 'pass' | 'match' | 'super') => {
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile) return;

      setSwipeHistory((prev) => [...prev, {profileId, action}]);

      setState((prev) => {
        if (action === 'pass') {
          return {
            ...prev,
            passedIds: prev.passedIds.includes(profileId)
              ? prev.passedIds
              : [...prev.passedIds, profileId],
          };
        }

        const nextMatched = prev.matchedIds.includes(profileId)
          ? prev.matchedIds
          : [...prev.matchedIds, profileId];
        const nextSuper =
          action === 'super' && !prev.superIds.includes(profileId)
            ? [...prev.superIds, profileId]
            : prev.superIds;

        const nextConvos = {...prev.conversations};
        if (!nextConvos[profileId]) {
          nextConvos[profileId] = {
            profileId,
            unread: true,
            messages: [
              {
                id: `sys-${Date.now()}`,
                sender: 'system',
                text: `You matched with ${profile.name} in ${profile.neighborhood}. Say hello or plan a flat tour!`,
                timestamp: 'Just now',
              },
            ],
          };
        }

        return {
          ...prev,
          matchedIds: nextMatched,
          superIds: nextSuper,
          conversations: nextConvos,
        };
      });

      if (action !== 'pass' && (profile.mutualInterest || action === 'super')) {
        setCelebrationProfile(profile);
      }
    },
    [profiles]
  );

  const undoLastSwipe = useCallback(() => {
    const last = swipeHistory[swipeHistory.length - 1];
    if (!last) return;
    setSwipeHistory((prev) => prev.slice(0, -1));
    setState((prev) => ({
      ...prev,
      passedIds: prev.passedIds.filter((id) => id !== last.profileId),
      matchedIds: prev.matchedIds.filter((id) => id !== last.profileId),
      superIds: prev.superIds.filter((id) => id !== last.profileId),
    }));
  }, [swipeHistory]);

  const resetSwipeDeck = useCallback(() => {
    setSwipeHistory([]);
    setState((prev) => ({
      ...prev,
      passedIds: [],
    }));
  }, []);

  const sendMessage = useCallback(
    (profileId: string, text: string, tourCard?: ChatMessage['tourCard']) => {
      const trimmed = text.trim();
      if (!trimmed && !tourCard) return;

      const timeLabel = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const outgoing: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'me',
        text: trimmed,
        timestamp: timeLabel,
        tourCard,
      };

      setState((prev) => {
        const existing = prev.conversations[profileId] || {
          profileId,
          unread: false,
          messages: [],
        };
        return {
          ...prev,
          conversations: {
            ...prev.conversations,
            [profileId]: {
              ...existing,
              unread: false,
              messages: [...existing.messages, outgoing],
            },
          },
        };
      });

    },
    []
  );

  const markConversationRead = useCallback((profileId: string) => {
    setState((prev) => {
      const convo = prev.conversations[profileId];
      if (!convo || !convo.unread) return prev;
      return {
        ...prev,
        conversations: {
          ...prev.conversations,
          [profileId]: {...convo, unread: false},
        },
      };
    });
  }, []);

  const bookHouseTour = useCallback(
    (input: {
      profile: RoommateProfile;
      date: string;
      timeSlot: string;
      mode: 'In-Person' | 'Live Video Tour';
      note: string;
    }) => {
      const newTour: BookedTour = {
        id: `tour-${Date.now()}`,
        profileId: input.profile.id,
        flatTitle: input.profile.flatTitle || `${input.profile.neighborhood} Flat`,
        neighborhood: input.profile.neighborhood,
        cityId: input.profile.cityId,
        position: input.profile.flatPosition,
        date: input.date,
        timeSlot: input.timeSlot,
        mode: input.mode,
        note: input.note.trim(),
        createdAt: 'Confirmed',
      };

      setState((prev) => ({
        ...prev,
        bookedTours: [newTour, ...prev.bookedTours],
      }));

      sendMessage(
        input.profile.id,
        `Booked a ${input.mode} for ${input.date} at ${input.timeSlot}. ${
          input.note.trim() ? `Note: ${input.note.trim()}` : ''
        }`,
        {
          date: input.date,
          timeSlot: input.timeSlot,
          mode: input.mode,
          location: input.profile.flatAddress || input.profile.neighborhood,
        }
      );

      return newTour;
    },
    [sendMessage]
  );

  const updateUserPreferences = useCallback((prefs: LifestylePreferences) => {
    setState((prev) => ({
      ...prev,
      userProfile: {
        ...prev.userProfile,
        quizCompleted: true,
        preferences: prefs,
      },
    }));
  }, []);

  const updateUserProfileDetails = useCallback(
    (updates: Partial<Omit<UserSelfProfile, 'preferences'>>) => {
      setState((prev) => ({
        ...prev,
        userProfile: {...prev.userProfile, ...updates},
      }));
    },
    []
  );

  const unreadMessagesCount = useMemo(
    () =>
      Object.values(state.conversations).filter((convo) => convo.unread).length,
    [state.conversations]
  );

  return {
    selectedCity: state.selectedCity,
    selectedNeighborhood: state.selectedNeighborhood,
    currentCityTheme,
    userProfile: state.userProfile,
    profiles,
    feedPosts: state.feedPosts,
    passedIds: state.passedIds,
    matchedIds: state.matchedIds,
    superIds: state.superIds,
    conversations: state.conversations,
    bookedTours: state.bookedTours,
    unreadMessagesCount,
    canUndoSwipe: swipeHistory.length > 0,
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
  };
}
