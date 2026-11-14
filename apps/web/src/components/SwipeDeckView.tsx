import React, {useState} from 'react';
import {
  motion,
  PanInfo,
  useMotionValue,
  useTransform,
} from 'motion/react';
import {
  CheckCircle2,
  Heart,
  Info,
  MapPin,
  Navigation,
  RotateCcw,
  Star,
  Users,
  X,
} from 'lucide-react';
import {
  CityTheme,
  LifestylePreferences,
  RoommateProfile,
  SwipeCategory,
} from '../types';
import {calculateCompatibility} from '../utils/compatibility';
import {ResilientImage} from './ResilientImage';

interface SwipeCardProps {
  profile: RoommateProfile;
  category: SwipeCategory;
  city: CityTheme;
  userPrefs: LifestylePreferences;
  isTop: boolean;
  onSwipe: (action: 'pass' | 'match' | 'super') => void;
  onOpenDetail: (profile: RoommateProfile) => void;
  onNavigate: (profile: RoommateProfile) => void;
}

const SwipeCard: React.FC<SwipeCardProps> = ({
  profile,
  category,
  city,
  userPrefs,
  isTop,
  onSwipe,
  onOpenDetail,
  onNavigate,
}) => {
  const [photoIdx, setPhotoIdx] = useState(0);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-14, 14]);
  const matchOpacity = useTransform(x, [40, 140], [0, 1]);
  const passOpacity = useTransform(x, [-140, -40], [1, 0]);
  const superOpacity = useTransform(y, [-140, -50], [1, 0]);

  const compat = calculateCompatibility(
    userPrefs,
    profile.preferences,
    profile.roomRent || profile.rentBudget
  );

  const displayPhotos =
    category === 'rooms' && profile.photos.length > 1
      ? [profile.photos[1], profile.photos[0]]
      : profile.photos;

  const activePhoto = displayPhotos[photoIdx] || profile.avatar;

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 110 || info.velocity.x > 500) {
      onSwipe('match');
    } else if (info.offset.x < -110 || info.velocity.x < -500) {
      onSwipe('pass');
    } else if (info.offset.y < -120 || info.velocity.y < -550) {
      onSwipe('super');
    }
  };

  return (
    <motion.div
      style={isTop ? {x, y, rotate} : undefined}
      drag={isTop}
      dragConstraints={{left: 0, right: 0, top: 0, bottom: 0}}
      dragElastic={0.85}
      onDragEnd={isTop ? handleDragEnd : undefined}
      initial={{scale: isTop ? 1 : 0.95, y: isTop ? 0 : 12, opacity: isTop ? 1 : 0.75}}
      animate={{scale: isTop ? 1 : 0.95, y: isTop ? 0 : 12, opacity: isTop ? 1 : 0.75}}
      exit={{opacity: 0, scale: 0.9, transition: {duration: 0.2}}}
      transition={{type: 'spring', stiffness: 320, damping: 28}}
      className={`absolute inset-0 bg-white rounded-[32px] p-3.5 shadow-kinship-2 border border-slate-900/5 flex flex-col ${
        isTop ? 'z-20 cursor-grab active:cursor-grabbing' : 'z-10 pointer-events-none'
      }`}
    >
      {/* Hero Media Frame (4:5 style ratio) */}
      <div className="relative flex-1 min-h-[320px] rounded-[22px] overflow-hidden bg-[#F4F2EE]">
        <ResilientImage
          src={activePhoto}
          alt={profile.name}
          fallbackTitle={profile.flatTitle || profile.name}
          className="w-full h-full object-cover select-none pointer-events-none"
        />

        {/* Photo switch tap areas */}
        {displayPhotos.length > 1 && (
          <div className="absolute inset-0 flex">
            <button
              type="button"
              aria-label="Previous image"
              onClick={(e) => {
                e.stopPropagation();
                setPhotoIdx((i) => (i - 1 + displayPhotos.length) % displayPhotos.length);
              }}
              className="w-1/2 h-full focus:outline-none"
            />
            <button
              type="button"
              aria-label="Next image"
              onClick={(e) => {
                e.stopPropagation();
                setPhotoIdx((i) => (i + 1) % displayPhotos.length);
              }}
              className="w-1/2 h-full focus:outline-none"
            />
          </div>
        )}

        {/* Top Photo Progress Dots */}
        {displayPhotos.length > 1 && (
          <div className="absolute top-3 inset-x-4 flex gap-1.5 pointer-events-none">
            {displayPhotos.map((_, idx) => (
              <div
                key={idx}
                className={`h-1 flex-1 rounded-full ${
                  idx === photoIdx ? 'bg-white' : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        )}

        {/* Top Trust & Compatibility Overlay */}
        <div className="absolute top-6 left-3.5 right-3.5 flex items-center justify-between gap-2 pointer-events-none">
          {profile.verifiedId ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/92 backdrop-blur-md text-[11px] font-bold text-[#006947] shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Verified ID</span>
            </span>
          ) : (
            <span />
          )}

          <span className="px-3 py-1 rounded-full bg-white/95 text-xs font-extrabold text-[#1E293B] border border-[#F05A4A]/40 shadow-sm tabular-nums">
            {compat.overallPercent}% Match
          </span>
        </div>

        {/* Drag Gesture Stamps */}
        {isTop && (
          <>
            <motion.div
              style={{opacity: matchOpacity}}
              className="absolute top-16 left-5 px-4 py-1.5 rounded-xl border-4 border-[#10B981] text-[#10B981] bg-white/90 font-extrabold text-xl tracking-wider -rotate-12 pointer-events-none"
            >
              MATCH
            </motion.div>
            <motion.div
              style={{opacity: passOpacity}}
              className="absolute top-16 right-5 px-4 py-1.5 rounded-xl border-4 border-[#F05A4A] text-[#F05A4A] bg-white/90 font-extrabold text-xl tracking-wider rotate-12 pointer-events-none"
            >
              PASS
            </motion.div>
            <motion.div
              style={{opacity: superOpacity}}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-xl border-4 border-[#E08738] text-[#E08738] bg-white/90 font-extrabold text-lg tracking-wider pointer-events-none"
            >
              SUPER CONNECT
            </motion.div>
          </>
        )}

        {/* Scrim & Primary Card Headline */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-4 pt-12 text-white">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              {category === 'rooms' && profile.flatTitle ? (
                <>
                  <h3 className="text-lg font-extrabold leading-snug line-clamp-1">
                    {profile.flatTitle}
                  </h3>
                  <p className="text-xs text-white/90 mt-0.5">
                    Hosted by {profile.name} · {profile.neighborhood}, {city.name}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-extrabold leading-tight">
                    {profile.name}, {profile.age}
                  </h3>
                  <p className="text-xs text-white/90 mt-0.5">
                    {profile.role} at {profile.company} · {profile.neighborhood}
                  </p>
                </>
              )}
            </div>

            <div className="text-right shrink-0">
              <div className="text-base font-extrabold tabular-nums">
                ₹{(profile.roomRent || profile.rentBudget).toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-white/80">per month</div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer Summary & Quick Actions */}
      <div className="pt-3 px-1.5 pb-1 flex flex-col gap-2.5">
        <p className="text-xs text-[#59413D] line-clamp-2 leading-relaxed">
          {profile.bio}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {compat.sharedHabits.slice(0, 3).map((habit) => (
              <span
                key={habit}
                className="px-2.5 py-1 rounded-full bg-[#F05A4A]/10 text-[#AD2A20] text-[11px] font-semibold"
              >
                {habit}
              </span>
            ))}
            {profile.roommatesCount && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#64748B] ml-1">
                <Users className="w-3 h-3" />
                {profile.roommatesCount}BHK
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onNavigate(profile)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#F4F2EE] hover:bg-[#EAE6DF] text-[11px] font-bold text-[#1E293B]"
            >
              <Navigation className="w-3 h-3 text-[#F05A4A]" />
              <span>Map</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenDetail(profile)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#F4F2EE] hover:bg-[#EAE6DF] text-[11px] font-bold text-[#1E293B]"
            >
              <Info className="w-3 h-3 text-[#1E293B]" />
              <span>Details</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface SwipeDeckViewProps {
  profiles: RoommateProfile[];
  city: CityTheme;
  userPrefs: LifestylePreferences;
  canUndo: boolean;
  onSwipe: (profileId: string, action: 'pass' | 'match' | 'super') => void;
  onUndo: () => void;
  onResetDeck: () => void;
  onOpenDetail: (profile: RoommateProfile) => void;
  onNavigate: (profile: RoommateProfile) => void;
}

export const SwipeDeckView: React.FC<SwipeDeckViewProps> = ({
  profiles,
  city,
  userPrefs,
  canUndo,
  onSwipe,
  onUndo,
  onResetDeck,
  onOpenDetail,
  onNavigate,
}) => {
  const [category, setCategory] = useState<SwipeCategory>('roommates');
  const topProfile = profiles[0];
  const nextProfile = profiles[1];

  return (
    <div className="flex flex-col items-center">
      {/* Roommates / Coliving Rooms Toggle */}
      <div className="w-full flex items-center justify-between gap-3 mb-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[#F4F2EE]">
          <button
            type="button"
            onClick={() => setCategory('roommates')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              category === 'roommates'
                ? 'bg-white text-[#1E293B] shadow-sm'
                : 'text-[#64748B] hover:text-[#1E293B]'
            }`}
          >
            Roommates
          </button>
          <button
            type="button"
            onClick={() => setCategory('rooms')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              category === 'rooms'
                ? 'bg-white text-[#1E293B] shadow-sm'
                : 'text-[#64748B] hover:text-[#1E293B]'
            }`}
          >
            Coliving Rooms
          </button>
        </div>

        <span className="text-xs font-semibold text-[#64748B] tabular-nums">
          {profiles.length} {profiles.length === 1 ? 'profile' : 'profiles'} in {city.name}
        </span>
      </div>

      {/* Card Deck Stage */}
      {topProfile ? (
        <>
          <div className="relative w-full max-w-[440px] h-[520px] sm:h-[550px]">
            {nextProfile && (
              <SwipeCard
                key={nextProfile.id}
                profile={nextProfile}
                category={category}
                city={city}
                userPrefs={userPrefs}
                isTop={false}
                onSwipe={() => undefined}
                onOpenDetail={onOpenDetail}
                onNavigate={onNavigate}
              />
            )}
            <SwipeCard
              key={topProfile.id}
              profile={topProfile}
              category={category}
              city={city}
              userPrefs={userPrefs}
              isTop={true}
              onSwipe={(action) => onSwipe(topProfile.id, action)}
              onOpenDetail={onOpenDetail}
              onNavigate={onNavigate}
            />
          </div>

          {/* Floating Swipe Trigger Buttons */}
          <div className="mt-5 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo last swipe"
              className="w-11 h-11 rounded-full bg-white shadow-kinship-2 border border-slate-900/5 flex items-center justify-center text-[#64748B] hover:text-[#1E293B] disabled:opacity-35 transition-transform active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onSwipe(topProfile.id, 'pass')}
              aria-label="Pass profile"
              className="w-14 h-14 rounded-full bg-white shadow-kinship-2 border border-slate-900/5 flex items-center justify-center text-[#1E293B] hover:bg-[#FAF9F6] transition-transform active:scale-95"
            >
              <X className="w-6 h-6" />
            </button>

            <button
              type="button"
              onClick={() => onSwipe(topProfile.id, 'super')}
              aria-label="Super connect"
              className="w-12 h-12 rounded-full bg-[#E08738] text-white shadow-kinship-2 flex items-center justify-center hover:bg-[#cf792d] transition-transform active:scale-95"
            >
              <Star className="w-5 h-5 fill-white" />
            </button>

            <button
              type="button"
              onClick={() => onSwipe(topProfile.id, 'match')}
              aria-label="Match profile"
              className="w-14 h-14 rounded-full bg-[#F05A4A] text-white shadow-kinship-dock flex items-center justify-center hover:bg-[#e14d3d] transition-transform active:scale-95"
            >
              <Heart className="w-6 h-6 fill-white" />
            </button>
          </div>
        </>
      ) : (
        <div className="w-full bg-white rounded-[32px] p-8 text-center shadow-kinship-1 border border-slate-900/5">
          <div className="w-12 h-12 rounded-full bg-[#FFF8F0] text-[#F05A4A] flex items-center justify-center mx-auto mb-3">
            <MapPin className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-[#1E293B]">
            You’ve seen everyone in {city.name}
          </h3>
          <p className="text-sm text-[#64748B] mt-1 max-w-sm mx-auto">
            Switch to another Indian metro city above or replay the deck to revisit passed flatmates.
          </p>
          <button
            type="button"
            onClick={onResetDeck}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F05A4A] text-white text-sm font-bold hover:bg-[#e04c3c]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Replay Deck</span>
          </button>
        </div>
      )}
    </div>
  );
};
