import type { MC } from '../engine/engine';

/**
 * The years strip: one bar for every year after work stops, as tall as the
 * number of simulated futures still paying that year.
 *
 *   Futures still paying in full                     69 of 100 at 90
 *   ▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▮▯▯▯▯▯▯▯▯▯▯
 *   60              First shortfalls at 77                       90
 *
 * It answers two questions a percentage cannot: how sure, and from when.
 * A count out of 100 drawn as a picture is the format people with little
 * numeracy read most accurately (icon-array and quantile-dotplot research);
 * putting it on the plan's own timeline keeps it self-explanatory.
 *
 * The heights are `mc.perAgeHeld`: the share of futures paid every year up to
 * and including that one. It never rises, and its last value IS the futures
 * count in the sentence underneath, so the picture and the number cannot
 * disagree.
 *
 * A structured plan is designed to trim spending in bad years, so its bars
 * have two layers: dark for futures paid in full so far, lighter above for
 * futures still paying once the rules have trimmed. The total is the share
 * its status rests on.
 *
 * One colour, in ink. Only the last bar, the year the count refers to, takes
 * the colour of the status.
 */
export default function YearsStrip({ mc, structured, fromAge, toAge, accent }: {
  mc: MC | null; structured: boolean; fromAge: number; toAge: number; accent: string;
}) {
  const held = mc?.perAgeHeld;
  const years = held && held.length ? held.map(h => ({ age: h.age, of100: Math.round((structured ? h.rules : h.full) * 100), full: Math.min(Math.round(h.full * 100), Math.round((structured ? h.rules : h.full) * 100)) }))
    : Array.from({ length: Math.max(1, toAge - fromAge + 1) }, (_, i) => ({ age: fromAge + i, of100: -1, full: -1 }));
  const ready = !!(held && held.length);
  const first = years[0], last = years[years.length - 1];
  const drop = ready ? years.find(y => y.of100 < 100) : undefined;
  const what = structured ? 'Futures still paying, with your rules' : 'Futures still paying in full';
  const trimFrom = ready && structured ? years.find(y => y.full < y.of100) : undefined;
  const label = !ready ? 'Working out the futures, year by year.'
    : `${what}, year by year, of 100 simulated futures. ${drop ? `The first fall short at age ${drop.age}.` : 'All 100 in every year.'} ${last.of100} of 100 at age ${last.age}.${structured ? ` Paid in full every year so far: ${last.full} of 100 at age ${last.age}${trimFrom ? `, with the first trims at age ${trimFrom.age}` : ''}.` : ''}`;
  const gap = years.length > 44 ? 1 : 2;

  return (
    <div data-years-strip data-ready={ready ? '1' : '0'} role="img" aria-label={label} className="mt-3 [@media(max-height:700px)]:mt-2 select-none">
      <div className="flex items-baseline justify-between gap-3 text-[0.74rem] leading-none" style={{ color: 'var(--color-ink-faint)' }}>
        <span>{what}</span>
        <span className="tnum shrink-0" data-strip-end>
          {ready ? <><b className="text-[0.86rem]" style={{ color: accent }}>{last.of100}</b> of 100 at {last.age}</> : '…'}
        </span>
      </div>
      {/* The rule along the top is the full hundred; a bar that stops short of it has lost futures. */}
      <div className="mt-1.5 flex items-end h-[46px] [@media(max-height:700px)]:h-[34px]" style={{ gap, borderTop: '1px solid var(--color-ink-faint)' }}>
        {years.map((y, i) => (
          <div key={y.age} data-bar data-age={y.age} data-share={y.of100} data-full={y.full} className="relative flex-1 h-full" style={{ background: 'var(--color-dusk)' }}>
            {structured && <div className="absolute inset-x-0 bottom-0 strip-fill" style={{ height: ready ? `${y.of100}%` : '0%', minHeight: ready && y.of100 > 0 ? 2 : 0,
              background: i === years.length - 1 ? accent : 'color-mix(in srgb, var(--color-ink) 42%, var(--color-dusk))' }} />}
            <div className="absolute inset-x-0 bottom-0 strip-fill" style={{ height: ready ? `${structured ? y.full : y.of100}%` : '0%', minHeight: ready && (structured ? y.full : y.of100) > 0 ? 2 : 0,
              background: !structured && i === years.length - 1 ? accent : 'var(--color-ink)' }} />
          </div>))}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2 text-[0.74rem] leading-none tnum" style={{ color: 'var(--color-ink-faint)' }}>
        <span>{first.age}</span>
        <span data-strip-drop style={{ color: 'var(--color-ink-dim)' }}>{!ready ? '' : structured ? (trimFrom ? `Dark: in full. Lighter: trimmed, from ${trimFrom.age}` : drop ? `First shortfalls at ${drop.age}` : 'In full in every one of them')
          : drop ? `First shortfalls at ${drop.age}` : 'No shortfalls in any of them'}</span>
        <span>{last.age}</span>
      </div>
    </div>
  );
}
