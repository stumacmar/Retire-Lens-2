import { useEffect, useState } from 'react';

const fieldShell = 'flex items-center rounded-2xl px-4 h-[52px]';
const shellStyle = { background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' } as const;

/** Money input — large tap target, live commit, tabular figures. */
export function MoneyField({ label, value, onChange, prefix = '£' }: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string;
}) {
  const [text, setText] = useState(String(Math.round(value)));
  useEffect(() => { setText(String(Math.round(value))); }, [value]);
  return (
    <label className="block">
      <span className="block text-[0.8rem] font-semibold mb-1.5" style={{ color: 'var(--color-ink-dim)' }}>{label}</span>
      <div className={fieldShell} style={shellStyle}>
        <span className="text-[1.05rem] mr-1" style={{ color: 'var(--color-ink-faint)' }}>{prefix}</span>
        <input className="tnum w-full bg-transparent outline-none text-[1.15rem] font-semibold"
          inputMode="decimal" value={text}
          onChange={e => setText(e.target.value)}
          onBlur={() => onChange(parseFloat(text.replace(/[,£\s]/g, '')) || 0)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      </div>
    </label>
  );
}

/** Plain number (years, ages). */
export function NumField({ label, value, onChange, suffix }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string;
}) {
  const [text, setText] = useState(String(Math.round(value)));
  useEffect(() => { setText(String(Math.round(value))); }, [value]);
  return (
    <label className="block">
      <span className="block text-[0.8rem] font-semibold mb-1.5" style={{ color: 'var(--color-ink-dim)' }}>{label}</span>
      <div className={fieldShell} style={shellStyle}>
        <input className="tnum w-full bg-transparent outline-none text-[1.15rem] font-semibold"
          inputMode="numeric" value={text}
          onChange={e => setText(e.target.value)}
          onBlur={() => onChange(parseFloat(text.replace(/[^\d.-]/g, '')) || 0)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        {suffix && <span className="text-[0.9rem] ml-1" style={{ color: 'var(--color-ink-faint)' }}>{suffix}</span>}
      </div>
    </label>
  );
}

/** Percent input (stored as fraction, shown ×100). */
export function PctField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState((Math.round(value * 1000) / 10).toString());
  useEffect(() => { setText((Math.round(value * 1000) / 10).toString()); }, [value]);
  return (
    <label className="block">
      <span className="block text-[0.8rem] font-semibold mb-1.5" style={{ color: 'var(--color-ink-dim)' }}>{label}</span>
      <div className={fieldShell} style={shellStyle}>
        <input className="tnum w-full bg-transparent outline-none text-[1.15rem] font-semibold"
          inputMode="decimal" value={text}
          onChange={e => setText(e.target.value)}
          onBlur={() => onChange((parseFloat(text) || 0) / 100)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        <span className="text-[1rem] ml-1" style={{ color: 'var(--color-ink-faint)' }}>%</span>
      </div>
    </label>
  );
}

/** iOS-style switch. */
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full py-1.5">
      <span className="text-[0.95rem] font-medium text-left pr-3">{label}</span>
      <span className="relative shrink-0 rounded-full transition-colors" style={{
        width: 50, height: 30, background: checked ? 'var(--color-calm)' : 'var(--color-hairline)',
      }}>
        <span className="absolute top-[3px] rounded-full bg-white transition-all"
          style={{ width: 24, height: 24, left: checked ? 23 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ options, value, onChange, small }: {
  options: { value: T; label: string; sub?: string }[]; value: T; onChange: (v: T) => void; small?: boolean;
}) {
  return (
    <div className="flex gap-2">
      {options.map(o => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            className={`flex-1 rounded-2xl text-center transition-transform active:scale-[0.97] ${small ? 'py-2 px-1.5' : 'py-3 px-2'}`}
            style={{
              background: on ? 'var(--color-sage)' : 'var(--color-canvas)',
              color: on ? '#fff' : 'var(--color-ink)',
              border: '1px solid ' + (on ? 'var(--color-sage)' : 'var(--color-hairline)'),
            }}>
            <span className={`block font-bold ${small ? 'text-[0.78rem]' : 'text-[0.9rem]'}`}>{o.label}</span>
            {o.sub && <span className="block text-[0.7rem] opacity-80 tnum">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}
