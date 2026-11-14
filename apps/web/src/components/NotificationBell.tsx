import {useCallback, useEffect, useState} from 'react';
import {Bell, CheckCheck} from 'lucide-react';
import type {NotificationDto} from '@other-half/contracts';
import {getNotifications, markAllNotificationsRead, markNotificationRead, notificationAge} from '../services/notifications';

export function NotificationBell({onOpenTours}: {onOpenTours: () => void}) {
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const result = await getNotifications(signal);
    if (signal?.aborted) return;
    setItems(result.items);
    setUnreadCount(result.unreadCount);
    setError('');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load notifications.');
    });
    const timer = window.setInterval(() => {if (!document.hidden) void refresh().catch(() => undefined);}, 30_000);
    const onFocus = () => void refresh().catch(() => undefined);
    window.addEventListener('focus', onFocus);
    return () => {controller.abort(); window.clearInterval(timer); window.removeEventListener('focus', onFocus);};
  }, [refresh]);

  const openNotification = async (item: NotificationDto) => {
    try {
      if (!item.readAt) await markNotificationRead(item.id);
      setItems((current) => current.map((entry) => entry.id === item.id ? {...entry, readAt: new Date().toISOString()} : entry));
      setUnreadCount((count) => item.readAt ? count : Math.max(0, count - 1));
      setOpen(false);
      onOpenTours();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this notification.');
    }
  };

  const readAll = async () => {
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => item.readAt ? item : {...item, readAt: now}));
      setUnreadCount(0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not mark notifications as read.');
    }
  };

  return <div className="relative">
    <button type="button" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} aria-expanded={open} onClick={() => {setOpen((value) => !value); if (!open) void refresh().catch(() => undefined);}} className="relative mr-2 grid h-9 w-9 place-items-center rounded-full text-[#64748B] hover:bg-[#F4F2EE] hover:text-[#1E293B]">
      <Bell className="h-4 w-4"/>{unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#F05A4A] px-1 text-[9px] font-extrabold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {open && <section aria-label="Notifications" className="absolute right-0 top-11 z-50 w-[min(90vw,380px)] overflow-hidden rounded-2xl border border-slate-900/10 bg-white shadow-kinship-2">
      <header className="flex items-center justify-between border-b border-slate-900/5 px-4 py-3"><div><h2 className="font-extrabold text-[#1E293B]">Notifications</h2><p className="text-[11px] text-[#64748B]">Visit request updates</p></div>{unreadCount > 0 && <button type="button" onClick={() => void readAll()} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F05A4A]"><CheckCheck className="h-3.5 w-3.5"/>Mark all read</button>}</header>
      {error && <p role="alert" className="px-4 py-2 text-xs text-red-700">{error}</p>}
      <div className="max-h-[min(65vh,440px)] overflow-y-auto">{items.length === 0 ? <p className="px-5 py-8 text-center text-sm text-[#64748B]">No notifications yet.</p> : items.map((item) => <button type="button" key={item.id} onClick={() => void openNotification(item)} className={`block w-full border-b border-slate-900/5 px-4 py-3 text-left hover:bg-[#FAF9F6] ${item.readAt ? 'bg-white' : 'bg-[#FFF8F0]'}`}><span className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-transparent' : 'bg-[#F05A4A]'}`}/><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#1E293B]">{item.title}</span><span className="mt-0.5 block text-xs leading-5 text-[#64748B]">{item.body}</span><time className="mt-1 block text-[10px] text-[#94A3B8]">{notificationAge(item)}</time></span></span></button>)}</div>
    </section>}
  </div>;
}
