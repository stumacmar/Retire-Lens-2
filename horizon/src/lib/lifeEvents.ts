/**
 * Life events along the way, read from the central case (the deterministic
 * drawdown's rows), for the tunnel on the home: the moments an income
 * starts, something runs out, a partner stops work, or one of the plan's
 * own events happens. Ages are the first person's age that year.
 *
 * Only what changes after the day work stops is listed: anything already
 * paying on day one is part of the starting point, not an event.
 */
export type LifeEvent = { age: number; label: string; kind: 'in' | 'out' | 'life' };

const startsAt = (rows: any[], key: string) => {
  for (let i = 1; i < rows.length; i++) if (!(rows[i - 1][key] > 1) && rows[i][key] > 1) return rows[i].ageA as number;
  return null;
};
const endsAt = (rows: any[], pick: (r: any) => number) => {
  for (let i = 1; i < rows.length; i++) if (pick(rows[i - 1]) > 1000 && pick(rows[i]) <= 1) return rows[i].ageA as number;
  return null;
};

export function lifeEvents(plan: any, dd: { rows?: any[] } | null | undefined): LifeEvent[] {
  const rows = dd?.rows || [];
  if (rows.length < 2) return [];
  const single = plan.household === 'single';
  const nameB = (plan.partnerB?.name && !/^(partner|your partner)$/i.test(plan.partnerB.name)) ? `${plan.partnerB.name}'s` : "Your partner's";
  const out: LifeEvent[] = [];
  const add = (age: number | null, label: string, kind: LifeEvent['kind']) => { if (age != null) out.push({ age, label, kind }); };
  add(startsAt(rows, 'spA'), 'State Pension starts', 'in');
  if (!single) add(startsAt(rows, 'spB'), `${nameB} State Pension starts`, 'in');
  const lostB = single ? null : rows.find((r: any, i: number) => i > 0 && rows[i - 1].aliveB && !r.aliveB)?.ageA ?? null;
  const dbA = startsAt(rows, 'dbA');
  add(dbA, dbA != null && dbA === lostB ? `${nameB.replace(/'s$/, '')}'s survivor pension to you`.replace("Your partner's survivor", "A survivor's") : 'Scheme pension starts', 'in');
  if (!single) add(startsAt(rows, 'dbB'), `${nameB} scheme pension starts`, 'in');
  if (!single) {
    for (let i = 1; i < rows.length; i++) if ((rows[i - 1].salaryB || 0) > 1 && !((rows[i].salaryB || 0) > 1)) { add(rows[i].ageA, `${nameB.replace(/'s$/, '')} stops work`, 'life'); break; }
    add(lostB, 'Planning for one from here', 'life');
  }
  add(endsAt(rows, r => (r.isaA || 0) + (r.isaB || 0)), 'ISAs used up', 'out');
  add(endsAt(rows, r => (r.potA || 0) + (r.potB || 0)), 'Pots used up', 'out');
  // The plan's own events (a car, a wedding, a downsizing). The engine's own
  // label for a partner's planned death is left out: the line above says it.
  for (const r of rows.slice(1)) for (const l of (r.eventLabels || [])) if (l && !/\b(dies|death)\b/i.test(String(l))) add(r.ageA, String(l), 'life');
  return out.sort((a, b) => a.age - b.age);
}
