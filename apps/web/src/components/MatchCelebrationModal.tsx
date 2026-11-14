import React from 'react';
import {motion} from 'motion/react';
import {Heart, Send, X} from 'lucide-react';
import {CITY_THEMES} from '../data/indiaData';
import {LifestylePreferences, RoommateProfile} from '../types';
import {calculateCompatibility} from '../utils/compatibility';
import {ResilientImage} from './ResilientImage';

interface MatchCelebrationModalProps {
  profile: RoommateProfile;
  userPrefs: LifestylePreferences;
  onClose: () => void;
  onSendIcebreaker: (profileId: string, text: string) => void;
}

export const MatchCelebrationModal: React.FC<MatchCelebrationModalProps> = ({
  profile,
  userPrefs,
  onClose,
  onSendIcebreaker,
}) => {
  const city = CITY_THEMES[profile.cityId];
  const compat = calculateCompatibility(
    userPrefs,
    profile.preferences,
    profile.roomRent || profile.rentBudget
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="New roommate match celebration"
    >
      <motion.div
        initial={{scale: 0.9, opacity: 0, y: 16}}
        animate={{scale: 1, opacity: 1, y: 0}}
        className="relative bg-white w-full max-w-md rounded-[32px] p-6 shadow-kinship-3 text-center overflow-hidden"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close match dialog"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#F4F2EE] flex items-center justify-center text-[#1E293B]"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10B981]/12 text-[#006947] text-xs font-extrabold mb-4 tabular-nums">
          <span>{compat.overallPercent}% Compatible in {city.name}</span>
        </div>

        <h2 className="text-2xl font-extrabold text-[#1E293B] tracking-tight">
          You found your Other Half!
        </h2>
        <p className="text-sm text-[#64748B] mt-1">
          You and {profile.name} both want to connect in {profile.neighborhood}.
        </p>

        {/* Overlapping Circular Portraits */}
        <div className="my-6 flex items-center justify-center">
          <div className="relative flex items-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#F05A4A] to-[#E08738] p-1 shadow-md -mr-3 z-10 flex items-center justify-center text-white text-xl font-extrabold">
              You
            </div>
            <div className="w-9 h-9 rounded-full bg-white shadow-md z-20 flex items-center justify-center -mx-2">
              <Heart className="w-5 h-5 text-[#F05A4A] fill-[#F05A4A]" />
            </div>
            <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden -ml-3 z-10 bg-[#F4F2EE]">
              <ResilientImage
                src={profile.avatar}
                alt={profile.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        <div className="text-left space-y-2 mb-5">
          <p className="text-xs font-bold text-[#59413D]">
            Tap an icebreaker to start chatting:
          </p>
          {profile.icebreakers.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSendIcebreaker(profile.id, prompt)}
              className="w-full text-left px-4 py-2.5 rounded-2xl bg-[#FAF9F6] hover:bg-[#FFF8F0] border border-slate-900/5 hover:border-[#F05A4A]/35 text-xs font-semibold text-[#1E293B] flex items-center justify-between gap-2 transition-colors"
            >
              <span>“{prompt}”</span>
              <Send className="w-3.5 h-3.5 text-[#F05A4A] shrink-0" />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-full bg-[#F4F2EE] hover:bg-[#EAE6DF] text-xs font-bold text-[#1E293B]"
        >
          Keep Exploring {city.name}
        </button>
      </motion.div>
    </div>
  );
};
