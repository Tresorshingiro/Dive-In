import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { ROLE_HOME } from '@dive/shared';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../ui/Logo';
import { Icon } from '../ui/Icon';

const LINKS = [
  { to: '/gyms', label: 'Find gyms', page: true },
  { to: '/coaches', label: 'Coaches', page: true },
  { to: '/#partners', label: 'For gyms' },
  { to: '/about', label: 'About', page: true },
  { to: '/contact', label: 'Contact', page: true },
];

export function Navbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-[1000] border-b border-line-soft bg-[rgba(14,14,14,.78)] backdrop-blur-[14px]">
      <div className="wrap flex h-[76px] items-center justify-between gap-6">
        <Logo />
        <nav className="hidden gap-[34px] lg:flex" aria-label="Main">
          {LINKS.map((l) =>
            l.page ? (
              <NavLink key={l.to} to={l.to} className="navlink">
                {l.label}
              </NavLink>
            ) : (
              <Link key={l.to} to={l.to} className="navlink">
                {l.label}
              </Link>
            ),
          )}
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <Link to={ROLE_HOME[user.role]} className="btn btn-gold !h-11">
              My dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost hidden !h-11 lg:inline-flex">
                Log in
              </Link>
              <Link to="/register" className="btn btn-gold !h-11 !px-5 sm:!px-6">
                Get started
              </Link>
            </>
          )}
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full border border-line-2 text-text lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name={open ? 'close' : 'menu'} size={20} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-menu"
            aria-label="Mobile"
            className="absolute inset-x-0 top-[76px] h-[calc(100dvh-76px)] overflow-y-auto border-t border-line-soft bg-ink px-5 pb-10 pt-6 lg:hidden"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <ul className="flex flex-col">
              {LINKS.map((l, i) => (
                <motion.li key={l.to} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }}>
                  <Link to={l.to} className="disp block border-b border-line-soft py-4 text-[40px] text-text no-underline">
                    {l.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
            {!user && (
              <div className="mt-8 flex flex-col gap-3">
                <Link to="/login" className="btn btn-ghost w-full">
                  Log in
                </Link>
                <Link to="/register" className="btn btn-gold w-full">
                  Get started
                </Link>
              </div>
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
