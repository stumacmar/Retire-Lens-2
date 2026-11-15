import { useState } from 'react';
import type { MC } from '../engine/engine';
import { fmt } from '../lib/format';

/**
 * Ten lit windows: the detail behind the closing ring, for anyone who wants
 * to count. One house front, ten windows, each standing for ten of the 100
 * futures (two hundred of the 2,000 simulated). At the age shown:
 *
 * - a lit window (warm glow) is ten futures still paying the ask in full;
 * - the one boundary window glows partly for the remainder (72 → seven lit
 *   and one at 20%), so the picture never rounds up to certainty: only 100
 *   of 100 lights all ten;
 * - on a structured plan, a curtained window (glow behind a drawn curtain)
 *   is futures still paying after the rules trim spending;
 * - an unlit window is slate with a small lamp, never black: income has
 *   fallen below the ask, but it does not stop (the State Pension and any
 *   other guaranteed income carry on).
 *
 * Grouped icons are easier to count than scattered ones (Ancker et al. 2011);
 * ten large shapes can be counted at a glance where a hundred cannot. The
 * slider moves through the years; the sentence carries the exact count.
 */
export default function TenWindows({ mc, structured, ask }: { mc: MC | null; structured: boolean; ask: number }) {
  const held = mc?.perAgeHeld || [];
  const n = held.length;
  const [age, setAge] = useState<number | null>(null);
  if (!n) return <p className="text-[0.9rem] py-2" style={{ color: 'var(--color-ink-dim)' }}>Working out the futures…</p>;
  const first = held[0].age, last = held[n - 1].age;
  const shown = age ?? last, i = Math.max(0, Math.min(n - 1, shown - first));
  const full = Math.round(held[i].full * 100), rules = Math.max(full, Math.round(held[i].rules * 100));
  const lit = Math.floor(full / 10), part = (full % 10) / 10;
  const curtained = structured ? Math.max(0, Math.floor(rules / 10) - lit - (part > 0 ? 1 : 0)) : 0;
  const state = (w: number) => (w < lit ? 'lit' : w === lit && part > 0 ? 'part' : w < lit + (part > 0 ? 1 : 0) + curtained ? 'curtained' : 'slate');

  return (
    <div data-ten-windows data-age={shown} data-full={full} data-rules={rules}>
      <p className="text-[0.95rem] leading-snug" style={{ color: 'var(--color-ink)' }}>
        At <b>{shown}</b>, <b>{full} of 100</b> futures still pay {fmt(ask)} a month in full{structured && rules > full ? <>; <b>{rules}</b> still pay with your rules</> : ''}.
        Each window is ten futures. You cannot choose your window.
      </p>
      {/* The house front. */}
      <div className="mt-3 mx-auto rounded-2xl px-5 pt-6 pb-0 max-w-[320px]" style={{ background: 'color-mix(in srgb, var(--color-ink) 7%, var(--color-canvas))', border: '1px solid var(--color-hairline)' }}>
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 10 }, (_, w) => {
            const s = state(w);
            const glow = s === 'lit' ? 1 : s === 'part' ? Math.max(0.15, part) : 0;
            return (
              <div key={w} data-window={w} data-state={s} className="relative aspect-[46/66] rounded-t-[999px] rounded-b-md overflow-hidden"
                style={{ background: s === 'slate' ? 'var(--color-slate)' : 'color-mix(in srgb, var(--color-slate) 55%, var(--color-canvas))',
                  boxShadow: glow ? `0 0 ${Math.round(12 * glow)}px color-mix(in srgb, var(--color-ring) ${Math.round(60 * glow)}%, transparent)` : 'none' }}>
                {glow > 0 && <div className="absolute inset-0" style={{ background: 'var(--color-ring)', opacity: glow }} />}
                {s === 'curtained' && <>
                  <div className="absolute inset-0" style={{ background: 'var(--color-ring)', opacity: 0.55 }} />
                  <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'color-mix(in srgb, var(--color-canvas) 70%, var(--color-ring))' }} />
                </>}
                {s === 'slate' && <div className="absolute left-1/2 bottom-[18%] -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-ring)' }} />}
              </div>);
          })}
        </div>
        <div className="mx-auto mt-4 w-10 h-12 rounded-t-md" style={{ background: 'color-mix(in srgb, var(--color-ink) 18%, var(--color-canvas))' }} />
      </div>
      <div className="mt-4 flex items-center gap-3 text-[0.8rem] tnum" style={{ color: 'var(--color-ink-faint)' }}>
        <span>{first}</span>
        <input type="range" min={first} max={last} step={1} value={shown} onChange={e => setAge(Number(e.target.value))}
          aria-label="Age shown in the windows" aria-valuetext={`Age ${shown}: ${full} of 100 futures still pay in full`} className="flex-1 accent-[var(--color-ring)]" data-windows-range />
        <span>{last}</span>
      </div>
      <p className="mt-3 text-[0.78rem] leading-snug" style={{ color: 'var(--color-ink-faint)' }}>
        Lit: still paying what you ask in full.{structured ? ' Curtained: still paying once your rules trim spending.' : ''} Slate with a lamp: income has fallen below what you ask, but the State Pension and any other guaranteed income carry on. An estimate, not a guarantee.
      </p>
    </div>
  );
}
