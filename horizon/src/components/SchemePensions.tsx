import { Plus, X } from 'lucide-react';
import { E } from '../lib/usePlan';
import type { DbTranche } from '../engine/engine';
import { MoneyField, NumField, PctField, Toggle, Segmented } from './Field';
import { fmt, fmtK, pct } from '../lib/format';

/**
 * Public-sector defined-benefit pensions, modelled as tranches: the legacy
 * final-salary slice (unreduced at 60 or 65) and the 2015 career-average
 * slice (unreduced at State Pension age), each taken at an age of the
 * member's choosing with the scheme's reduction or uplift, the automatic
 * lump sum where one exists, and optional commutation within the HMRC limit.
 * The engine owns the maths (E.trancheBenefits); this is the conversation.
 */
const FAMILIES = ['NHS', 'Teachers', 'LGPS', 'Civil Service', 'Police', 'Fire', 'Armed Forces', 'Other'];

export default function SchemePensions({ plan, who, set, compact, adv }: {
  plan: any; who: any; set: (patch: any) => void; compact?: boolean; adv?: boolean;
}) {
  const list: DbTranche[] = Array.isArray(who.dbSchemes) ? who.dbSchemes : [];
  const write = (next: DbTranche[]) => set({ dbSchemes: next });
  const add = () => write([...list, { id: 'db' + Date.now().toString(36), scheme: 'nhs2015', pension: 0, commutePct: 0 }]);
  const patch = (i: number, p: Partial<DbTranche>) => write(list.map((t, j) => j === i ? { ...t, ...p } : t));
  const remove = (i: number) => write(list.filter((_, j) => j !== i));
  const schemes = E.DB_SCHEMES as Record<string, any>;

  return (
    <div className="space-y-3">
      {list.map((t, i) => {
        const b = E.trancheBenefits(plan, who, t);
        const s = schemes[t.scheme] || schemes.custom;
        const clamped = (t.takeAge || b.npa) < b.minAge;
        const lumpOpts = [
          { value: '0', label: 'Standard', sub: fmtK(b.lumpMin) },
          { value: '0.5', label: 'Some extra', sub: fmtK((b.lumpMin + b.lumpMax) / 2) },
          { value: '1', label: 'Maximum', sub: fmtK(b.lumpMax) },
        ];
        const commuteKey = String(Math.min(1, Math.max(0, Number(t.commutePct) || 0)));
        return (
          <div key={t.id} className="rounded-2xl p-3 space-y-3" style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' }}>
            <div className="flex items-center gap-2">
              <select value={t.scheme || 'custom'} aria-label="Pension scheme"
                onChange={e => patch(i, { scheme: e.target.value, npa: undefined, takeAge: undefined })}
                className="flex-1 min-w-0 rounded-xl px-3 h-[44px] font-semibold text-[0.92rem] outline-none"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)', color: 'var(--color-ink)' }}>
                {FAMILIES.map(f => (
                  <optgroup key={f} label={f}>
                    {Object.entries(schemes).filter(([, v]) => v.family === f).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </optgroup>
                ))}
              </select>
              <button onClick={() => remove(i)} aria-label="Remove this pension" style={{ color: 'var(--color-ink-faint)' }}><X size={16} /></button>
            </div>
            <MoneyField label="Pension a year on your latest statement (today's money)" value={Number(t.pension) || 0} onChange={v => patch(i, { pension: v })} />
            <div className="grid grid-cols-2 gap-3 items-end">
              <NumField label="Take it from age" value={b.takeAge} onChange={v => patch(i, { takeAge: v })} />
              <div className="text-[0.78rem] leading-snug pb-2" style={{ color: 'var(--color-ink-dim)' }}>
                Unreduced at <b className="tnum">{b.npa}</b>{s.npa === 'spa' ? ' (State Pension age)' : ''}.
                {b.early > 0 && <> Taking it {b.early} year{b.early > 1 ? 's' : ''} early: about <b style={{ color: 'var(--color-hope)' }}>{pct(1 - b.factor, 0)} less</b>, for life.</>}
                {b.late > 0 && <> Taking it {b.late} year{b.late > 1 ? 's' : ''} late: about <b style={{ color: 'var(--color-sage-strong)' }}>{pct(b.factor - 1, 0)} more</b>.</>}
                {b.early === 0 && b.late === 0 && <> Taken at the scheme’s normal age.</>}
                {clamped && <> Earliest allowed is {b.minAge}.</>}
              </div>
            </div>
            <div>
              <span className="block text-[0.8rem] font-semibold mb-1.5" style={{ color: 'var(--color-ink-dim)' }}>Tax-free lump sum</span>
              <Segmented small value={commuteKey as '0' | '0.5' | '1'} onChange={v => patch(i, { commutePct: Number(v) })} options={lumpOpts as any} />
              <p className="mt-1.5 text-[0.78rem] leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
                You’d receive <b className="tnum" style={{ color: 'var(--color-ink)' }}>{fmt(Math.round(b.pension))}</b> a year, rising with prices,
                {b.lump > 0 ? <> plus <b className="tnum" style={{ color: 'var(--color-ink)' }}>{fmt(Math.round(b.lump))}</b> tax-free at {b.takeAge}.</> : ' and no lump sum.'}
                {b.autoMult > 0 ? ` The scheme pays ${b.autoMult}× pension automatically;` : ' The scheme pays no automatic lump sum;'} extra cash costs £{b.rate} of lump sum per £1 of pension given up, within the 25% limit.
              </p>
            </div>
            {!compact && <>
              <Toggle label="Still paying into it" checked={!!t.accruing} onChange={v => patch(i, { accruing: v })} />
              {t.accruing && <MoneyField label="Pensionable pay a year" value={Number(t.salary) || 0} onChange={v => patch(i, { salary: v })} />}
              {t.accruing && <p className="text-[0.76rem] -mt-1" style={{ color: 'var(--color-ink-faint)' }}>
                Adds {s.accrual < 0.01 ? `1/${Math.round(1 / s.accrual)}` : pct(s.accrual, 2)} of pay each year until you stop work{s.revalReal > 0 ? `, revalued at CPI + ${pct(s.revalReal, 2)} in service` : ''}.
                Built up to {fmt(Math.round(b.accrued))} a year by then.
              </p>}
              {adv && <div className="grid grid-cols-2 gap-3">
                <PctField label="Early reduction, per year" value={t.earlyRate != null ? Number(t.earlyRate) : s.earlyRate} onChange={v => patch(i, { earlyRate: v })} />
                <NumField label="Normal pension age" value={b.npa} onChange={v => patch(i, { npa: v })} />
              </div>}
              <p className="text-[0.74rem] leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
                {s.legacy
                  ? 'Deferred final-salary benefits keep pace with prices, so the statement figure holds its value in today’s money. '
                  : 'If you were in service between 2015 and 2022, use the remedy (McCloud) figures on your statement; the choice itself is made when you retire. '}
                Reduction factors are planning approximations of the scheme’s tables, which go by exact age and are revised from time to time.
              </p>
            </>}
          </div>
        );
      })}
      <button onClick={add} className="w-full flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[0.85rem] font-semibold"
        style={{ background: 'var(--color-canvas)', color: 'var(--color-calm-strong)', border: '1px dashed var(--color-hairline)' }}>
        <Plus size={15} /> {list.length ? 'Add another scheme pension' : 'Add an NHS, Teachers’, LGPS, Civil Service or other public-sector pension'}
      </button>
    </div>
  );
}
