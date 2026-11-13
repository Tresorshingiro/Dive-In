import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { Logo } from '../../components/ui/Logo';
import { Photo } from '../../components/ui/Photo';
import { EASE_DIVE } from '../../components/motion/Reveal';
import { WordStagger } from '../../components/motion/WordStagger';

/** Split layout for login/register: form left, photo + headline right. */
export function AuthShell({ title, children, side = 'Find your gym. Dive in.', image = '/images/gym-1.webp' }: { title: ReactNode; children: ReactNode; side?: string; image?: string }) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-ink text-text lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-16">
        <Logo />
        <motion.div
          className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center py-12"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_DIVE }}
        >
          <h1 className="disp m-0 mb-8 text-[52px] sm:text-[64px]">{title}</h1>
          {children}
        </motion.div>
      </div>
      <div className="relative hidden p-4 lg:block">
        <Photo src={image} alt="" caption="Photo · gym floor" className="sticky top-4 h-[calc(100vh-32px)] rounded-[32px]" eager>
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="absolute right-10 bottom-10 left-10">
            <div className="eyebrow mb-4">Discover · Book · Pay · Train</div>
            <p className="disp m-0 text-[72px]">
              <WordStagger delay={0.3} lines={side.split('. ').map((s, i, a) => (i < a.length - 1 ? `${s}.` : s))} />
            </p>
          </div>
        </Photo>
      </div>
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="mb-5 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
      {message}
    </p>
  );
}
