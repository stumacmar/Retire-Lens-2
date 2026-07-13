import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';

/**
 * Glass bottom sheet. (HIG: materials + depth — a translucent layer over the
 * content, with a grabber and drag-to-dismiss.) Springy, interruptible motion.
 */
export default function Sheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title?: string; children: ReactNode;
}) {
  // Close on Escape (keyboard / a11y — surfaced by the UAT sweep).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          style={{ background: 'rgba(20,30,26,0.32)', backdropFilter: 'blur(3px)' }}
          onClick={onClose}
          role="dialog" aria-modal="true" aria-label={title}
        >
          <motion.div
            className="w-full sm:max-w-[520px] sm:m-4"
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
              boxShadow: '0 -12px 48px rgba(20,30,26,0.22)',
              paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom))',
            }}
          >
            <div className="mx-auto mt-2.5 mb-3 h-[5px] w-10 rounded-full"
                 style={{ background: 'var(--color-hairline)' }} />
            <div className="px-6 pt-1 max-h-[80vh] overflow-y-auto">
              {title && <h2 className="text-[1.35rem] font-bold tracking-tight mb-4">{title}</h2>}
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
