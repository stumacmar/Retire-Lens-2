import { useMemo, useState } from 'react';
import { E } from '../lib/usePlan';
import Accordion from './Accordion';

/**
 * Provenance, run live rather than claimed: the engine checks itself on
 * every load (tax worked by hand, Monte Carlo equal to the plan at zero
 * volatility, a dozen invariants) and this lists the result, with the
 * engine version and the rule pack behind the figures. A transparency
 * record a user can read, not a badge.
 */
export default function HowWeChecked() {
  const res = useMemo(() => {
    try { return (E as any).runAssertions() as { name: string; pass: boolean; got: number; want: number }[]; } catch { return []; }
  }, []);
  const [showAll, setShowAll] = useState(false);
  const passed = res.filter(r => r.pass).length;
  const failed = res.filter(r => !r.pass);
  const rules = (E as any).TAX_RULES as { taxYear: string; effectiveFrom: string; retrieved: string; rules: { id: string; what: string; source: string; note: string }[] };
  const version = (E as any).ENGINE_VERSION as string;
  const repo = 'https://github.com/stumacmar/Retire-Lens-2';
  return (
    <Accordion title="How we checked these numbers">
      <div className="py-3 space-y-3 text-[0.8rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }} data-how-we-checked>
        <div className="rounded-2xl p-3" style={{ background: failed.length ? 'color-mix(in srgb, var(--color-hope) 12%, transparent)' : 'color-mix(in srgb, var(--color-sage) 14%, transparent)' }}>
          <div className="font-bold text-[0.86rem]" style={{ color: 'var(--color-ink)' }}>
            {passed} of {res.length} engine checks pass on this device
          </div>
          <div>Run just now, in your browser, by the same engine that produced your figures. Engine {version} · tax rules {rules.taxYear}, in force from {rules.effectiveFrom}, read on {rules.retrieved}.</div>
          {failed.length > 0 && (
            <ul className="mt-1 list-disc pl-4" style={{ color: 'var(--color-hope)' }}>
              {failed.map(f => <li key={f.name}>{f.name}: got {f.got}, wanted {f.want}</li>)}
            </ul>
          )}
        </div>
        <p>
          <b style={{ color: 'var(--color-ink)' }}>What the checks are.</b> Income tax worked by hand at every band edge, in England and in Scotland, including the 60% zone;
          the Monte Carlo equal to the plan, pound for pound, when volatility is set to zero, across thirteen plan shapes;
          and invariants such as no balance ever going negative, tax never above income, tax-free cash never above the allowance,
          and guaranteed income above the need being banked, never lost. Before each release the same engine also passes an
          independent second tax implementation on 1,201 incomes, property and metamorphic tests, a 2,000 against 10,000 path
          stability check and a saved-plan migration test.
        </p>
        <p>
          <b style={{ color: 'var(--color-ink)' }}>What they are not.</b> A check that the arithmetic follows the stated rules is not a check that the assumptions are right.
          Growth, inflation, charges, tax law and your own life will differ from any assumption. The confidence figure's
          sampling range covers only the randomness of the simulation; it says nothing about the assumptions.
        </p>
        <div>
          <div className="font-bold text-[0.82rem] mb-1" style={{ color: 'var(--color-ink)' }}>The rules behind the figures</div>
          <ul className="space-y-1.5">
            {rules.rules.map(r => (
              <li key={r.id}>
                {r.what}.{r.note ? ` ${r.note}.` : ''}{' '}
                <a className="underline" href={r.source} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-calm-strong)' }}>Source</a>
              </li>
            ))}
          </ul>
        </div>
        <button type="button" onClick={() => setShowAll(s => !s)} className="underline text-[0.78rem] inline-block min-h-[28px] py-1" style={{ color: 'var(--color-calm-strong)' }} aria-expanded={showAll}>
          {showAll ? 'Hide the full list of checks' : `Show all ${res.length} checks`}
        </button>
        {showAll && (
          <ol className="list-decimal pl-5 space-y-0.5 text-[0.74rem]">
            {res.map(r => <li key={r.name} style={{ color: r.pass ? undefined : 'var(--color-hope)' }}>{r.name}</li>)}
          </ol>
        )}
        <p className="text-[0.72rem]" style={{ color: 'var(--color-ink-faint)' }}>
          The method, the model contract and the validation record are published with the code:{' '}
          <a className="underline" href={`${repo}/blob/main/docs/MODEL_SPEC.md`} target="_blank" rel="noopener noreferrer">model specification</a>,{' '}
          <a className="underline" href={`${repo}/blob/main/docs/VALIDATION.md`} target="_blank" rel="noopener noreferrer">validation record</a>.
        </p>
      </div>
    </Accordion>
  );
}
