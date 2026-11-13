import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { NotificationView } from '@dive/shared';
import { api } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { timeAgo } from '../lib/format';

/** Bell + dropdown for any signed-in role. Refreshes on navigation and every minute. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { data, reload } = useFetch<{ notifications: NotificationView[]; unread: number }>(`/notifications?r=${location.key}`);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    const t = setInterval(reload, 60_000);
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => {
      clearInterval(t);
      document.removeEventListener('mousedown', onDown);
    };
  }, [reload]);

  const unread = data?.unread ?? 0;
  return (
    <div ref={ref} className="relative">
      <button type="button" className="relative grid h-11 w-11 place-items-center rounded-full border border-line-2 text-text" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {unread > 0 && <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-gold-ink">{unread > 9 ? '9+' : unread}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 z-50 mt-3 w-[340px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[22px] border border-line-2 bg-surface shadow-[0_30px_60px_-20px_rgba(0,0,0,.9)]"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <span className="font-bold">Notifications</span>
              {unread > 0 && (
                <button type="button" className="text-[13px] text-gold" onClick={async () => { await api('/notifications/read', { method: 'POST', body: {} }); reload(); }}>
                  Mark all read
                </button>
              )}
            </div>
            <ul className="m-0 max-h-[400px] list-none overflow-y-auto p-0">
              {(data?.notifications ?? []).slice(0, 12).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="flex w-full gap-3 border-b border-line-soft px-5 py-3.5 text-left hover:bg-surface-2"
                    onClick={async () => {
                      if (!n.readAt) await api('/notifications/read', { method: 'POST', body: { id: n.id } });
                      reload();
                      if (n.link) navigate(n.link);
                    }}
                  >
                    <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${n.readAt ? 'bg-transparent' : 'bg-gold'}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-text">{n.title}</span>
                      {n.body && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{n.body}</span>}
                      <span className="mt-1 block text-xs text-faint">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
              {data && data.notifications.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">Nothing yet.</li>}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
