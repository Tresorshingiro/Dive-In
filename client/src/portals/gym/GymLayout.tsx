import { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import type { GymContext } from '@dive/shared';
import { selectedGym } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { Logo } from '../../components/ui/Logo';
import { Icon, type IconName } from '../../components/ui/Icon';
import { longDate } from '../../lib/format';

const Ctx = createContext<{ gym: GymContext; reload: () => void } | null>(null);
export const useGym = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useGym outside GymLayout');
  return c;
};

const OWNER_NAV: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '/gym', label: 'Overview', icon: 'sparkle', end: true },
  { to: '/gym/reception', label: 'Reception', icon: 'shield' },
  { to: '/gym/members', label: 'Members', icon: 'user' },
  { to: '/gym/packages', label: 'Packages', icon: 'dumbbell' },
  { to: '/gym/profile', label: 'Gym profile', icon: 'pin' },
  { to: '/gym/photos', label: 'Photos', icon: 'plus' },
  { to: '/gym/trainers', label: 'Trainers', icon: 'calendarCheck' },
  { to: '/gym/staff', label: 'Staff', icon: 'lock' },
  { to: '/gym/reports', label: 'Payments & reports', icon: 'arrowUpRight' },
  { to: '/gym/subscription', label: 'Partner plan', icon: 'calendarCheck' },
];

function GymSwitcher({ current }: { current: GymContext }) {
  const { data } = useFetch<{ gyms: { id: string; name: string; status: string }[] }>('/gym/mine');
  if (!data || data.gyms.length < 2) return null;
  return (
    <select
      aria-label="Switch gym"
      className="field !h-10 !rounded-full !py-0 !text-sm"
      value={current.id}
      onChange={(e) => {
        selectedGym.set(e.target.value);
        window.location.assign('/gym');
      }}
    >
      {data.gyms.map((g) => (
        <option key={g.id} value={g.id}>{g.name}{g.status !== 'APPROVED' ? ` (${g.status.toLowerCase()})` : ''}</option>
      ))}
    </select>
  );
}

export default function GymLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, error, reload } = useFetch<{ gym: GymContext }>('/gym/context');
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    setMenu(false);
  }, [location.pathname]);

  // A stale gym selection (e.g. gym removed) → clear it and retry once.
  useEffect(() => {
    if (error?.status === 403 && selectedGym.get()) {
      selectedGym.set(null);
      reload();
    }
  }, [error, reload]);

  if (error && !(error.status === 403 && selectedGym.get())) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink p-6 text-center text-text">
        <div>
          <p className="text-error">{error.message}</p>
          <button type="button" className="btn btn-ghost mt-6" onClick={async () => { await logout(); navigate('/login'); }}>Log out</button>
        </div>
      </div>
    );
  }
  if (!data) return <div className="min-h-screen bg-ink" />;

  const gym = data.gym;
  const owner = gym.as === 'OWNER';
  // Reception accounts only ever see the desk.
  if (!owner && !location.pathname.startsWith('/gym/reception')) return <Navigate to="/gym/reception" replace />;
  const nav = owner ? OWNER_NAV : OWNER_NAV.filter((n) => n.to === '/gym/reception');

  const sidebar = (
    <nav aria-label="Gym portal" className="flex flex-col gap-1">
      <div className="mb-2 px-3 text-[11px] font-bold tracking-[.16em] text-faint">DIVE-IN MENU</div>
      {nav.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] no-underline transition-colors ${isActive ? 'bg-gold-deep font-semibold text-gold' : 'text-chalk hover:bg-surface hover:text-text'}`
          }
        >
          <Icon name={n.icon} size={17} />
          {n.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <Ctx.Provider value={{ gym, reload }}>
      <div className="min-h-screen bg-ink text-text">
        <header className="sticky top-0 z-[1000] border-b border-line-soft bg-[rgba(14,14,14,.88)] backdrop-blur-[14px]">
          <div className="flex h-[72px] items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <button type="button" className={`h-10 w-10 place-items-center rounded-full border border-line-2 lg:hidden ${owner ? 'grid' : 'hidden'}`} aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
                <Icon name={menu ? 'close' : 'menu'} size={18} />
              </button>
              <Logo compact to={owner ? '/gym' : '/gym/reception'} />
              <span className="hidden h-6 w-px bg-line-2 sm:block" />
              <div className="hidden min-w-0 sm:block">
                <div className="truncate text-sm font-bold">{gym.name}</div>
                <div className="text-xs text-muted">{owner ? 'Gym owner portal' : 'Reception'}</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {owner && <div className="hidden md:block"><GymSwitcher current={gym} /></div>}
              <span className="hidden text-right text-sm md:block">
                <span className="block max-w-[180px] truncate font-semibold">{user!.fullName}</span>
                <span className="block text-xs text-muted">{owner ? 'Owner' : 'Receptionist'}</span>
              </span>
              <button type="button" aria-label="Log out" className="grid h-10 w-10 place-items-center rounded-full border border-line-2" onClick={async () => { await logout(); navigate('/login'); }}>
                <Icon name="logout" size={16} />
              </button>
            </div>
          </div>
        </header>

        <div className="flex">
          {owner && (
            <aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] w-[250px] flex-none overflow-y-auto border-r border-line-soft p-4 lg:block">{sidebar}</aside>
          )}
          {menu && (
            <div className="fixed inset-x-0 top-[72px] bottom-0 z-[900] overflow-y-auto bg-ink p-4 lg:hidden">
              {sidebar}
              {owner && <div className="mt-6 md:hidden"><GymSwitcher current={gym} /></div>}
            </div>
          )}
          <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-10">
            {gym.status !== 'APPROVED' && owner && (
              <div className="mb-8 flex items-start gap-3 rounded-2xl border border-gold-line bg-gold-deep px-5 py-4 text-sm text-chalk">
                <Icon name="clock" size={18} className="mt-0.5 flex-none text-gold" />
                <div>
                  {gym.status === 'PENDING' && <><strong className="text-text">Your gym is under review.</strong> Set up your profile, photos and packages now — it goes live on DIVE-IN once approved, and your free trial starts then.</>}
                  {gym.status === 'REJECTED' && <><strong className="text-text">Application not approved.</strong> {gym.statusNote ?? 'Contact DIVE-IN support for details.'}</>}
                  {gym.status === 'SUSPENDED' && <><strong className="text-text">Your gym is suspended</strong> and hidden from members. {gym.statusNote ?? 'Contact DIVE-IN support.'}</>}
                </div>
              </div>
            )}
            {owner && gym.status === 'APPROVED' && gym.subscription?.plan === 'TRIAL' && gym.subscription.daysLeft <= 10 && (
              <div className="mb-8 rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-chalk">
                Free trial ends {longDate(gym.subscription.endsAt)} ({gym.subscription.daysLeft} days). <NavLink to="/gym/subscription" className="text-gold">Choose a partner plan</NavLink> to stay listed.
              </div>
            )}
            <Outlet />
          </main>
        </div>
      </div>
    </Ctx.Provider>
  );
}
