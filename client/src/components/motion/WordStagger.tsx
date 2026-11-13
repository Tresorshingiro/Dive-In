import { motion } from 'framer-motion';
import { Fragment, type ReactNode } from 'react';
import { EASE_DIVE } from './Reveal';

export const WORD_STAGGER = 0.13;

/**
 * Splits each line into words and fades them up one after another (130 ms apart).
 * A line can also be a ReactNode (e.g. the rotating word), which animates as one unit.
 */
export function WordStagger({
  lines,
  delay = 0.05,
  className,
}: {
  lines: Array<string | { node: ReactNode; className?: string } | { text: string; className?: string }>;
  delay?: number;
  className?: string;
}) {
  let i = 0;
  const word = (content: ReactNode, key: string, cls?: string) => {
    const d = delay + i++ * WORD_STAGGER;
    return (
      <motion.span
        key={key}
        className={`inline-block ${cls ?? ''}`}
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE_DIVE, delay: d }}
      >
        {content}
      </motion.span>
    );
  };

  return (
    <span className={className}>
      {lines.map((line, li) => {
        let parts: ReactNode[];
        if (typeof line === 'string' || 'text' in line) {
          const text = typeof line === 'string' ? line : line.text;
          const cls = typeof line === 'string' ? undefined : line.className;
          const words = text.split(' ');
          parts = words.map((w, wi) => (
            <Fragment key={wi}>
              {word(w, `${li}-${wi}`, cls)}
              {wi < words.length - 1 ? ' ' : null}
            </Fragment>
          ));
        } else {
          parts = [word(line.node, `${li}-n`, line.className)];
        }
        return (
          <Fragment key={li}>
            {parts}
            {li < lines.length - 1 ? <br /> : null}
          </Fragment>
        );
      })}
    </span>
  );
}
