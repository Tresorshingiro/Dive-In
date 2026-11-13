import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../../components/ui/Logo';
import { Icon, type IconName } from '../../components/ui/Icon';
import { NotificationBell } from '../../components/NotificationBell';

const NAV: Array<{ to: string; label: string; icon: IconName; end?: boolean }> = [
  { to: '/trainer', label: 'Overview', icon: 'sparkle', end: true },
  { to: '/trainer/sessions', label: 'Sessions', icon: 'calendarCheck' },
  { to: '/trainer/availability', label: 'Availability', icon: 'clock' },
  { to: '/trainer/profile', label: 'Profile', icon: 'user' },
  { to: '/trainer/messages', label: 'Messages', icon: 'mail' },
];

/** Shared shell for the trainer and admin portals (sidebar on desktop, drawer on mobile). */
export function PortalShell({ label, nav, home, children }: { label: string; nav: typeof NAV; home: string; children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    setMenu(false);
  }, [location.pathname]);
  const side = (
    <nav aria-label={label} className="flex flex-col gap-1">
      <div className="mb-2 px-3 text-[11px] font-bold tracking-[.16em] text-faint">DIVE-IN MENU</div>
      {nav.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] no-underline transition-colors ${isActive ? 'bg-gold-deep font-semibold text-gold' : 'text-chalk hover:bg-surface hover:text-text'}`}>
          <Icon name={n.icon} size={17} />
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
  return (
    <div className="min-h-screen bg-ink text-text">
      <header className="sticky top-0 z-[1000] border-b border-line-soft bg-[rgba(14,14,14,.88)] backdrop-blur-[14px]">
        <div className="flex h-[72px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-line-2 lg:hidden" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              <Icon name={menu ? 'close' : 'menu'} size={18} />
            </button>
            <Logo compact to={home} />
            <span className="hidden h-6 w-px bg-line-2 sm:block" />
            <span className="hidden text-sm font-bold sm:block">{label}</span>
          </div>
          <div className="flex items-center gap-2.5">
            {children}
            <span className="hidden text-right text-sm md:block">
              <span className="block max-w-[180px] truncate font-semibold">{user!.fullName}</span>
              <span className="block text-xs text-muted">{label}</span>
            </span>
            <button type="button" aria-label="Log out" className="grid h-10 w-10 place-items-center rounded-full border border-line-2" onClick={async () => { await logout(); navigate('/'); }}>
              <Icon name="logout" size={16} />
            </button>
          </div>
        </div>
      </header>
      <div className="flex">
        <aside className="sticky top-[72px] hidden h-[calc(100vh-72px)] w-[240px] flex-none overflow-y-auto border-r border-line-soft p-4 lg:block">{side}</aside>
        {menu && <div className="fixed inset-x-0 top-[72px] bottom-0 z-[900] overflow-y-auto bg-ink p-4 lg:hidden">{side}</div>}
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function TrainerLayout() {
  return (
    <PortalShell label="Trainer workspace" nav={NAV} home="/trainer">
      <NotificationBell />
    </PortalShell>
  );
}
