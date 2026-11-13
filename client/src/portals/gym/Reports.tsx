import type { ActivityRow, GymPaymentRow, GymReport } from '@dive/shared';
import { useFetch } from '../../hooks/useFetch';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { BarChart, CHART } from '../../components/charts/BarChart';
import { Icon } from '../../components/ui/Icon';
import { dateTime, rwf, timeAgo } from '../../lib/format';
import { selectedGym } from '../../api/client';
import { PageHead, Skeleton, Stat } from '../ui';

const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
const monthLabel = (ym: string) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short' });
const monthLong = (ym: string) => new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const dayLabel = (d: string) => String(Number(d.slice(8)));
const dayLong = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const METHOD = { CARD: 'Card · DIVE-IN', MOMO: 'MoMo · DIVE-IN', PAID_AT_GYM: 'At desk' } as const;

export default function Reports() {
  useDocumentTitle('Payments & reports');
  const { data } = useFetch<{ report: GymReport }>('/gym/reports');
  const pays = useFetch<{ payments: GymPaymentRow[] }>('/gym/payments');
  const act = useFetch<{ activity: ActivityRow[] }>('/gym/activity');
  const r = data?.report;
  const change = r && r.revenueLastMonthRwf > 0 ? Math.round(((r.revenueThisMonthRwf - r.revenueLastMonthRwf) / r.revenueLastMonthRwf) * 100) : null;
  const gymParam = selectedGym.get();

  return (
    <>
      <PageHead
        eyebrow="Payments & reports"
        title="Payments & reports"
        actions={<a className="btn btn-ghost !h-11" href={`/api/gym/payments.csv${gymParam ? `?gymId=${gymParam}` : ''}`} download><Icon name="arrowRight" size={15} className="rotate-90" /> Export CSV (12 months)</a>}
      >
        “Earned” is what goes to the gym: payments taken at your desk in full, and online payments after the DIVE-IN commission (if you opted in).
      </PageHead>

      {!r ? <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} />)}</div> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Earned this month" value={rwf(r.revenueThisMonthRwf)} tone="gold" hint={change === null ? `Last month ${rwf(r.revenueLastMonthRwf)}` : `${change >= 0 ? '+' : ''}${change}% vs last month`} />
            <Stat label="Paid online via DIVE-IN" value={rwf(r.paidThroughDiveThisMonthRwf)} hint={`DIVE-IN commission ${rwf(r.commissionThisMonthRwf)}`} />
            <Stat label="Paid at your desk" value={rwf(r.paidAtGymThisMonthRwf)} hint="No commission" />
            <Stat label="Check-ins, 30 days" value={r.checkIns30d} hint={`${r.members.ACTIVE} active · ${r.members.AWAITING_PAYMENT} awaiting · ${r.members.EXPIRED} expired`} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="card p-6">
              <BarChart
                title="Check-ins per day · last 30 days"
                data={r.checkInsByDay.map((d) => ({ label: dayLabel(d.day), tooltipLabel: dayLong(d.day), values: { count: d.count } }))}
                series={[{ key: 'count', label: 'Check-ins', color: CHART.gold }]}
                labelEvery={5}
              />
            </section>
            <section className="card p-6">
              <BarChart
                title="Membership revenue · last 6 months"
                data={r.revenueByMonth.map((m) => ({ label: monthLabel(m.month), tooltipLabel: monthLong(m.month), values: { gym: m.gymShareRwf, dive: m.commissionRwf } }))}
                series={[
                  { key: 'gym', label: 'Gym share', color: CHART.gold },
                  { key: 'dive', label: 'DIVE-IN commission', color: CHART.blue },
                ]}
                format={short}
              />
            </section>
          </div>
        </>
      )}

      <section className="mt-8">
        <h2 className="disp mb-4 text-[30px]">Recent payments</h2>
        {!pays.data ? <Skeleton h={240} /> : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs tracking-[.1em] text-faint">
                  <th className="px-5 py-3.5 font-bold">DATE</th>
                  <th className="px-3 py-3.5 font-bold">MEMBER</th>
                  <th className="px-3 py-3.5 font-bold">PACKAGE</th>
                  <th className="px-3 py-3.5 font-bold">METHOD</th>
                  <th className="px-3 py-3.5 text-right font-bold">AMOUNT</th>
                  <th className="px-3 py-3.5 text-right font-bold">COMMISSION</th>
                  <th className="px-5 py-3.5 text-right font-bold">GYM SHARE</th>
                </tr>
              </thead>
              <tbody>
                {pays.data.payments.filter((p) => p.status === 'PAID' || p.status === 'REFUNDED').slice(0, 40).map((p) => (
                  <tr key={p.id} className="border-b border-line-soft">
                    <td className="px-5 py-3 text-chalk">{dateTime(p.paidAt ?? p.createdAt)}</td>
                    <td className="px-3 py-3"><span className="font-semibold">{p.memberName}</span><span className="block text-xs text-muted">{p.number}</span></td>
                    <td className="px-3 py-3 text-chalk">{p.packageName}</td>
                    <td className="px-3 py-3 text-chalk">{METHOD[p.method]}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{rwf(p.amountRwf)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted">{p.commissionRwf ? rwf(p.commissionRwf) : '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{rwf(p.gymShareRwf)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="disp mb-1 text-[30px]">Activity log</h2>
        <p className="mt-0 mb-4 text-sm text-muted">Every price change, desk payment, staff change and refused entry, with who did it.</p>
        <div className="card divide-y divide-line-soft">
          {(act.data?.activity ?? []).slice(0, 40).map((a) => (
            <div key={a.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3 text-sm">
              <span className="w-[110px] flex-none text-xs text-faint">{timeAgo(a.createdAt)}</span>
              <span className="min-w-0 flex-1 text-chalk">{a.summary}</span>
              <span className="text-xs text-muted">{a.actorName ?? 'System'}{a.actorRole ? ` · ${a.actorRole.replace('_', ' ').toLowerCase()}` : ''}</span>
            </div>
          ))}
          {act.data && act.data.activity.length === 0 && <p className="m-0 p-6 text-center text-sm text-muted">Nothing logged yet.</p>}
        </div>
      </section>
    </>
  );
}
