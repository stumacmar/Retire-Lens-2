import { useEffect, useId, useState } from 'react';

const fieldShell = 'flex items-center rounded-2xl px-4 h-[52px]';
const shellStyle = { background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' } as const;
const badStyle = { background: 'var(--color-canvas)', border: '1.5px solid var(--color-hope)' } as const;

// Every input validates on commit: a value outside [min, max] is clamped and
// said so in one line under the field, so a slip never becomes a silent
// wrong plan. Non-numbers fall back to the previous value, never to zero.
function useCommit(value: number, min: number, max: number, onChange: (v: number) => void) {
  const [msg, setMsg] = useState<string | null>(null);
  const commit = (parsed: number) => {
    if (!Number.isFinite(parsed)) { setMsg('Please enter a number.'); return value; }
    if (parsed < min) { setMsg(`Minimum ${min.toLocaleString('en-GB')}.`); onChange(min); return min; }
    if (parsed > max) { setMsg(`Maximum ${max.toLocaleString('en-GB')}.`); onChange(max); return max; }
    setMsg(null); onChange(parsed); return parsed;
  };
  return { msg, commit };
}

function Hint({ id, msg, hint }: { id: string; msg: string | null; hint?: string }) {
  if (!msg && !hint) return null;
  return (
    <span id={id} className="block text-[0.72rem] mt-1 leading-snug" role={msg ? 'alert' : undefined}
      style={{ color: msg ? 'var(--color-hope)' : 'var(--color-ink-faint)' }}>{msg || hint}</span>
  );
}

/** Money input — large tap target, live commit, tabular figures. */
export function MoneyField({ label, value, onChange, prefix = '£', min = 0, max = 1e9, hint }: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string; min?: number; max?: number; hint?: string;
}) {
  const id = useId();
  const [text, setText] = useState(Math.round(value).toLocaleString('en-GB'));
  useEffect(() => { setText(Math.round(value).toLocaleString('en-GB')); }, [value]);
  const { msg, commit } = useCommit(value, min, max, onChange);
  return (
    <label className="block">
      <span className="block text-[0.8rem] font-semibold mb-1.5" style={{ color: 'var(--color-ink-dim)' }}>{label}</span>
      <div className={fieldShell} style={msg ? badStyle : shellStyle}>
        <span className="text-[1.05rem] mr-1" style={{ color: 'var(--color-ink-faint)' }} aria-hidden="true">{prefix}</span>
        <input className="tnum w-full bg-transparent outline-none text-[1.15rem] font-semibold"
          inputMode="decimal" value={text} aria-invalid={!!msg} aria-describedby={msg || hint ? id : undefined}
          onChange={e => setText(e.target.value)}
          onBlur={() => { const t = text.replace(/[,£\s]/g, ''); const v = commit(t === '' ? 0 : parseFloat(t)); setText(Math.round(v).toLocaleString('en-GB')); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      </div>
      <Hint id={id} msg={msg} hint={hint} />
    </label>
  );
}

/** Plain number (years, ages). */
export function NumField({ label, value, onChange, suffix, min = 0, max = 1e6, hint }: {
  label: string; value: number; onChange: (v: number) => void; suffix?: string; min?: number; max?: number; hint?: string;
}) {
  const id = useId();
  const [text, setText] = useState(String(Math.round(value)));
  useEffect(() => { setText(String(Math.round(value))); }, [value]);
  const { msg, commit } = useCommit(value, min, max, onChange);
  return (
    <label className="block">
      <span className="block text-[0.8rem] font-semibold mb-1.5" style={{ color: 'var(--color-ink-dim)' }}>{label}</span>
      <div className={fieldShell} style={msg ? badStyle : shellStyle}>
        <input className="tnum w-full bg-transparent outline-none text-[1.15rem] font-semibold"
          inputMode="numeric" value={text} aria-invalid={!!msg} aria-describedby={msg || hint ? id : undefined}
          onChange={e => setText(e.target.value)}
          onBlur={() => { const t = text.replace(/[^\d.-]/g, ''); const v = commit(t === '' ? 0 : parseFloat(t)); setText(String(Math.round(v))); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        {suffix && <span className="text-[0.9rem] ml-1" style={{ color: 'var(--color-ink-faint)' }}>{suffix}</span>}
      </div>
      <Hint id={id} msg={msg} hint={hint} />
    </label>
  );
}

/** Percent input (stored as fraction, shown ×100). */
export function PctField({ label, value, onChange, min = -0.1, max = 1, hint }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; hint?: string;
}) {
  const id = useId();
  const show = (v: number) => (Math.round(v * 1000) / 10).toString();
  const [text, setText] = useState(show(value));
  useEffect(() => { setText(show(value)); }, [value]);
  const { msg, commit } = useCommit(value, min, max, onChange);
  return (
    <label className="block">
      <span className="block text-[0.8rem] font-semibold mb-1.5" style={{ color: 'var(--color-ink-dim)' }}>{label}</span>
      <div className={fieldShell} style={msg ? badStyle : shellStyle}>
        <input className="tnum w-full bg-transparent outline-none text-[1.15rem] font-semibold"
          inputMode="decimal" value={text} aria-invalid={!!msg} aria-describedby={msg || hint ? id : undefined}
          onChange={e => setText(e.target.value)}
          onBlur={() => { const v = commit(text.trim() === '' ? 0 : parseFloat(text) / 100); setText(show(v)); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        <span className="text-[1rem] ml-1" style={{ color: 'var(--color-ink-faint)' }} aria-hidden="true">%</span>
      </div>
      <Hint id={id} msg={msg} hint={hint} />
    </label>
  );
}

/** iOS-style switch. */
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full py-1.5 min-h-[44px]">
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

export function Segmented<T extends string>({ options, value, onChange, small, label }: {
  options: { value: T; label: string; sub?: string }[]; value: T; onChange: (v: T) => void; small?: boolean; label?: string;
}) {
  return (
    <div className="flex gap-2" role="group" aria-label={label}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={on}
            className={`flex-1 rounded-2xl text-center transition-transform active:scale-[0.97] min-h-[44px] ${small ? 'py-2 px-1.5' : 'py-3 px-2'}`}
            style={{
              background: on ? 'var(--color-sage-strong)' : 'var(--color-canvas)',
              color: on ? '#fff' : 'var(--color-ink)',
              border: '1px solid ' + (on ? 'var(--color-sage-strong)' : 'var(--color-hairline)'),
            }}>
            <span className={`block font-bold ${small ? 'text-[0.78rem]' : 'text-[0.9rem]'}`}>{o.label}</span>
            {o.sub && <span className="block text-[0.7rem] opacity-90 tnum">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}
