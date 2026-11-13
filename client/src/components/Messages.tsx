import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import type { ConversationView, MessageView } from '@dive/shared';
import { api, ApiError } from '../api/client';
import { useFetch } from '../hooks/useFetch';
import { timeAgo } from '../lib/format';
import { Photo } from './ui/Photo';
import { Icon } from './ui/Icon';

const time = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' });

/** Two-pane inbox shared by members and trainers. Polls every 8 s while open. */
export function Messages({ emptyHint }: { emptyHint: string }) {
  const [params, setParams] = useSearchParams();
  const active = params.get('c');
  const list = useFetch<{ conversations: ConversationView[] }>('/messages');
  const [msgs, setMsgs] = useState<MessageView[]>([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const convo = list.data?.conversations.find((c) => c.id === active);

  useEffect(() => {
    if (!active) return;
    let stop = false;
    const load = async () => {
      try {
        const r = await api<{ messages: MessageView[] }>(`/messages/${active}`);
        if (!stop) setMsgs(r.messages);
      } catch (e) {
        if (!stop) setErr(e instanceof ApiError ? e.message : 'Could not load messages');
      }
    };
    void load().then(list.reload);
    const t = setInterval(load, 8000);
    return () => {
      stop = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  // Braces matter: newer browsers return a Promise from scrollIntoView, and an effect may only return a cleanup function.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [msgs.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !active) return;
    setSending(true);
    setErr('');
    try {
      const r = await api<{ message: MessageView }>(`/messages/${active}`, { method: 'POST', body: { body: text.trim() } });
      setMsgs((m) => [...m, r.message]);
      setText('');
      list.reload();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Could not send');
    } finally {
      setSending(false);
    }
  };

  const convos = list.data?.conversations ?? [];
  return (
    <div className="card grid min-h-[560px] grid-cols-1 overflow-hidden md:grid-cols-[300px_minmax(0,1fr)]">
      <aside className={`border-line md:border-r ${active ? 'hidden md:block' : ''}`}>
        <ul className="m-0 list-none p-0">
          {convos.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setParams({ c: c.id })} className={`flex w-full items-center gap-3 border-b border-line-soft px-4 py-3.5 text-left ${c.id === active ? 'bg-gold-deep' : 'hover:bg-surface-2'}`}>
                <Photo src={c.other.photoUrl} alt="" className="h-11 w-11 flex-none rounded-full" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{c.other.fullName}</span>
                    <span className="text-[11px] text-faint">{timeAgo(c.lastMessageAt)}</span>
                  </span>
                  <span className="block truncate text-[13px] text-muted">{c.lastMessage ? `${c.lastMessage.fromMe ? 'You: ' : ''}${c.lastMessage.body}` : 'No messages yet'}</span>
                </span>
                {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[11px] font-bold text-gold-ink">{c.unread}</span>}
              </button>
            </li>
          ))}
          {list.data && convos.length === 0 && <li className="p-8 text-center text-sm text-muted">{emptyHint}</li>}
        </ul>
      </aside>
      <section className={`flex min-h-[560px] flex-col ${active ? '' : 'hidden md:flex'}`}>
        {!active ? (
          <div className="grid flex-1 place-items-center p-8 text-center text-muted">Select a conversation</div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-line px-5 py-4">
              <button type="button" className="md:hidden" onClick={() => setParams({})} aria-label="Back"><Icon name="arrowRight" size={16} className="rotate-180" /></button>
              <span className="font-bold">{convo?.other.fullName ?? 'Conversation'}</span>
            </header>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-5 py-5" style={{ maxHeight: 460 }}>
              {msgs.map((m) => (
                <div key={m.id} className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[15px] ${m.fromMe ? 'self-end bg-gold text-gold-ink' : 'self-start bg-surface-2 text-text'}`}>
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div className={`mt-1 text-[11px] ${m.fromMe ? 'text-gold-ink/70' : 'text-faint'}`}>{time(m.createdAt)}{m.fromMe && m.readAt ? ' · seen' : ''}</div>
                </div>
              ))}
              <div ref={bottom} />
            </div>
            {err && <p className="mx-5 mb-2 text-sm text-error" role="alert">{err}</p>}
            <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
              <label className="sr-only" htmlFor="msg-input">Message</label>
              <input id="msg-input" className="field !h-12 flex-1" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" autoComplete="off" />
              <button type="submit" className="btn btn-gold !h-12" disabled={sending || !text.trim()}>Send</button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
