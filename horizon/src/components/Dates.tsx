import { CalendarDays } from 'lucide-react';
import { E } from '../lib/usePlan';

/**
 * Dates that matter — the hidden deadlines in UK retirement, worked out from
 * the two birth years and the plan. Free, personal from the first screen, and
 * generated from rules (not typed in), so it never goes stale by itself.
 * Rules reflect legislation announced to October 2026; each line says why.
 */
interface Row { year: number; who: string; title: string; note: string; kind: 'you' | 'rule' }

function ageIn(year: number, birthYear: number) { return year - birthYear; }

export function datesThatMatter(plan: any): Row[] {
  const rows: Row[] = [];
  const A = plan.partnerA, B = plan.partnerB;
  const people = [A, B].filter(p => p && p.birthYear > 1900);
  const now = plan.startYear;
  const push = (r: Row) => { if (r.year >= now) rows.push(r); };

  for (const p of people) {
    // Minimum pension age: 55 now, 57 from 6 April 2028. Birth year only, so
    // anyone turning 55 before 2028 keeps 55; from 1973 on it is 57.
    const nmpa = p.birthYear <= 1972 ? 55 : 57;
    push({ year: p.birthYear + nmpa, who: p.name, kind: 'you',
      title: `${p.name} can first access pensions, at ${nmpa}`,
      note: nmpa === 55 ? 'Private pensions open from 55 — before the minimum age rises to 57 in April 2028.'
        : 'The minimum pension age rises from 55 to 57 on 6 April 2028, which catches anyone born from 1973.' });
    push({ year: p.birthYear + p.spAge, who: p.name, kind: 'you',
      title: `${p.name}’s State Pension starts, at ${p.spAge}`,
      note: 'Check the exact date and amount at gov.uk/check-state-pension. Deferring adds about 5.8% a year for life.' });
    // Public-sector scheme tranches: when each is unreduced, and when it is planned.
    for (const t of (p.dbSchemes || [])) {
      if (!t || !((Number(t.pension) || 0) > 0 || (t.accruing && t.salary > 0))) continue;
      let b: any = null;
      try { b = (E as any).trancheBenefits(plan, p, t); } catch { continue; }
      if (!b) continue;
      if (b.takeAge !== b.npa) {
        push({ year: b.takeYear, who: p.name, kind: 'you',
          title: `${p.name} takes the ${b.label} at ${b.takeAge}`,
          note: b.early > 0 ? `${b.early} year${b.early > 1 ? 's' : ''} before its normal age of ${b.npa}: about ${Math.round((1 - b.factor) * 100)}% less, for life${b.lump > 0 ? `, plus a lump sum` : ''}.`
            : `${b.late} year${b.late > 1 ? 's' : ''} after its normal age of ${b.npa}: about ${Math.round((b.factor - 1) * 100)}% more.` });
      }
      push({ year: p.birthYear + b.npa, who: p.name, kind: 'you',
        title: `${p.name}’s ${b.label} is unreduced from ${b.npa}`,
        note: b.takeAge === b.npa ? 'Planned to start here, at the scheme’s normal pension age — no reduction.' : 'The scheme’s normal pension age: the point at which no reduction applies.' });
    }
    push({ year: p.birthYear + 75, who: p.name, kind: 'you',
      title: `${p.name} turns 75`,
      note: 'The last tax year for pension tax relief, and after 75 any pension your beneficiaries inherit is taxed as their income.' });
  }
  push({ year: plan.retireYear, who: '', kind: 'you',
    title: `You stop work — ${A.name} at ${ageIn(plan.retireYear, A.birthYear)}${B?.birthYear ? `, ${B.name} at ${ageIn(plan.retireYear, B.birthYear)}` : ''}`,
    note: 'Your chosen date. Everything below the horizon line is measured from here.' });

  // Rule changes already announced.
  push({ year: 2027, who: '', kind: 'rule',
    title: 'April 2027 — unused pensions come into inheritance tax',
    note: 'From 6 April 2027 most unused pension funds count as part of the estate. Spending pensions first, or gifting, becomes a live question for larger estates.' });
  push({ year: 2027, who: '', kind: 'rule',
    title: 'April 2027 — cash ISA limit becomes £12,000 under 65',
    note: 'The overall £20,000 ISA allowance stays, but only £12,000 of it can go into cash ISAs if you are under 65 (announced in the Autumn Budget 2025).' });
  push({ year: 2028, who: '', kind: 'rule',
    title: 'April 2028 — minimum pension age rises to 57',
    note: 'The age you can first draw a private pension moves from 55 to 57 on 6 April 2028.' });
  push({ year: 2031, who: '', kind: 'rule',
    title: 'April 2031 — the income tax threshold freeze is due to end',
    note: 'The personal allowance (£12,570) and higher-rate threshold (£50,270) are frozen until then, so more of each year’s income drifts into tax meanwhile.' });

  rows.sort((a, b) => a.year - b.year || (a.kind === 'you' ? -1 : 1));
  return rows;
}

export default function Dates({ plan }: { plan: any }) {
  const rows = datesThatMatter(plan);
  if (!rows.length) return null;
  return (
    <div>
      <h3 className="text-[0.72rem] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-ink-faint)' }}>
        <CalendarDays size={13} /> Dates that matter
      </h3>
      <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--color-canvas)' }}>
        {rows.map((r, i) => (
          <div key={i} className="flex gap-3 px-4 py-3" style={{ borderTop: i ? '1px solid var(--color-hairline)' : 'none' }}>
            <div className="tnum shrink-0 w-[3.1rem] text-[0.95rem] font-extrabold tracking-tight"
                 style={{ color: r.kind === 'you' ? 'var(--color-calm-strong)' : 'var(--color-ink-faint)' }}>{r.year}</div>
            <div className="min-w-0">
              <div className="text-[0.88rem] font-semibold leading-snug">{r.title}</div>
              <div className="mt-0.5 text-[0.76rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>{r.note}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[0.72rem] mt-1.5" style={{ color: 'var(--color-ink-faint)' }}>
        Worked out from your birth years and the rules announced to date. Birth years only, so dates near a 6 April boundary may differ by a year.
      </p>
    </div>
  );
}
