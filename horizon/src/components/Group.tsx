/** A titled band of related controls. Shared so every editor looks the same. */
export default function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[0.72rem] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-ink-faint)' }}>{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
