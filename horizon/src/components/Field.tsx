import { useEffect, useId, useState } from 'react';

/**
 * The form language.
 *
 * Every input is a ROW, not a slab: the question on the left in reading-weight
 * type, the figure on the right in bold tabular numerals, hairline-divided
 * inside a card (see Group). It reads like a statement you are correcting
 * rather than a form you are filling, which is both denser and calmer — you
 * can see eight figures at once instead of two, and the numbers line up so a
 * wrong order of magnitude is obvious at a glance.
 */

// A label that ends in a parenthetical aside carries it on a second, quieter
// line — "State Pension a year (today's money)" should not be four words of
// bold wrap beside its figure.
//
// Two conditions, both of which matter: the bracket must CLOSE the label
// (otherwise "Workplace pension (defined contribution) today" would lose its
// tail), and it must contain more than one word. A single bracketed word is
// part of the phrase, not an aside — "…starts in (year)" and "Pension already
// accessed (crystallised)" read as nonsense once the brackets are stripped.
function splitLabel(label: string): [string, string | undefined] {
  const m = /^(.+?)\s*\(([^()]*)\)$/.exec(label);
  if (!m || m[1].length <= 2 || !/\s/.test(m[2].trim())) return [label, undefined];
  return [m[1], m[2]];
}

const ROW = 'flex items-center justify-between gap-3 w-full py-3 min-h-[56px] text-left';

/**
 * The card every row lives in. Children keep their own markup — the card
 * supplies the inset and the hairlines — so prose, segmented controls and
 * accordions all land on one grid without each needing to know about it.
 */
export const CARD_ROWS = `rounded-[20px] overflow-hidden [&>*]:px-4
  [&>*+*]:border-t [&>*+*]:border-[color:var(--color-hairline)]
  [&>p]:py-3 [&>p]:text-[0.75rem] [&>p]:leading-[1.5]
  [&>div[role=group]]:py-3 [&>span]:block [&>span]:py-3`;

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`${CARD_ROWS} ${className}`}
         style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' }}>
      {children}
    </div>
  );
}

/** A name, on the same row as every figure. */
export function TextField({ label, value, placeholder, onChange }: {
  label: string; value: string; placeholder?: string; onChange: (v: string) => void;
}) {
  return (
    <label className={ROW}>
      <span className="min-w-0 flex-1 text-[0.92rem] leading-[1.3]" style={{ color: 'var(--color-ink)' }}>{label}</span>
      <input value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        className="shrink-0 w-[46%] bg-transparent outline-none rounded-xl px-2 py-1 -mr-2 text-right
                   text-[1.05rem] font-bold transition-colors
                   focus:bg-[color-mix(in_srgb,var(--color-calm)_16%,transparent)]" />
    </label>
  );
}

// Every input validates on commit: a value outside [min, max] is clamped and
// said so in one line under the question, so a slip never becomes a silent
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

/** Left-hand side of a row: the question, and its aside or error beneath. */
function Ask({ id, label, msg, hint }: { id: string; label: string; msg: string | null; hint?: string }) {
  const [head, aside] = splitLabel(label);
  const sub = msg || hint || aside;
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-[0.92rem] leading-[1.3]" style={{ color: 'var(--color-ink)' }}>{head}</span>
      {sub && (
        <span id={id} role={msg ? 'alert' : undefined}
          className="block text-[0.73rem] leading-snug mt-0.5"
          style={{ color: msg ? 'var(--color-hope)' : 'var(--color-ink-faint)' }}>{sub}</span>
      )}
    </span>
  );
}

/** Right-hand side: the figure itself, flush right, sized to its digits. */
const valueWrap = (bad: boolean) =>
  `flex items-baseline shrink-0 rounded-xl px-2 py-1 -mr-2 transition-colors
   focus-within:bg-[color-mix(in_srgb,var(--color-calm)_16%,transparent)]
   ${bad ? 'bg-[color-mix(in_srgb,var(--color-hope)_12%,transparent)]' : ''}`;
const valueInput = 'tnum bg-transparent outline-none text-right text-[1.05rem] font-bold';
const chars = (t: string) => `${Math.max(2, t.length) + 0.4}ch`;

/** Money input — the figure reads as money, right-aligned and tabular. */
export function MoneyField({ label, value, onChange, prefix = '£', min = 0, max = 1e9, hint }: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string; min?: number; max?: number; hint?: string;
}) {
  const id = useId();
  const [text, setText] = useState(Math.round(value).toLocaleString('en-GB'));
  useEffect(() => { setText(Math.round(value).toLocaleString('en-GB')); }, [value]);
  const { msg, commit } = useCommit(value, min, max, onChange);
  return (
    <label className={ROW}>
      <Ask id={id} label={label} msg={msg} hint={hint} />
      <span className={valueWrap(!!msg)}>
        <span className="text-[0.95rem] mr-0.5" style={{ color: 'var(--color-ink-faint)' }} aria-hidden="true">{prefix}</span>
        <input className={valueInput} style={{ width: chars(text), color: msg ? 'var(--color-hope)' : 'var(--color-ink)' }}
          inputMode="decimal" value={text} aria-invalid={!!msg} aria-describedby={id}
          onChange={e => setText(e.target.value)}
          onBlur={() => { const t = text.replace(/[,£\s]/g, ''); const v = commit(t === '' ? 0 : parseFloat(t)); setText(Math.round(v).toLocaleString('en-GB')); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      </span>
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
    <label className={ROW}>
      <Ask id={id} label={label} msg={msg} hint={hint} />
      <span className={valueWrap(!!msg)}>
        <input className={valueInput} style={{ width: chars(text), color: msg ? 'var(--color-hope)' : 'var(--color-ink)' }}
          inputMode="numeric" value={text} aria-invalid={!!msg} aria-describedby={id}
          onChange={e => setText(e.target.value)}
          onBlur={() => { const t = text.replace(/[^\d.-]/g, ''); const v = commit(t === '' ? 0 : parseFloat(t)); setText(String(Math.round(v))); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        {suffix && <span className="text-[0.9rem] ml-0.5" style={{ color: 'var(--color-ink-faint)' }}>{suffix}</span>}
      </span>
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
    <label className={ROW}>
      <Ask id={id} label={label} msg={msg} hint={hint} />
      <span className={valueWrap(!!msg)}>
        <input className={valueInput} style={{ width: chars(text), color: msg ? 'var(--color-hope)' : 'var(--color-ink)' }}
          inputMode="decimal" value={text} aria-invalid={!!msg} aria-describedby={id}
          onChange={e => setText(e.target.value)}
          onBlur={() => { const v = commit(text.trim() === '' ? 0 : parseFloat(text) / 100); setText(show(v)); }}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
        <span className="text-[0.95rem] ml-0.5" style={{ color: 'var(--color-ink-faint)' }} aria-hidden="true">%</span>
      </span>
    </label>
  );
}

/** iOS-style switch, on the same row rhythm as every other question. */
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const [head, aside] = splitLabel(label);
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={ROW}>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.92rem] leading-[1.3]" style={{ color: 'var(--color-ink)' }}>{head}</span>
        {aside && <span className="block text-[0.73rem] leading-snug mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>{aside}</span>}
      </span>
      <span className="relative shrink-0 rounded-full transition-colors" style={{
        width: 48, height: 29,
        background: checked ? 'var(--color-calm)' : 'color-mix(in srgb, var(--color-ink) 16%, transparent)',
      }}>
        <span className="absolute top-[2.5px] rounded-full transition-all"
          style={{ width: 24, height: 24, left: checked ? 21.5 : 2.5, background: '#fff',
                   boxShadow: '0 1px 3px rgba(60,50,35,0.28), 0 0 0 0.5px rgba(60,50,35,0.06)' }} />
      </span>
    </button>
  );
}

/**
 * A true segmented control: one recessed track, the choice riding on a raised
 * pill. Four separate coloured buttons read as four decisions; this reads as
 * one, which is what it is.
 */
export function Segmented<T extends string>({ options, value, onChange, small, label }: {
  options: { value: T; label: string; sub?: string }[]; value: T; onChange: (v: T) => void; small?: boolean; label?: string;
}) {
  return (
    <div className="flex gap-1 rounded-[14px] p-1" role="group" aria-label={label}
         style={{ background: 'color-mix(in srgb, var(--color-ink) 6%, transparent)' }}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={on}
            className={`flex-1 min-w-0 rounded-[11px] text-center transition-all active:scale-[0.97] min-h-[40px] ${small ? 'py-1.5 px-1' : 'py-2 px-1.5'}`}
            style={{
              background: on ? 'var(--color-canvas)' : 'transparent',
              color: on ? 'var(--color-ink)' : 'var(--color-ink-dim)',
              boxShadow: on ? '0 1px 2px rgba(60,50,35,0.14), 0 2px 8px rgba(60,50,35,0.07)' : 'none',
            }}>
            <span className={`block leading-[1.2] ${on ? 'font-bold' : 'font-semibold'} ${small ? 'text-[0.78rem]' : 'text-[0.85rem]'}`}>{o.label}</span>
            {o.sub && <span className="block text-[0.66rem] tnum leading-tight mt-0.5" style={{ color: 'var(--color-ink-faint)' }}>{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}
