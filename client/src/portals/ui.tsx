import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { EASE_DIVE } from '../components/motion/Reveal';
import { Icon } from '../components/ui/Icon';

export function PageHead({ eyebrow, title, actions, children }: { eyebrow?: string; title: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
        <h1 className="disp m-0 text-[44px] sm:text-[60px]">{title}</h1>
        {children && <div className="mt-3 max-w-[640px] text-[15px] text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'gold' | 'warn' }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-bold tracking-[.12em] text-faint uppercase">{label}</div>
      <div className={`disp mt-3 text-[40px] ${tone === 'gold' ? 'text-gold' : tone === 'warn' ? 'text-warning' : ''}`}>{value}</div>
      {hint && <div className="mt-1 text-[13px] text-muted">{hint}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[1200] flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] border border-line-2 bg-ink p-6 sm:rounded-[28px] sm:p-8 ${wide ? 'max-w-[760px]' : 'max-w-[520px]'}`}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE_DIVE }}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <h2 className="disp m-0 text-[34px]">{title}</h2>
              <button type="button" onClick={onClose} className="grid h-10 w-10 flex-none place-items-center rounded-full border border-line-2 text-text" aria-label="Close">
                <Icon name="close" size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start justify-between gap-4 rounded-2xl border border-line bg-surface p-4 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span>
        <span className="block font-semibold">{label}</span>
        {hint && <span className="mt-1 block text-[13px] text-muted">{hint}</span>}
      </span>
      <span className="relative mt-0.5 flex-none">
        <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="block h-7 w-12 rounded-full bg-line-3 transition-colors peer-checked:bg-gold peer-focus-visible:outline-2 peer-focus-visible:outline-gold" />
        <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-text transition-transform peer-checked:translate-x-5 peer-checked:bg-gold-ink" />
      </span>
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-[22px] border border-dashed border-line-2 p-10 text-center text-muted">{children}</div>;
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">
      {message}
    </p>
  );
}

export function Skeleton({ h = 120 }: { h?: number }) {
  return <div className="animate-pulse rounded-[22px] bg-surface" style={{ height: h }} />;
}

/** Small "Saved" confirmation that fades out. */
export function Flash({ show, children = 'Saved' }: { show: boolean; children?: ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          <Icon name="check" size={15} strokeWidth={2.6} /> {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
