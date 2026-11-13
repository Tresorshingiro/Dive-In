import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/** Infinite horizontal loop. Content is rendered twice and shifted by -50%. */
export function Marquee({ children, duration = 28, reverse = false, className }: { children: ReactNode; duration?: number; reverse?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={`flex w-max ${className ?? ''}`}
      animate={reduce ? undefined : { x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
      transition={{ duration, ease: 'linear', repeat: Infinity }}
    >
      <div className="flex shrink-0">{children}</div>
      <div className="flex shrink-0" aria-hidden>
        {children}
      </div>
    </motion.div>
  );
}
