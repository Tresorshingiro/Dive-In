import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

/** Scrolls to #hash targets after navigation (waits for the section to mount), else to top. */
export function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0 });
      return;
    }
    let tries = 0;
    const id = decodeURIComponent(hash.slice(1));
    const t = setInterval(() => {
      const el = document.getElementById(id);
      if (el || ++tries > 20) {
        clearInterval(t);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
    return () => clearInterval(t);
  }, [pathname, hash]);
  return null;
}

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-ink text-text">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-full focus:bg-gold focus:px-4 focus:py-2 focus:text-gold-ink">
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
