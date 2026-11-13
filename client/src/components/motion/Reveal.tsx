import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ElementType } from 'react';

export const EASE_DIVE = [0.2, 0.7, 0.2, 1] as const;

type Tag = 'div' | 'section' | 'article' | 'li' | 'p' | 'h2' | 'h3' | 'a' | 'span' | 'header';

type Props = HTMLMotionProps<'div'> & {
  as?: Tag;
  delay?: number;
  /** Lift -8px on hover (pair with the `hover-gold` class for the gold border). */
  lift?: boolean;
  /** How far it travels up while fading in. */
  y?: number;
  href?: string;
};

/** Fades up once when scrolled into view. */
export function Reveal({ as = 'div', delay = 0, lift = false, y = 28, children, ...rest }: Props) {
  const Comp = motion[as] as ElementType;
  return (
    <Comp
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.8, ease: EASE_DIVE, delay }}
      {...(lift ? { whileHover: { y: -8, transition: { duration: 0.4, ease: EASE_DIVE } } } : {})}
      {...rest}
    >
      {children}
    </Comp>
  );
}
