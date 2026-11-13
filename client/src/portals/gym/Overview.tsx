import { Link } from 'react-router';
import type { GymOverview } from '@dive/shared';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Reveal } from '../../components/motion/Reveal';
import { StatusPill } from '../../components/ui/StatusPill';
import { Icon } from '../../components/ui/Icon';
import { rwf, timeAgo } from '../../lib/format';
import { useGym } from './GymLayout';
import { PageHead, Skeleton, Stat } from '../ui';

export default function Overview() {
  useDocumentTitle('Gym overview');
  const { gym } = useGym();
  const { data } = useFetch<{ overview: GymOverview }>('/gym/overview');
  const o = data?.overview;

  return (
    <>
      <PageHead eyebrow="Gym owner portal" title={gym.name} actions={<Link to="/gym/reception" className="btn btn-gold !h-11"><Icon name="shield" size={16} /> Open reception</Link>}>
        Members, check-ins and money at a glance.
      </PageHead>

      {!o ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Reveal><Stat label="Active members" value={o.activeMembers} hint={<Link to="/gym/members?status=ACTIVE" className="text-gold no-underline">View list</Link>} /></Reveal>
            <Reveal delay={0.05}><Stat label="Checked in today" value={o.checkInsToday} /></Reveal>
            <Reveal delay={0.1}><Stat label="Awaiting payment" value={o.awaitingPayment} tone={o.awaitingPayment ? 'warn' : undefined} hint={o.expiringSoon ? `${o.expiringSoon} expiring within 7 days` : 'None expiring this week'} /></Reveal>
            <Reveal delay={0.15}><Stat label="Earned this month" value={rwf(o.revenueThisMonthRwf ?? 0)} tone="gold" hint={<Link to="/gym/reports" className="text-gold no-underline">Payments & reports</Link>} /></Reveal>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="disp m-0 text-[28px]">Waiting for payment</h2>
                <Link to="/gym/members?status=AWAITING_PAYMENT" className="text-sm text-gold no-underline">All</Link>
              </div>
              {o.pendingRequests.length === 0 ? (
                <p className="m-0 py-6 text-center text-sm text-muted">No one is waiting for payment.</p>
              ) : (
                <ul className="m-0 list-none divide-y divide-line-soft p-0">
                  {o.pendingRequests.map((m) => (
                    <li key={m.membershipId}>
                      <Link to={`/gym/members?open=${m.membershipId}`} className="flex items-center justify-between gap-3 py-3 text-text no-underline hover:text-gold">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{m.memberName}</span>
                          <span className="block text-xs text-muted">{m.number} · {m.packageName} · {rwf(m.priceRwf)} · {timeAgo(m.createdAt)}</span>
                        </span>
                        <StatusPill status={m.status} size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="disp m-0 text-[28px]">Recent check-ins</h2>
                <Link to="/gym/reception" className="text-sm text-gold no-underline">Reception</Link>
              </div>
              <ul className="m-0 list-none divide-y divide-line-soft p-0">
                {o.recentCheckIns.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 py-3">
                    <span className={`h-2 w-2 flex-none rounded-full ${c.result === 'ALLOWED' ? 'bg-success' : 'bg-error'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.memberName}</span>
                      <span className="block truncate text-xs text-muted">{c.result === 'ALLOWED' ? `Let in by ${c.staffName}` : `Refused: ${c.reason}`}</span>
                    </span>
                    <span className="text-xs text-faint">{timeAgo(c.createdAt)}</span>
                  </li>
                ))}
                {o.recentCheckIns.length === 0 && <li className="py-6 text-center text-sm text-muted">No check-ins yet.</li>}
              </ul>
            </section>
          </div>
        </>
      )}
    </>
  );
}
