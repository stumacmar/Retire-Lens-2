import { useEffect, useState } from 'react';

/** A calm labelled input. Large tap target, live commit, tabular figures. */
export function MoneyField({ label, value, onChange, prefix = '£' }: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string;
}) {
  const [text, setText] = useState(String(Math.round(value)));
  useEffect(() => { setText(String(Math.round(value))); }, [value]);
  return (
    <label className="block">
      <span className="block text-[0.8rem] font-semibold mb-1.5" style={{ color: 'var(--color-ink-dim)' }}>{label}</span>
      <div className="flex items-center rounded-2xl px-4 h-[52px]"
           style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' }}>
        <span className="text-[1.05rem] mr-1" style={{ color: 'var(--color-ink-faint)' }}>{prefix}</span>
        <input
          className="tnum w-full bg-transparent outline-none text-[1.15rem] font-semibold"
          inputMode="decimal" value={text}
          onChange={e => setText(e.target.value)}
          onBlur={() => onChange(parseFloat(text.replace(/[,£\s]/g, '')) || 0)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
      </div>
    </label>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string; sub?: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map(o => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className="flex-1 rounded-2xl py-3 px-2 text-center transition-transform active:scale-[0.97]"
            style={{
              background: on ? 'var(--color-calm)' : 'var(--color-canvas)',
              color: on ? '#fff' : 'var(--color-ink)',
              border: '1px solid ' + (on ? 'var(--color-calm)' : 'var(--color-hairline)'),
            }}>
            <span className="block text-[0.9rem] font-bold">{o.label}</span>
            {o.sub && <span className="block text-[0.7rem] opacity-80 tnum">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}
