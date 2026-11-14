import React, {useEffect, useRef, useState} from 'react';
import {Calendar, Navigation, Send} from 'lucide-react';
import {CITY_THEMES} from '../data/indiaData';
import {Conversation, RoommateProfile} from '../types';
import {ResilientImage} from './ResilientImage';

interface MessagesViewProps {
  profiles: RoommateProfile[];
  matchedIds: string[];
  conversations: Record<string, Conversation>;
  activeProfileId: string | null;
  onSelectConversation: (profileId: string) => void;
  onSendMessage: (profileId: string, text: string) => void;
  onOpenDetail: (profile: RoommateProfile) => void;
  onNavigateToProfile: (profile: RoommateProfile) => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({
  profiles,
  matchedIds,
  conversations,
  activeProfileId,
  onSelectConversation,
  onSendMessage,
  onOpenDetail,
  onNavigateToProfile,
}) => {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const threadProfiles = profiles.filter(
    (p) => matchedIds.includes(p.id) || Boolean(conversations[p.id])
  );

  const selectedProfile =
    threadProfiles.find((p) => p.id === activeProfileId) || threadProfiles[0] || null;
  const activeConvo = selectedProfile
    ? conversations[selectedProfile.id]
    : undefined;

  useEffect(() => {
    endRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [activeConvo?.messages.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfile || !draft.trim()) return;
    onSendMessage(selectedProfile.id, draft);
    setDraft('');
  };

  if (threadProfiles.length === 0) {
    return (
      <div className="bg-white rounded-[32px] p-8 text-center shadow-kinship-1 border border-slate-900/5">
        <p className="text-base font-bold text-[#1E293B]">No conversations yet</p>
        <p className="text-xs text-[#64748B] mt-1">
          Match with a roommate in Explore to unlock messaging and tour invites.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      {/* Separated Floating Card Thread Rows (Warm Kinship style) */}
      <div className="lg:col-span-5 space-y-2.5">
        <h2 className="text-lg font-extrabold text-[#1E293B] mb-2">Messages</h2>
        {threadProfiles.map((profile) => {
          const convo = conversations[profile.id];
          const lastMsg = convo?.messages[convo.messages.length - 1];
          const isActive = selectedProfile?.id === profile.id;

          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onSelectConversation(profile.id)}
              className={`w-full text-left rounded-[22px] p-3.5 transition-all flex items-center gap-3 shadow-kinship-1 border ${
                isActive
                  ? 'bg-[#FFF8F0] border-[#F05A4A]/40'
                  : 'bg-white border-slate-900/5 hover:bg-[#FAF9F6]'
              }`}
            >
              <ResilientImage
                src={profile.avatar}
                alt={profile.name}
                className="w-12 h-12 rounded-2xl object-cover shrink-0 bg-[#F4F2EE]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#1E293B] truncate">
                    {profile.name}
                  </span>
                  <span className="text-[11px] text-[#64748B] shrink-0">
                    {lastMsg?.timestamp || 'Matched'}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] truncate mt-0.5">
                  {lastMsg?.text || `Say hello in ${profile.neighborhood}`}
                </p>
              </div>
              {convo?.unread && (
                <span className="w-2.5 h-2.5 rounded-full bg-[#F05A4A] shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Chat Pane */}
      {selectedProfile && (
        <div className="lg:col-span-7 bg-white rounded-[28px] shadow-kinship-1 border border-slate-900/5 flex flex-col min-h-[480px] max-h-[640px]">
          <div className="px-5 py-4 border-b border-slate-900/5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <ResilientImage
                src={selectedProfile.avatar}
                alt={selectedProfile.name}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1E293B] truncate">
                  {selectedProfile.name}
                </p>
                <p className="text-xs text-[#64748B] truncate">
                  {selectedProfile.neighborhood} · {CITY_THEMES[selectedProfile.cityId].name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateToProfile(selectedProfile)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F4F2EE] text-xs font-bold text-[#1E293B] hover:bg-[#EAE6DF]"
              >
                <Navigation className="w-3.5 h-3.5 text-[#F05A4A]" />
                <span>Navigate</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenDetail(selectedProfile)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#FFF8F0] border border-[#F05A4A]/25 text-xs font-bold text-[#F05A4A]"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Book Tour</span>
              </button>
            </div>
          </div>

          {/* Message Stream */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#FAF9F6]/60">
            {(activeConvo?.messages || []).map((msg) => {
              if (msg.sender === 'system') {
                return (
                  <div
                    key={msg.id}
                    className="text-center text-xs text-[#64748B] bg-white/80 rounded-full px-4 py-1.5 mx-auto max-w-sm border border-slate-900/5"
                  >
                    {msg.text}
                  </div>
                );
              }
              const isMe = msg.sender === 'me';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      isMe
                        ? 'bg-[#F05A4A] text-white rounded-br-sm'
                        : 'bg-white text-[#1E293B] shadow-kinship-1 border border-slate-900/5 rounded-bl-sm'
                    }`}
                  >
                    <p>{msg.text}</p>
                    {msg.tourCard && (
                      <div className="mt-2 p-2.5 rounded-xl bg-white/95 text-[#1E293B] text-xs space-y-0.5">
                        <div className="font-bold text-[#006947]">
                          {msg.tourCard.mode} Confirmed
                        </div>
                        <div className="tabular-nums">
                          {msg.tourCard.date} at {msg.tourCard.timeSlot}
                        </div>
                        <div className="text-[#64748B]">{msg.tourCard.location}</div>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-[#64748B] mt-1 px-1">
                    {msg.timestamp}
                  </span>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {/* Quick Icebreakers + Composer */}
          <div className="p-4 border-t border-slate-900/5 bg-white rounded-b-[28px] space-y-2.5">
            {selectedProfile.icebreakers.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {selectedProfile.icebreakers.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onSendMessage(selectedProfile.id, prompt)}
                    className="shrink-0 px-3 py-1.5 rounded-full bg-[#F4F2EE] hover:bg-[#EAE6DF] text-[11px] font-semibold text-[#1E293B]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSend} className="flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${selectedProfile.name.split(' ')[0]}...`}
                className="flex-1 h-12 px-4 rounded-full bg-[#F4F2EE] text-sm text-[#1E293B] placeholder-[#64748B] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#F05A4A]/40"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Send message"
                className="w-12 h-12 rounded-full bg-[#F05A4A] text-white flex items-center justify-center shrink-0 hover:bg-[#e04c3c] disabled:opacity-40 transition-transform active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
