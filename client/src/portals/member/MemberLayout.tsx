import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../../components/ui/Logo';
import { Icon } from '../../components/ui/Icon';
import { NotificationBell } from '../../components/NotificationBell';

const TABS = [
  { to: '/app', label: 'Overview', end: true },
  { to: '/app/cards', label: 'My cards' },
  { to: '/app/coaching', label: 'Coaching' },
  { to: '/app/messages', label: 'Messages' },
  { to: '/app/payments', label: 'Payments' },
  { to: '/gyms', label: 'Find gyms' },
  { to: '/coaches', label: 'Coaches' },
];

export default function MemberLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-ink text-text">
      <header className="sticky top-0 z-[1000] border-b border-line-soft bg-[rgba(14,14,14,.85)] backdrop-blur-[14px]">
        <div className="wrap flex h-[76px] items-center justify-between gap-4">
          <Logo to="/" />
          <nav className="hidden gap-[26px] xl:flex" aria-label="Member">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end} className="navlink">{t.label}</NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2.5">
            <NotificationBell />
            <span className="hidden text-right text-sm sm:block">
              <span className="block max-w-[160px] truncate font-semibold">{user!.fullName}</span>
              <span className="block text-xs text-muted">Member</span>
            </span>
            <button type="button" aria-label="Log out" className="grid h-11 w-11 place-items-center rounded-full border border-line-2 text-text" onClick={async () => { await logout(); navigate('/'); }}>
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
        <nav className="wrap scroll-hide flex gap-1 overflow-x-auto pb-3 xl:hidden" aria-label="Member">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab !h-10 shrink-0 no-underline ${isActive ? '!bg-text !text-[#111]' : ''}`}>{t.label}</NavLink>
          ))}
        </nav>
      </header>
      <main className="wrap py-10 sm:py-14">
        <Outlet />
      </main>
    </div>
  );
}
