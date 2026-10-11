import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Glass bottom sheet. (HIG: materials + depth — a translucent layer over the
 * content, with a grabber and drag-to-dismiss.) Springy, interruptible motion.
 * A modal dialog for keyboards and screen readers too: focus moves in on
 * open, stays inside (Tab wraps), and returns to the opener on close.
 */
export default function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement | null>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null);
      if (!items.length) { e.preventDefault(); panel.current.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.current.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    // Focus the panel itself (not the first field) so a sheet full of inputs
    // never pops a keyboard on open; Tab then goes to the close button.
    const t = setTimeout(() => panel.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      const back = opener.current as HTMLElement | null;
      if (back && typeof back.focus === 'function' && document.contains(back)) back.focus();
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          style={{ background: 'rgba(44,38,30,0.35)', backdropFilter: 'blur(3px)' }}
          onClick={onClose}
        >
          <motion.div
            ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title || 'Sheet'}
            className="w-full sm:max-w-[520px] sm:m-4 outline-none"
            onClick={e => e.stopPropagation()}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 700) onClose(); }}
            style={{
              background: 'color-mix(in srgb, var(--color-surface) 88%, transparent)',
              backdropFilter: 'saturate(180%) blur(26px)',
              WebkitBackdropFilter: 'saturate(180%) blur(26px)',
              borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
              boxShadow: '0 -12px 48px rgba(60,50,35,0.25)',
              paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom))',
            }}
          >
            <div className="mx-auto mt-2.5 mb-3 h-[5px] w-10 rounded-full"
                 style={{ background: 'var(--color-hairline)' }} />
            <div data-sheet-scroll className="px-6 pt-1 max-h-[80vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3 mb-4">
                {title ? <h2 className="text-[1.35rem] font-bold tracking-tight">{title}</h2> : <span />}
                <button type="button" onClick={onClose} aria-label="Close"
                  className="shrink-0 -mr-2 -mt-1 rounded-full flex items-center justify-center"
                  style={{ width: 44, height: 44, color: 'var(--color-ink-dim)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </div>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
