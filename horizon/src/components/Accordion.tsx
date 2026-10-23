import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';

/**
 * Calm progressive disclosure — advanced controls stay tucked away until
 * wanted. Inside a card it is just another row: same type, same height, a
 * chevron instead of a figure. A card within a card reads as clutter.
 */
export default function Accordion({ title, children, defaultOpen = false }: {
  title: string; children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="-mx-4">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex items-center justify-between gap-3 w-full px-4 py-3 min-h-[56px] text-left">
        <span className="text-[0.92rem] leading-[1.3]" style={{ color: 'var(--color-calm-strong)' }}>{title}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0"
          style={{ color: 'var(--color-ink-faint)' }}><ChevronDown size={18} /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.7, 0.3, 1] }}
            style={{ overflow: 'hidden' }}>
            {/* The disclosed rows keep the card's rhythm, tinted a shade deeper
                so it is obvious they belong to the row that opened them. */}
            <div className="px-4 [&>*+*]:border-t [&>*+*]:border-[color:var(--color-hairline)]
                            [&>p]:py-3 [&>p]:text-[0.75rem] [&>p]:leading-[1.5]"
                 style={{ background: 'color-mix(in srgb, var(--color-ink) 3%, transparent)',
                          borderTop: '1px solid var(--color-hairline)' }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
