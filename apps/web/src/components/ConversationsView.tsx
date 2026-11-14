import {useCallback, useEffect, useMemo, useState} from 'react';
import {Ban, MessageCircle, RefreshCw, Send, ShieldCheck} from 'lucide-react';
import type {ConversationDto, ConversationMessageDto} from '@other-half/contracts';
import {getConversations, getMessages, markConversationRead, sendConversationMessage, setConversationBlocked} from '../services/conversations';

interface Props {userId: string; initialConversationId: string | null}

export function ConversationsView({userId, initialConversationId}: Props) {
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<ConversationMessageDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useMemo(() => conversations.find((item) => item.id === activeId) ?? null, [conversations, activeId]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const rows = await getConversations(signal);
    if (signal?.aborted) return;
    setConversations(rows);
    setActiveId((current) => {
      if (initialConversationId && rows.some((item) => item.id === initialConversationId)) return initialConversationId;
      if (current && rows.some((item) => item.id === current)) return current;
      return rows[0]?.id ?? null;
    });
  }, [initialConversationId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    void refresh(controller.signal).catch((cause: unknown) => {if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load conversations.');})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    const poll = window.setInterval(() => {void refresh().catch(() => undefined);}, 10_000);
    const onFocus = () => {void refresh().catch(() => undefined);};
    window.addEventListener('focus', onFocus);
    return () => {controller.abort(); window.clearInterval(poll); window.removeEventListener('focus', onFocus);};
  }, [refresh]);

  useEffect(() => {
    if (!activeId) {setMessages([]); setNextCursor(null); return;}
    const controller = new AbortController();
    setError('');
    void getMessages(activeId, undefined, controller.signal).then((page) => {
      if (controller.signal.aborted) return;
      setMessages(page.items); setNextCursor(page.nextCursor);
      const latestLoadedMessageId = page.items.at(-1)?.id;
      if (latestLoadedMessageId) return markConversationRead(activeId, latestLoadedMessageId).then(() => refresh()).catch(() => undefined);
    }).catch((cause: unknown) => {if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load messages.');});
    const syncThread = async () => {
      try {
        const page = await getMessages(activeId);
        setMessages((current) => {
          const byId = new Map(current.map((item) => [item.id, item]));
          for (const item of page.items) byId.set(item.id, item);
          return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        });
        const latestLoadedMessageId = page.items.at(-1)?.id;
        if (latestLoadedMessageId) await markConversationRead(activeId, latestLoadedMessageId);
        await refresh();
      } catch { /* The next poll or focus refresh retries transient failures. */ }
    };
    const poll = window.setInterval(() => void syncThread(), 10_000);
    window.addEventListener('focus', syncThread);
    return () => {controller.abort(); window.clearInterval(poll); window.removeEventListener('focus', syncThread);};
  }, [activeId, refresh]);

  const older = async () => {
    if (!activeId || !nextCursor || busy) return;
    setBusy(true); setError('');
    try {const page = await getMessages(activeId, nextCursor); setMessages((current) => [...page.items, ...current]); setNextCursor(page.nextCursor);}
    catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not load older messages.');}
    finally {setBusy(false);}
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!active || !draft.trim() || active.blockedByMe || active.blockedByPeer || busy) return;
    setBusy(true); setError('');
    try {const sent = await sendConversationMessage(active.id, draft); setMessages((current) => [...current, sent]); setDraft(''); await refresh();}
    catch (cause) {setError(cause instanceof Error ? cause.message : 'Message could not be sent.');}
    finally {setBusy(false);}
  };
  const toggleBlock = async () => {
    if (!active || busy) return;
    setBusy(true); setError('');
    try {await setConversationBlocked(active.id, !active.blockedByMe); await refresh();}
    catch (cause) {setError(cause instanceof Error ? cause.message : 'Could not update the block setting.');}
    finally {setBusy(false);}
  };

  if (loading) return <div className="rounded-3xl bg-white p-10 text-center text-sm text-[#64748B]">Loading your conversations…</div>;
  return <section className="space-y-4">
    <header className="rounded-[28px] bg-white p-5 shadow-kinship-1 sm:p-6"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#F05A4A]">Plan the visit</p><h1 className="mt-1 text-2xl font-extrabold">Messages</h1><p className="mt-1 text-sm text-[#64748B]">Private chats open after a visit window is confirmed.</p></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error} <button className="ml-2 font-bold underline" onClick={() => void refresh().catch(() => undefined)}>Retry</button></p>}
    <div className="grid min-h-[520px] gap-4 lg:grid-cols-12">
      <aside className="space-y-2 lg:col-span-4">{conversations.map((item) => <button key={item.id} onClick={() => setActiveId(item.id)} className={`w-full rounded-2xl p-4 text-left ${activeId === item.id ? 'bg-[#FFF8F0] ring-1 ring-[#F05A4A]/40' : 'bg-white shadow-kinship-1'}`}><span className="flex items-center justify-between gap-2 font-bold"><span className="truncate">{item.peerDisplayName}</span>{item.unread && <span className="h-2 w-2 rounded-full bg-[#F05A4A]" />}</span><span className="mt-1 block truncate text-xs text-[#64748B]">{item.listingTitle}</span><span className="mt-2 block truncate text-xs text-[#64748B]">{item.lastMessage?.body ?? 'Visit confirmed · start coordinating'}</span></button>)}
        {conversations.length === 0 && <div className="rounded-2xl bg-white p-6 text-center"><MessageCircle className="mx-auto h-7 w-7 text-[#F05A4A]"/><p className="mt-3 font-bold">No conversations yet</p><p className="mt-1 text-sm leading-5 text-[#64748B]">Once a home visit is confirmed, you can message the other person here.</p></div>}</aside>
      <div className="flex min-h-[520px] flex-col rounded-[28px] bg-white shadow-kinship-1 lg:col-span-8">
        {active ? <>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900/5 p-4"><div><h2 className="font-extrabold">{active.peerDisplayName}</h2><p className="text-xs text-[#64748B]">{active.listingTitle} · {active.neighborhood}</p></div><button disabled={busy || active.blockedByPeer} onClick={() => void toggleBlock()} className="inline-flex items-center gap-1 rounded-full bg-[#F4F2EE] px-3 py-2 text-xs font-bold disabled:opacity-50"><Ban className="h-3.5 w-3.5"/>{active.blockedByMe ? 'Unblock' : 'Block'}</button></header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-[#FAF9F6]/60 p-4">{nextCursor && <button onClick={() => void older()} disabled={busy} className="mx-auto flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-bold"><RefreshCw className="h-3 w-3"/>Load older messages</button>}{messages.map((message) => {const mine = message.senderId === userId; return <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm ${mine ? 'rounded-br-sm bg-[#F05A4A] text-white' : 'rounded-bl-sm border border-slate-900/5 bg-white text-[#1E293B]'}`}><p className="whitespace-pre-wrap break-words">{message.body}</p><time className={`mt-1 block text-[10px] ${mine ? 'text-white/75' : 'text-[#64748B]'}`}>{new Date(message.createdAt).toLocaleString('en-IN', {dateStyle: 'short', timeStyle: 'short'})}</time></div></div>;})}{messages.length === 0 && <div className="py-12 text-center text-sm text-[#64748B]"><ShieldCheck className="mx-auto mb-2 h-7 w-7 text-emerald-600"/>Visit confirmed. Coordinate a convenient time and any arrival details.</div>}</div>
          {active.blockedByMe || active.blockedByPeer ? <p className="border-t border-slate-900/5 p-4 text-center text-sm text-[#64748B]">{active.blockedByMe ? 'You blocked this member. Unblock to send messages.' : 'Messaging is unavailable for this conversation.'}</p> : <form onSubmit={(event) => void send(event)} className="flex gap-2 border-t border-slate-900/5 p-4"><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} placeholder={`Message ${active.peerDisplayName}…`} className="h-12 min-w-0 flex-1 rounded-full bg-[#F4F2EE] px-4 text-sm outline-none focus:ring-2 focus:ring-[#F05A4A]/40"/><button disabled={busy || !draft.trim()} aria-label="Send message" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#F05A4A] text-white disabled:opacity-40"><Send className="h-4 w-4"/></button></form>}
        </> : <div className="grid flex-1 place-items-center p-8 text-center text-sm text-[#64748B]">Select a conversation to view the messages.</div>}
      </div>
    </div>
  </section>;
}
