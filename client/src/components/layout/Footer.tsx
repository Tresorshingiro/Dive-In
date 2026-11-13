import { Link } from 'react-router';

const COLS = [
  {
    title: 'Members',
    links: [
      { to: '/gyms', label: 'Find gyms' },
      { to: '/coaches', label: 'Coaches' },
      { to: '/#card', label: 'Membership card' },
    ],
  },
  {
    title: 'Partners',
    links: [
      { to: '/register?role=GYM_OWNER', label: 'List your gym' },
      { to: '/login', label: 'Gym portal login' },
      { to: '/login', label: 'Trainer login' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About DIVE-IN' },
      { to: '/contact', label: 'Contact' },
      { to: '/contact#faq', label: 'Terms & privacy' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line-soft pt-14 pb-10">
      <div className="wrap">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="disp text-[32px]">
              Dive-In<span className="text-gold">.</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-dim">
              Discover · Book · Pay · Train.
              <br />
              Kigali, Rwanda.
            </p>
          </div>
          {COLS.map((c) => (
            <div key={c.title} className="flex flex-col gap-3 text-sm">
              <span className="font-bold text-text">{c.title}</span>
              {c.links.map((l) => (
                <Link key={l.label} to={l.to} className="text-muted no-underline transition-colors hover:text-text">
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap justify-between gap-4 border-t border-line-soft pt-6 text-[13px] text-faint">
          <span>© {new Date().getFullYear()} DIVE-IN Fitness Hub</span>
          {/* The only public entry point to the admin login */}
          <Link to="/admin/login" className="text-faint no-underline hover:text-muted">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
