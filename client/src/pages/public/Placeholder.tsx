import { Link, useParams } from 'react-router';
import { Reveal } from '../../components/motion/Reveal';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

/** Gym profile placeholder until Phase 3. */
export function GymProfileSoon() {
  const { slug = '' } = useParams();
  const name = slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  useDocumentTitle(name || 'Gym');
  return (
    <section className="py-28">
      <Reveal className="wrap max-w-[760px] text-center">
        <div className="eyebrow mb-4">Gym profile</div>
        <h1 className="disp m-0 text-[56px] sm:text-[88px]">{name}</h1>
        <p className="lead mx-auto mt-6 max-w-[520px]">Full gym profiles with packages, trainers and checkout arrive in Phase 3 (member portal).</p>
        <Link to="/#gyms" className="btn btn-gold mt-8">
          Back to gyms
        </Link>
      </Reveal>
    </section>
  );
}

export function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <section className="py-28">
      <Reveal className="wrap text-center">
        <div className="disp text-[140px] text-gold sm:text-[200px]">404</div>
        <p className="lead mx-auto max-w-[420px]">This page took a wrong turn somewhere in Kigali.</p>
        <Link to="/" className="btn btn-gold mt-8">
          Go home
        </Link>
      </Reveal>
    </section>
  );
}
