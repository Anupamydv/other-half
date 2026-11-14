import React from 'react';
import {
  Bookmark,
  Calendar,
  CheckCircle2,
  MessageCircle,
  Navigation,
  Star,
} from 'lucide-react';
import {CITY_THEMES} from '../data/indiaData';
import {
  BookedTour,
  FeedPost,
  LifestylePreferences,
  RoommateProfile,
} from '../types';
import {calculateCompatibility} from '../utils/compatibility';
import {ResilientImage} from './ResilientImage';

interface MatchesViewProps {
  profiles: RoommateProfile[];
  matchedIds: string[];
  superIds: string[];
  bookedTours: BookedTour[];
  savedPosts: FeedPost[];
  userPrefs: LifestylePreferences;
  onOpenChat: (profileId: string) => void;
  onOpenDetail: (profile: RoommateProfile) => void;
  onNavigateToProfile: (profile: RoommateProfile) => void;
  onNavigateToPost: (post: FeedPost) => void;
}

export const MatchesView: React.FC<MatchesViewProps> = ({
  profiles,
  matchedIds,
  superIds,
  bookedTours,
  savedPosts,
  userPrefs,
  onOpenChat,
  onOpenDetail,
  onNavigateToProfile,
  onNavigateToPost,
}) => {
  const matchedProfiles = profiles.filter((p) => matchedIds.includes(p.id));

  return (
    <div className="space-y-8">
      {/* Mutual Matches Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-extrabold text-[#1E293B] tracking-tight">
              Your Roommate Matches
            </h2>
            <p className="text-xs text-[#64748B]">
              Sorted by live compatibility with your lifestyle quiz
            </p>
          </div>
          <span className="text-xs font-bold text-[#1E293B] bg-[#F4F2EE] px-3 py-1 rounded-full tabular-nums">
            {matchedProfiles.length} matches
          </span>
        </div>

        {matchedProfiles.length === 0 ? (
          <div className="bg-white rounded-[28px] p-8 text-center shadow-kinship-1 border border-slate-900/5">
            <p className="text-sm font-bold text-[#1E293B]">No matches yet</p>
            <p className="text-xs text-[#64748B] mt-1">
              Double-tap posts in the feed or swipe right on roommates to start matching.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matchedProfiles.map((profile) => {
              const compat = calculateCompatibility(
                userPrefs,
                profile.preferences,
                profile.roomRent || profile.rentBudget
              );
              const isSuper = superIds.includes(profile.id);
              const city = CITY_THEMES[profile.cityId];

              return (
                <div
                  key={profile.id}
                  className="bg-white rounded-[28px] p-4 shadow-kinship-1 border border-slate-900/5 flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(profile)}
                      className="shrink-0"
                    >
                      <ResilientImage
                        src={profile.avatar}
                        alt={profile.name}
                        className="w-16 h-16 rounded-2xl object-cover bg-[#F4F2EE]"
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-bold text-[#1E293B] truncate">
                          {profile.name}, {profile.age}
                        </h3>
                        {profile.verifiedId && (
                          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                        )}
                        {isSuper && (
                          <Star className="w-4 h-4 text-[#E08738] fill-[#E08738] shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[#64748B] truncate">
                        {profile.neighborhood}, {city.name}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 text-xs font-bold tabular-nums">
                        <span className="text-[#006947] bg-[#10B981]/12 px-2 py-0.5 rounded-full">
                          {compat.overallPercent}% Match
                        </span>
                        <span className="text-[#1E293B]">
                          ₹{(profile.roomRent || profile.rentBudget).toLocaleString('en-IN')}/mo
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#59413D] line-clamp-2 leading-relaxed">
                    {profile.flatTitle || profile.bio}
                  </p>

                  <div className="mt-auto pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenChat(profile.id)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-full bg-[#F05A4A] text-white text-xs font-bold hover:bg-[#e04c3c]"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Message</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateToProfile(profile)}
                      className="inline-flex items-center justify-center gap-1 h-10 px-3.5 rounded-full bg-[#F4F2EE] text-xs font-bold text-[#1E293B] hover:bg-[#EAE6DF]"
                    >
                      <Navigation className="w-3.5 h-3.5 text-[#F05A4A]" />
                      <span>Map</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Scheduled House Tours */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-[#1E293B] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#F05A4A]" />
            <span>Scheduled House Tours</span>
          </h2>
          <span className="text-xs font-bold text-[#64748B] tabular-nums">
            {bookedTours.length} upcoming
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {bookedTours.map((tour) => {
            const linked = profiles.find((p) => p.id === tour.profileId);
            return (
              <div
                key={tour.id}
                className="bg-white rounded-[24px] p-4 shadow-kinship-1 border border-slate-900/5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#006947] bg-[#10B981]/12 px-2.5 py-0.5 rounded-full">
                      {tour.mode}
                    </span>
                    <span className="text-xs font-semibold text-[#64748B] tabular-nums">
                      {tour.date} · {tour.timeSlot}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[#1E293B] truncate mt-1.5">
                    {tour.flatTitle}
                  </p>
                  <p className="text-xs text-[#64748B] truncate">
                    {tour.neighborhood}, {CITY_THEMES[tour.cityId].name}
                  </p>
                </div>

                {linked && (
                  <button
                    type="button"
                    onClick={() => onNavigateToProfile(linked)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#FAF9F6] hover:bg-[#FFF8F0] border border-slate-900/10 text-xs font-bold text-[#1E293B] shrink-0"
                  >
                    <Navigation className="w-3.5 h-3.5 text-[#F05A4A]" />
                    <span>Route</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Saved Posts */}
      {savedPosts.length > 0 && (
        <section>
          <h2 className="text-lg font-extrabold text-[#1E293B] flex items-center gap-2 mb-4">
            <Bookmark className="w-4 h-4 text-[#E08738]" />
            <span>Saved Flat Posts</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {savedPosts.map((post) => (
              <div
                key={post.id}
                className="bg-white rounded-[24px] p-3.5 shadow-kinship-1 border border-slate-900/5 flex items-center gap-3"
              >
                <ResilientImage
                  src={post.media[0]?.url}
                  alt={post.flatTitle || post.neighborhood}
                  className="w-16 h-16 rounded-2xl object-cover shrink-0 bg-[#F4F2EE]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#1E293B] truncate">
                    {post.flatTitle || post.caption}
                  </p>
                  <p className="text-[11px] text-[#64748B] truncate mt-0.5">
                    {post.neighborhood}, {CITY_THEMES[post.cityId].name}
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigateToPost(post)}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#F05A4A] hover:underline"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Navigate on Map</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
