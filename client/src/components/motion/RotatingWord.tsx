import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

/** Cycles through words every `interval` ms, sliding up. Static when reduced motion is on. */
export function RotatingWord({ words, interval = 2500, className }: { words: string[]; interval?: number; className?: string }) {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [reduce, interval, words.length]);

  // The invisible longest word reserves width so the line doesn't jump.
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), '');
  return (
    <span className={`relative inline-grid overflow-hidden align-bottom ${className ?? ''}`} style={{ height: '1em', lineHeight: 1 }}>
      <span className="invisible col-start-1 row-start-1" aria-hidden>
        {longest}
      </span>
      <span className="sr-only">{words[i]}</span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={words[i]}
          aria-hidden
          className="col-start-1 row-start-1 block text-gold"
          initial={{ y: '100%' }}
          animate={{ y: '0%' }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.75, ease: [0.7, 0, 0.2, 1] }}
        >
          {words[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
