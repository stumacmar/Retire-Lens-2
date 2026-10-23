import { Card } from './Field';

/** A titled card of questions — the unit a carousel pane is built from. */
export default function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section>
      {title && <h3 className="text-[0.76rem] font-bold tracking-wide mb-2 px-1" style={{ color: 'var(--color-ink-faint)' }}>{title}</h3>}
      <Card>{children}</Card>
    </section>
  );
}
