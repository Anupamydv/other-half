import React, {useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Film,
  Heart,
  MessageCircle,
  Navigation,
  Pause,
  Play,
  Plus,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  CityTheme,
  FeedPost,
  LifestylePreferences,
  RoommateProfile,
} from '../types';
import {calculateCompatibility} from '../utils/compatibility';
import {ResilientImage} from './ResilientImage';

interface FeedPostCardProps {
  post: FeedPost;
  city: CityTheme;
  userPrefs: LifestylePreferences;
  linkedProfile?: RoommateProfile;
  isMatched: boolean;
  onToggleLike: (postId: string, forceLike?: boolean) => void;
  onToggleSave: (postId: string) => void;
  onAddComment: (postId: string, text: string) => void;
  onNavigateToFlat: (post: FeedPost) => void;
  onOpenDetail: (profile: RoommateProfile) => void;
  onQuickMatch: (profileId: string) => void;
}

const FeedPostCard: React.FC<FeedPostCardProps> = ({
  post,
  city,
  userPrefs,
  linkedProfile,
  isMatched,
  onToggleLike,
  onToggleSave,
  onAddComment,
  onNavigateToFlat,
  onOpenDetail,
  onQuickMatch,
}) => {
  const [mediaIndex, setMediaIndex] = useState(0);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [reelPlaying, setReelPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastTapRef = useRef<number>(0);

  const currentMedia = post.media[mediaIndex] || post.media[0];
  const isVideoAsset = currentMedia?.kind === 'video';

  // Auto-advance reel preview smoothly when isWalkthroughReel and multiple images exist
  useEffect(() => {
    if (!post.isWalkthroughReel || isVideoAsset || !reelPlaying || post.media.length <= 1) {
      return;
    }
    const timer = setInterval(() => {
      setMediaIndex((prev) => (prev + 1) % post.media.length);
    }, 3600);
    return () => clearInterval(timer);
  }, [post.isWalkthroughReel, isVideoAsset, reelPlaying, post.media.length]);

  const compat = linkedProfile
    ? calculateCompatibility(
        userPrefs,
        linkedProfile.preferences,
        linkedProfile.roomRent || linkedProfile.rentBudget
      )
    : null;

  const handleMediaTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      onToggleLike(post.id, true);
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 750);
    } else if (isVideoAsset && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => undefined);
        setReelPlaying(true);
      } else {
        videoRef.current.pause();
        setReelPlaying(false);
      }
    }
    lastTapRef.current = now;
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(post.id, commentText);
    setCommentText('');
  };

  return (
    <article className="bg-white rounded-[28px] overflow-hidden shadow-kinship-1 border border-slate-900/5">
      {/* Author Header */}
      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <ResilientImage
            src={post.authorAvatar}
            alt={post.authorName}
            className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-900/10"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-[#1E293B] truncate">
                {post.authorName}
              </span>
              {post.verified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
              )}
            </div>
            <p className="text-xs text-[#64748B] truncate">
              {post.neighborhood} · {city.name} · {post.createdAt}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {compat && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#006947] bg-[#10B981]/12 px-2.5 py-1 rounded-full tabular-nums">
              {compat.overallPercent}% Match
            </span>
          )}
          {linkedProfile && (
            <button
              type="button"
              onClick={() => onQuickMatch(linkedProfile.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shrink-0 active:scale-[0.98] ${
                isMatched
                  ? 'bg-[#10B981]/12 text-[#006947]'
                  : 'bg-[#F05A4A] text-white hover:bg-[#df4c3c]'
              }`}
            >
              {isMatched ? 'Matched' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {/* Media Viewport (Instagram-style carousel / reel with double-tap heart) */}
      <div
        onClick={handleMediaTap}
        className="relative aspect-[4/3] sm:aspect-[16/11] w-full bg-[#F4F2EE] overflow-hidden cursor-pointer select-none"
      >
        {isVideoAsset ? (
          <video
            ref={videoRef}
            src={currentMedia.url}
            autoPlay
            loop
            muted={muted}
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <ResilientImage
            src={currentMedia?.url}
            alt={post.flatTitle || post.caption}
            fallbackTitle={post.flatTitle || post.neighborhood}
            className={`w-full h-full object-cover transition-transform duration-[3200ms] ease-out ${
              post.isWalkthroughReel && reelPlaying ? 'scale-[1.06]' : 'scale-100'
            }`}
          />
        )}

        {/* Top-left post type & reel indicator */}
        <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
          <span className="px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-white text-[11px] font-semibold">
            {post.postType}
          </span>
          {(post.isWalkthroughReel || isVideoAsset) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-white text-[11px] font-semibold">
              <Film className="w-3 h-3" />
              <span>Reel</span>
            </span>
          )}
        </div>

        {/* Top-right video/reel controls */}
        {(isVideoAsset || post.isWalkthroughReel) && (
          <div
            className="absolute top-3 right-3 flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                if (isVideoAsset && videoRef.current) {
                  if (videoRef.current.paused) {
                    videoRef.current.play().catch(() => undefined);
                    setReelPlaying(true);
                  } else {
                    videoRef.current.pause();
                    setReelPlaying(false);
                  }
                } else {
                  setReelPlaying((p) => !p);
                }
              }}
              aria-label={reelPlaying ? 'Pause reel' : 'Play reel'}
              className="w-8 h-8 rounded-full bg-black/55 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/75"
            >
              {reelPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            {isVideoAsset && (
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Unmute video' : 'Mute video'}
                className="w-8 h-8 rounded-full bg-black/55 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/75"
              >
                {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        )}

        {/* Carousel navigation arrows */}
        {post.media.length > 1 && (
          <div onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() =>
                setMediaIndex((prev) => (prev - 1 + post.media.length) % post.media.length)
              }
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm text-[#1E293B] flex items-center justify-center shadow-sm hover:bg-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setMediaIndex((prev) => (prev + 1) % post.media.length)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm text-[#1E293B] flex items-center justify-center shadow-sm hover:bg-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/35 backdrop-blur-sm px-2.5 py-1 rounded-full">
              {post.media.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setMediaIndex(idx)}
                  aria-label={`Slide ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === mediaIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/55'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Bottom Scrim with Rent & Flat Title */}
        {post.rentPerMonth && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pb-3 pt-8 pointer-events-none flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="text-white text-sm font-bold truncate">
                {post.flatTitle || `${post.neighborhood} Home`}
              </p>
            </div>
            <div className="shrink-0 bg-white/95 text-[#1E293B] px-3 py-1 rounded-full text-xs font-extrabold tabular-nums shadow-sm">
              ₹{post.rentPerMonth.toLocaleString('en-IN')}/mo
            </div>
          </div>
        )}

        {/* Double-tap heart burst */}
        <AnimatePresence>
          {showHeartBurst && (
            <motion.div
              initial={{scale: 0.4, opacity: 0}}
              animate={{scale: 1.15, opacity: 1}}
              exit={{scale: 1.4, opacity: 0}}
              transition={{duration: 0.35}}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <Heart className="w-20 h-20 text-white fill-[#F05A4A] drop-shadow-xl" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Bar */}
      <div className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onToggleLike(post.id)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E293B] hover:text-[#F05A4A] transition-colors min-h-[40px]"
            >
              <Heart
                className={`w-5 h-5 transition-transform active:scale-125 ${
                  post.likedByMe ? 'fill-[#F05A4A] text-[#F05A4A]' : 'text-[#1E293B]'
                }`}
              />
              <span className="tabular-nums">{post.likes}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowComments((s) => !s)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E293B] hover:text-[#F05A4A] transition-colors min-h-[40px]"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="tabular-nums">{post.comments.length}</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleSave(post.id)}
              aria-label={post.savedByMe ? 'Unsave post' : 'Save post'}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E293B] hover:text-[#E08738] transition-colors min-h-[40px]"
            >
              <Bookmark
                className={`w-5 h-5 ${
                  post.savedByMe ? 'fill-[#E08738] text-[#E08738]' : 'text-[#1E293B]'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateToFlat(post)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#F4F2EE] hover:bg-[#EAE6DF] text-xs font-bold text-[#1E293B] transition-colors whitespace-nowrap shrink-0"
            >
              <Navigation className="w-3.5 h-3.5 text-[#F05A4A]" />
              <span>Navigate</span>
            </button>
            {linkedProfile && (
              <button
                type="button"
                onClick={() => onOpenDetail(linkedProfile)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#FFF8F0] border border-[#F05A4A]/25 hover:bg-[#FFEBE7] text-xs font-bold text-[#F05A4A] transition-colors whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tour &amp; Split ₹</span>
              </button>
            )}
          </div>
        </div>

        {/* Caption & Unboxed Metadata */}
        <p className="mt-2 text-sm text-[#1E293B] leading-relaxed">
          <span className="font-bold mr-1.5">{post.authorName}</span>
          {post.caption}
        </p>

        {post.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-[#64748B]">
            {post.tags.map((tag, idx) => (
              <React.Fragment key={tag}>
                {idx > 0 && <span aria-hidden="true">·</span>}
                <span>#{tag.replace(/\s+/g, '')}</span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Comments Preview / Drawer */}
        {post.comments.length > 0 && !showComments && (
          <button
            type="button"
            onClick={() => setShowComments(true)}
            className="mt-2 text-xs font-semibold text-[#64748B] hover:text-[#1E293B]"
          >
            View {post.comments.length === 1 ? '1 comment' : `all ${post.comments.length} comments`}
          </button>
        )}

        {showComments && (
          <div className="mt-3 pt-3 border-t border-slate-900/5 space-y-2.5">
            {post.comments.map((c) => (
              <div key={c.id} className="text-xs leading-relaxed">
                <span className="font-bold text-[#1E293B] mr-1.5">{c.authorName}</span>
                <span className="text-[#59413D]">{c.text}</span>
                <span className="text-[#64748B] ml-2">{c.createdAt}</span>
              </div>
            ))}

            <form onSubmit={handleSubmitComment} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Ask about rent, cook, metro walk..."
                className="flex-1 h-10 px-4 rounded-full bg-[#F4F2EE] text-xs text-[#1E293B] placeholder-[#64748B] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#F05A4A]/40"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                aria-label="Post comment"
                className="w-10 h-10 rounded-full bg-[#F05A4A] disabled:opacity-40 text-white flex items-center justify-center shrink-0 hover:bg-[#e04c3c]"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
};

interface FeedViewProps {
  posts: FeedPost[];
  city: CityTheme;
  profiles: RoommateProfile[];
  matchedIds: string[];
  userPrefs: LifestylePreferences;
  onToggleLike: (postId: string, forceLike?: boolean) => void;
  onToggleSave: (postId: string) => void;
  onAddComment: (postId: string, text: string) => void;
  onNavigateToFlat: (post: FeedPost) => void;
  onOpenDetail: (profile: RoommateProfile) => void;
  onQuickMatch: (profileId: string) => void;
  onOpenCreatePost: () => void;
}

export const FeedView: React.FC<FeedViewProps> = ({
  posts,
  city,
  profiles,
  matchedIds,
  userPrefs,
  onToggleLike,
  onToggleSave,
  onAddComment,
  onNavigateToFlat,
  onOpenDetail,
  onQuickMatch,
  onOpenCreatePost,
}) => {
  if (posts.length === 0) {
    return (
      <div className="bg-white rounded-[32px] p-8 text-center shadow-kinship-1 border border-slate-900/5">
        <p className="text-lg font-bold text-[#1E293B]">
          No posts in this locality yet
        </p>
        <p className="text-sm text-[#64748B] mt-1">
          Be the first to share a flat tour video or roommate intro in {city.name}.
        </p>
        <button
          type="button"
          onClick={onOpenCreatePost}
          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#F05A4A] text-white text-sm font-bold hover:bg-[#e04c3c]"
        >
          <Plus className="w-4 h-4" />
          <span>Post Photo or Video</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {posts.map((post) => {
        const linkedProfile = profiles.find((p) => p.id === post.linkedProfileId);
        return (
          <FeedPostCard
            key={post.id}
            post={post}
            city={city}
            userPrefs={userPrefs}
            linkedProfile={linkedProfile}
            isMatched={linkedProfile ? matchedIds.includes(linkedProfile.id) : false}
            onToggleLike={onToggleLike}
            onToggleSave={onToggleSave}
            onAddComment={onAddComment}
            onNavigateToFlat={onNavigateToFlat}
            onOpenDetail={onOpenDetail}
            onQuickMatch={onQuickMatch}
          />
        );
      })}
    </div>
  );
};
