import { Link } from 'react-router';
import type { MyMembership, NotificationView } from '@dive/shared';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Reveal } from '../../components/motion/Reveal';
import { WordStagger } from '../../components/motion/WordStagger';
import { Icon } from '../../components/ui/Icon';
import { StatusPill } from '../../components/ui/StatusPill';
import { MemberCard } from './MemberCard';
import { daysLeft, longDate, timeAgo } from '../../lib/format';

export default function MemberHome() {
  useDocumentTitle('My DIVE-IN');
  const { user } = useAuth();
  const { data, loading } = useFetch<{ memberships: MyMembership[] }>('/me/memberships');
  const notes = useFetch<{ notifications: NotificationView[] }>('/me/notifications');
  const list = data?.memberships ?? [];
  const order = { ACTIVE: 0, AWAITING_PAYMENT: 1, EXPIRED: 2, CANCELLED: 3 } as const;
  const sorted = [...list].sort((a, b) => order[a.status] - order[b.status]);
  const first = user!.fullName.split(' ')[0];

  return (
    <>
      <div className="eyebrow mb-4">Member</div>
      <h1 className="disp m-0 text-[52px] sm:text-[80px]">
        <WordStagger lines={[`Hi, ${first}.`]} />
      </h1>

      {loading && !data ? (
        <div className="mt-10 h-[280px] animate-pulse rounded-[22px] bg-surface" />
      ) : sorted.length === 0 ? (
        <Reveal className="mt-10 rounded-[30px] border border-gold-line bg-gold-deep p-8 sm:p-12">
          <h2 className="disp m-0 text-[40px] sm:text-[56px]">No card yet.</h2>
          <p className="lead mt-4 mb-8 max-w-[520px]">Find a gym near you, pick a package and pay securely. Your digital membership card appears here the moment payment is verified.</p>
          <Link to="/gyms" className="btn btn-gold">Find a gym <Icon name="arrowRight" size={16} strokeWidth={2.4} /></Link>
        </Reveal>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Reveal className="w-full max-w-[520px]">
            <MemberCard m={sorted[0]} />
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-faint">Tap the card to see what reception sees</span>
              <Link to={`/app/cards/${sorted[0].id}`} className="font-semibold text-gold no-underline">Open card →</Link>
            </div>
          </Reveal>
          <div className="flex flex-col gap-3">
            {sorted.map((m, i) => {
              const left = daysLeft(m.endsAt);
              return (
                <Reveal key={m.id} delay={i * 0.06}>
                  <Link to={`/app/cards/${m.id}`} className="card hover-gold flex items-center justify-between gap-4 !rounded-[20px] p-5 text-text no-underline">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-bold">{m.gym.name}</div>
                      <div className="mt-1 text-[13px] text-muted">
                        {m.package.name} · {m.number}
                        {m.status === 'ACTIVE' && left !== null && <> · {left <= 7 ? <span className="text-warning">{left} days left</span> : `until ${longDate(m.endsAt)}`}</>}
                      </div>
                    </div>
                    <StatusPill status={m.status} size="sm" />
                  </Link>
                </Reveal>
              );
            })}
            <Link to="/gyms" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-gold no-underline"><Icon name="plus" size={15} /> Join another gym</Link>
          </div>
        </div>
      )}

      <section className="mt-16">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="disp m-0 text-[32px]">Latest updates</h2>
          <Link to="/app/notifications" className="text-sm text-gold no-underline">All notifications</Link>
        </div>
        <div className="card divide-y divide-line-soft">
          {(notes.data?.notifications ?? []).slice(0, 4).map((n) => (
            <div key={n.id} className="flex gap-3 px-5 py-4">
              <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${n.readAt ? 'bg-line-3' : 'bg-gold'}`} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{n.title}</div>
                {n.body && <div className="mt-0.5 text-sm text-muted">{n.body}</div>}
              </div>
              <span className="text-xs whitespace-nowrap text-faint">{timeAgo(n.createdAt)}</span>
            </div>
          ))}
          {notes.data && notes.data.notifications.length === 0 && <p className="m-0 px-5 py-8 text-center text-sm text-muted">Payment and booking updates will appear here.</p>}
        </div>
      </section>
    </>
  );
}
