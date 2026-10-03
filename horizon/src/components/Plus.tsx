import { useState, type ReactNode } from 'react';
import { Check, Lock, Sparkles, KeyRound, ExternalLink } from 'lucide-react';
import { PRODUCT, safeCheckoutUrl, type PlanId } from '../config/product';
import { useEntitlement } from '../lib/entitlement';

/** Header pill: a quiet invitation for free users, a quiet tick for Plus. */
export function PlusPill({ plus, onClick }: { plus: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={plus ? 'Someday Plus — active' : 'Get Someday Plus'}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.74rem] font-bold active:scale-[0.97] transition-transform"
      style={plus
        ? { background: 'color-mix(in srgb, var(--color-sage) 22%, var(--color-surface))', color: 'var(--color-sage-strong)', border: '1px solid transparent' }
        : { background: 'var(--color-surface)', color: 'var(--color-calm-strong)', border: '1px solid var(--color-hairline)' }}>
      {plus ? <Check size={13} strokeWidth={3} /> : <Sparkles size={13} />}
      {plus ? 'Plus' : 'Get Plus'}
    </button>
  );
}

/**
 * A locked section. Shows what is behind the lock in one honest line, with an
 * optional faded preview (e.g. the first rows of a table) so the value is
 * visible rather than asserted. Never a wall: the rest of the app keeps working.
 */
export function Locked({ title, line, onUpgrade, preview, compact }: {
  title: string; line: string; onUpgrade: () => void; preview?: ReactNode; compact?: boolean;
}) {
  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>
      {preview && (
        <div className="relative" aria-hidden="true">
          <div className="pointer-events-none select-none" style={{ maxHeight: 150, overflow: 'hidden' }}>{preview}</div>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 10%, var(--color-surface) 92%)' }} />
        </div>
      )}
      <div className={compact ? 'px-4 py-3' : 'px-4 pt-4 pb-4'}>
        <div className="flex items-center gap-2">
          <Lock size={14} style={{ color: 'var(--color-calm-strong)' }} />
          <span className="text-[0.9rem] font-bold">{title}</span>
          <span className="ml-auto rounded-full px-2 py-0.5 text-[0.66rem] font-bold uppercase tracking-wider"
            style={{ background: 'color-mix(in srgb, var(--color-calm) 18%, transparent)', color: 'var(--color-calm-strong)' }}>Plus</span>
        </div>
        <p className="mt-1 text-[0.82rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>{line}</p>
        <button onClick={onUpgrade}
          className="mt-3 rounded-2xl px-4 py-2.5 text-[0.86rem] font-bold text-white active:scale-[0.98] transition-transform"
          style={{ background: 'var(--color-calm)' }}>
          See what Plus adds
        </button>
      </div>
    </div>
  );
}

const INCLUDED: [string, string][] = [
  ['The adviser-ready report', 'A multi-page PDF of your whole plan, assumptions and year-by-year figures — built to take into a meeting.'],
  ['Every year, in full', 'Opening to closing for each year of retirement, per person or combined, with the tax paid.'],
  ['Tax, compared', 'Lifetime tax under each withdrawal order, and the Coach’s full set of grounded suggestions.'],
  ['Advanced detail', 'Multiple schemes, protected tax-free cash, the allowance taper and DB transfer values.'],
  ['Plan structure, measured', 'Tune the gilt ladder and spending rules, and see whether the structure earns its keep.'],
  ['The estate picture', 'What passes on, and the inheritance-tax exposure, as the rules change from 2027.'],
  ['Every April’s tax year', 'Thresholds, State Pension and Scottish bands refreshed each tax year, for as long as you’re on Plus.'],
];

function PlanCard({ id, onPick }: { id: PlanId; onPick: (url: string) => void }) {
  const p = PRODUCT.plans[id];
  const url = safeCheckoutUrl(id);
  const featured = id === 'annual';
  return (
    <div className="flex-1 rounded-3xl p-4 flex flex-col"
      style={{ background: featured ? 'color-mix(in srgb, var(--color-calm) 12%, var(--color-surface))' : 'var(--color-canvas)',
               border: '1px solid ' + (featured ? 'var(--color-calm)' : 'var(--color-hairline)') }}>
      <div className="text-[0.72rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-ink-faint)' }}>{p.label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="tnum text-[1.7rem] font-extrabold tracking-tight">{p.price}</span>
        <span className="text-[0.8rem]" style={{ color: 'var(--color-ink-dim)' }}>{p.per}</span>
      </div>
      <p className="mt-1 text-[0.78rem] leading-relaxed flex-1" style={{ color: 'var(--color-ink-dim)' }}>{p.blurb}</p>
      <button disabled={!url} onClick={() => url && onPick(url)}
        className="mt-3 w-full rounded-2xl py-2.5 text-[0.86rem] font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-50"
        style={{ background: featured ? 'var(--color-calm)' : 'var(--color-ink-dim)' }}>
        {url ? `Get ${p.label.toLowerCase()}` : 'Coming soon'}
      </button>
    </div>
  );
}

/** The Plus sheet: what it is, what it costs, and the key. */
export function PlusSheetBody() {
  const ent = useEntitlement();
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [done, setDone] = useState(false);

  const pick = (url: string) => { window.open(url, '_blank', 'noopener'); setShowKey(true); };
  const submit = async () => { if (await ent.activate(key)) { setDone(true); setKey(''); } };

  if (ent.plus && ent.licence) {
    const l = ent.licence;
    const exp = l.expiresAt ? new Date(l.expiresAt) : null;
    return (
      <div className="space-y-4 pb-2">
        <div className="rounded-3xl p-5" style={{ background: 'color-mix(in srgb, var(--color-sage) 16%, var(--color-surface))' }}>
          <div className="flex items-center gap-2" style={{ color: 'var(--color-sage-strong)' }}>
            <Check size={18} strokeWidth={3} /><span className="font-extrabold text-[1.05rem]">{PRODUCT.plusName} is on</span>
          </div>
          <p className="mt-1.5 text-[0.86rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
            {done ? 'Thank you. ' : ''}Everything is unlocked on this device{l.variantName ? ` (${l.variantName})` : ''}.
            {exp ? ` Renews or ends ${exp.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.` : ' Lifetime — no renewal.'}
          </p>
        </div>
        <div className="rounded-2xl p-4 text-[0.82rem] leading-relaxed" style={{ background: 'var(--color-canvas)', color: 'var(--color-ink-dim)' }}>
          <div className="font-semibold" style={{ color: 'var(--color-ink)' }}>Key ending …{l.key.slice(-6)}</div>
          Activated as “{l.instanceName}”. Checked quietly every {PRODUCT.licence.revalidateDays} days when online; works offline for {PRODUCT.licence.graceDays} days between checks.
          Moving to a new phone? Remove it here first, then enter the same key there.
        </div>
        <button onClick={() => void ent.remove()} disabled={ent.busy}
          className="w-full rounded-2xl py-3 font-semibold text-[0.9rem] disabled:opacity-50"
          style={{ background: 'var(--color-canvas)', color: 'var(--color-hope)', border: '1px solid var(--color-hairline)' }}>
          Remove from this device
        </button>
        <p className="text-center text-[0.75rem]" style={{ color: 'var(--color-ink-faint)' }}>
          Receipts, renewals and refunds are handled by Lemon Squeezy via the link in your receipt email.
          Questions: <a className="underline" href={`mailto:${PRODUCT.supportEmail}`}>{PRODUCT.supportEmail}</a>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-2">
      <p className="text-[0.95rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>
        The free Someday answers the question — when you can stop, on what, and how sure you can be.
        <b style={{ color: 'var(--color-ink)' }}> Plus</b> adds the depth you’d want before acting on it.
      </p>

      <div className="flex gap-3">
        <PlanCard id="annual" onPick={pick} />
        <PlanCard id="lifetime" onPick={pick} />
      </div>
      <p className="text-[0.74rem] text-center -mt-2" style={{ color: 'var(--color-ink-faint)' }}>
        Prices include VAT. Sold securely by Lemon Squeezy; your key arrives by email in a minute or two.
      </p>

      <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--color-canvas)' }}>
        {INCLUDED.map(([t, d], i) => (
          <div key={t} className="flex gap-3 px-4 py-3" style={{ borderTop: i ? '1px solid var(--color-hairline)' : 'none' }}>
            <Check size={16} strokeWidth={3} className="mt-0.5 shrink-0" style={{ color: 'var(--color-sage-strong)' }} />
            <div>
              <div className="text-[0.88rem] font-semibold">{t}</div>
              <div className="text-[0.78rem] leading-relaxed" style={{ color: 'var(--color-ink-dim)' }}>{d}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-hairline)' }}>
        <button onClick={() => setShowKey(s => !s)} className="flex items-center gap-2 w-full text-left font-semibold text-[0.92rem]">
          <KeyRound size={16} style={{ color: 'var(--color-calm-strong)' }} /> Already have a licence key?
        </button>
        {showKey && (
          <div className="mt-3">
            <input value={key} onChange={e => setKey(e.target.value)} placeholder="Paste your key, e.g. 1a2b3c4d-…"
              autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Licence key"
              onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
              className="w-full rounded-2xl px-4 h-[52px] text-[0.98rem] font-semibold outline-none tnum"
              style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-hairline)' }} />
            <button onClick={() => void submit()} disabled={ent.busy || !key.trim()}
              className="mt-2 w-full rounded-2xl py-3 font-bold text-white disabled:opacity-50 active:scale-[0.98] transition-transform"
              style={{ background: 'var(--color-calm)' }}>
              {ent.busy ? 'Checking…' : 'Activate on this device'}
            </button>
            {ent.error && <p role="alert" className="mt-2 text-[0.82rem] leading-relaxed" style={{ color: 'var(--color-hope)' }}>{ent.error}</p>}
            <p className="mt-2 text-[0.74rem] leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
              Activating sends only the key and a device label (“Safari on iPhone”) to Lemon Squeezy — never any of your figures.
            </p>
          </div>
        )}
      </div>

      <p className="text-center text-[0.75rem] leading-relaxed" style={{ color: 'var(--color-ink-faint)' }}>
        Not advice, with or without Plus.{' '}
        <a href={PRODUCT.legalUrl} target="_blank" rel="noopener" className="underline inline-flex items-center gap-0.5">
          Terms &amp; privacy <ExternalLink size={11} /></a>
      </p>
    </div>
  );
}
