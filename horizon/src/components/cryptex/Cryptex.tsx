import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import type { Drawdown, MC } from '../../engine/engine';
import { deflate, fmt, fmtK } from '../../lib/format';
import { useInsight } from '../../lib/useInsight';
import { monthRows, type DecisionMap, type Rail } from '../../lib/insights';
import Ring, { type RingFace } from './Ring';
import Dawn from './Dawn';

/**
 * Someday as a cryptex. Two rings on one axis, each rolled up and down like a
 * combination lock. The lower ring is the code — the six pieces of your plan;
 * set each one and the code fills in. The upper ring is the view — six ways
 * of seeing the same answer. Set all six and the cryptex opens: the rims
 * light, the sun clears the horizon, and the view turns to the answer.
 *
 * Which pieces are set lives on the plan (plan.codeSet), so it survives a
 * reload and travels with an exported plan.
 */
const PIECES = ['you', 'someday', 'pensions', 'savings', 'promised', 'later'] as const;
type PieceId = typeof PIECES[number];

const thisYear = new Date().getFullYear();

// ── Small parts ─────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step, fmt: f, note, onChange }: {
  label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; note?: string; onChange: (v: number) => void;
}) {
  const fill = ((Math.min(max, Math.max(min, value)) - min) / (max - min)) * 100;
  return (
    <label className="block pt-1.5">
      <span className="flex justify-between items-baseline gap-2 text-[0.78rem]" style={{ color: 'var(--cx-dim)' }}>
        <span className="min-w-0">{label}{note && <span style={{ color: 'var(--cx-faint)' }}> · {note}</span>}</span>
        <span className="cx-serif text-[1.25rem] leading-none shrink-0" style={{ color: 'var(--cx-ink)' }}>{f(value)}</span>
      </span>
      <input type="range" className="cx-range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))}
        style={{ '--fill': `${fill.toFixed(1)}%` } as React.CSSProperties}
        onChange={e => onChange(Number(e.target.value))} aria-label={label} />
    </label>
  );
}
function Seg<T extends string | boolean>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="grid gap-[3px] p-[3px] rounded-xl mt-1" role="group" aria-label={label}
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)`, background: 'rgba(255,255,255,.06)' }}>
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          className="rounded-[9px] min-h-[34px] text-[0.8rem]"
          style={{ background: value === v ? 'rgba(255,255,255,.13)' : 'transparent', color: value === v ? 'var(--cx-ink)' : 'var(--cx-dim)' }}>{l}</button>
      ))}
    </div>
  );
}
function FaceHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-2 mb-1">
      <span className="cx-serif text-[1.45rem] leading-none" style={{ color: 'var(--cx-ink)' }}>{title}</span>
      {right}
    </div>
  );
}
const Small = ({ children }: { children: React.ReactNode }) =>
  <span className="text-[0.66rem] tracking-[0.18em] uppercase" style={{ color: 'var(--cx-faint)' }}>{children}</span>;

// ── The cryptex ─────────────────────────────────────────────────────────
export default function Cryptex({ plan, update, dd, mc, viz, header, onDetails }: {
  plan: any; update: (p: any) => void; dd: Drawdown; mc: MC | null;
  viz: { base: [number, number][]; low: [number, number][]; high: [number, number][] };
  header?: React.ReactNode; onDetails: () => void;
}) {
  const A = plan.partnerA, B = plan.partnerB, single = plan.household === 'single';
  const setA = (patch: any) => update((p: any) => ({ ...p, partnerA: { ...p.partnerA, ...patch } }));
  const setB = (patch: any) => update((p: any) => ({ ...p, partnerB: { ...p.partnerB, ...patch } }));
  const codeSet: string[] = Array.isArray(plan.codeSet) ? plan.codeSet : [];
  const isSet = (id: PieceId) => codeSet.includes(id);
  const nSet = PIECES.filter(isSet).length, unlocked = nSet === PIECES.length;
  const [viewI, setViewI] = useState(0), [codeI, setCodeI] = useState(() => Math.max(0, PIECES.findIndex(id => !codeSet.includes(id))));
  const [turn, setTurn] = useState(0);

  // Expensive figures, off the main thread.
  const railsKey = useMemo(() => JSON.stringify({ ...plan, targetNet: 0, codeSet: null, spendingPlanOn: false }), [plan]);
  const rails = useInsight<Rail[]>('guardrails', plan, railsKey);
  const mapKey = useMemo(() => JSON.stringify({ ...plan, retireYear: 0, targetNet: 0, codeSet: null, spendingPlanOn: false }), [plan]);
  const edge = useInsight<DecisionMap>('map', plan, mapKey, 300);

  const month = Math.round((plan.targetNet || 0) / 12);
  const lasts = dd.exhaustedAgeA == null;
  const base = rails?.find(r => r.key === 'base');
  const hasMoney = (A.pension + A.isa + (single ? 0 : B.pension + B.isa) + (plan.cash || 0) + A.monthlyPension) > 0;

  // ── The six pieces of the code ────────────────────────────────────────
  const setPiece = (id: PieceId) => {
    if (isSet(id)) return;
    update((p: any) => ({ ...p, codeSet: Array.from(new Set([...(Array.isArray(p.codeSet) ? p.codeSet : []), id])) }));
    const next = PIECES.findIndex(x => x !== id && !codeSet.includes(x));
    if (next >= 0) setTimeout(() => setCodeI(next), 320);
  };
  const SetBtn = ({ id }: { id: PieceId }) => (
    <button type="button" onClick={() => setPiece(id)} aria-pressed={isSet(id)}
      className="text-[0.74rem] font-semibold tracking-wide rounded-full px-3 min-h-[30px]"
      style={isSet(id) ? { border: '1px solid var(--cx-edge)', color: 'var(--cx-faint)' }
        : { border: '1px solid rgba(220,192,140,.6)', background: 'rgba(220,192,140,.14)', color: 'var(--cx-gold)' }}>
      {isSet(id) ? 'Set ✓' : 'Set this piece'}
    </button>
  );
  const pair = (a: React.ReactNode, b: React.ReactNode) => single ? a : <div className="grid grid-cols-2 gap-x-3">{a}{b}</div>;
  const year = (v: number) => String(v);
  const code: RingFace[] = [
    { key: 'you', name: 'You', set: isSet('you'), node: <>
      <FaceHead title="You" right={<SetBtn id="you" />} />
      <Seg label="Who the plan is for" value={single ? 'single' : 'couple'} onChange={v => update({ household: v })}
        options={[['couple', 'The two of us'], ['single', 'Just me']]} />
      {pair(
        <Slider label="Born" note={`${thisYear - A.birthYear} now`} value={A.birthYear} min={1935} max={2000} step={1} fmt={year} onChange={v => setA({ birthYear: v })} />,
        <Slider label="They were born" note={`${thisYear - B.birthYear}`} value={B.birthYear} min={1935} max={2000} step={1} fmt={year} onChange={v => setB({ birthYear: v })} />)}
    </> },
    { key: 'someday', name: 'Someday', set: isSet('someday'), node: <>
      <FaceHead title="Someday" right={<SetBtn id="someday" />} />
      <Slider label="Stop work in" note={`at ${plan.retireYear - A.birthYear}`} value={plan.retireYear} min={plan.startYear + 1} max={plan.startYear + 20} step={1} fmt={year}
        onChange={v => update({ retireYear: v })} />
      <Slider label="Take home a month" note="today's money" value={month} min={800} max={15000} step={50} fmt={fmt}
        onChange={v => update({ targetNet: v * 12, spendingPlanOn: false })} />
    </> },
    { key: 'pensions', name: 'Pensions', set: isSet('pensions'), node: <>
      <FaceHead title="Pensions" right={<SetBtn id="pensions" />} />
      {pair(
        <Slider label={single ? 'Your pensions' : 'Your pot'} value={A.pension} min={0} max={2500000} step={5000} fmt={fmtK} onChange={v => setA({ pension: v, pots: [], tfcRate: 0.25 })} />,
        <Slider label="Their pot" value={B.pension} min={0} max={2500000} step={5000} fmt={fmtK} onChange={v => setB({ pension: v, pots: [], tfcRate: 0.25 })} />)}
      <Slider label="Still paying in, a month" value={A.monthlyPension} min={0} max={6000} step={25} fmt={fmt} onChange={v => setA({ monthlyPension: v })} />
    </> },
    { key: 'savings', name: 'Savings', set: isSet('savings'), node: <>
      <FaceHead title="Savings" right={<SetBtn id="savings" />} />
      {pair(
        <Slider label={single ? 'ISAs' : 'Your ISAs'} value={A.isa} min={0} max={1500000} step={5000} fmt={fmtK} onChange={v => setA({ isa: v })} />,
        <Slider label="Their ISAs" value={B.isa} min={0} max={1500000} step={5000} fmt={fmtK} onChange={v => setB({ isa: v })} />)}
      <Slider label="Cash and Premium Bonds" value={plan.cash || 0} min={0} max={500000} step={1000} fmt={fmtK} onChange={v => update({ cash: v })} />
    </> },
    { key: 'promised', name: 'Promised', set: isSet('promised'), node: <>
      <FaceHead title="Promised" right={<SetBtn id="promised" />} />
      {pair(
        <Slider label={single ? 'State Pension a year' : 'Your State Pension'} value={A.spAmount} min={0} max={13000} step={50} fmt={fmt} onChange={v => setA({ spAmount: v })} />,
        <Slider label="Theirs" value={B.spAmount} min={0} max={13000} step={50} fmt={fmt} onChange={v => setB({ spAmount: v })} />)}
      {pair(
        <Slider label={single ? 'Company pension a year' : 'Your company pension'} value={A.db} min={0} max={60000} step={250} fmt={fmt}
          onChange={v => setA({ db: v, dbStartYear: v > 0 && !(A.db > 0) ? plan.retireYear : A.dbStartYear })} />,
        <Slider label="Theirs" value={B.db} min={0} max={60000} step={250} fmt={fmt}
          onChange={v => setB({ db: v, dbStartYear: v > 0 && !(B.db > 0) ? plan.retireYear : B.dbStartYear })} />)}
    </> },
    { key: 'later', name: 'Later life', set: isSet('later'), node: <>
      <FaceHead title="Later life" right={<SetBtn id="later" />} />
      <Seg label="How spending changes" value={plan.phase2On ? 'gogo' : plan.phase1On ? 'slowgo' : 'nogo'}
        onChange={v => update(v === 'gogo' ? { phase1On: true, phase2On: true } : v === 'slowgo' ? { phase1On: true, phase2On: false } : { phase1On: false, phase2On: false })}
        options={[['gogo', 'Go-go'], ['slowgo', 'Slow-go'], ['nogo', 'Steady']]} />
      <Slider label="Plan to age" value={plan.horizonAge} min={Math.max(70, plan.retireYear - A.birthYear + 1)} max={105} step={1} fmt={year} onChange={v => update({ horizonAge: v })} />
      <button type="button" onClick={onDetails} className="mt-2 flex items-center gap-1.5 text-[0.76rem]" style={{ color: 'var(--cx-faint)' }}>
        <SlidersHorizontal size={13} /> Everything else — schemes, tax, structure — is in Details
      </button>
    </> },
  ];

  // ── The six views ─────────────────────────────────────────────────────
  const r0 = (dd.rows as any[])[0];
  const M = (v: number) => (r0 ? deflate(v || 0, r0.year, plan.startYear, plan.inflation) / 12 : 0);
  const rows = monthRows(plan, dd, (v, y) => deflate(v, y, plan.startYear, plan.inflation)).filter(r => !r.working);
  const total = rows.length * 12, unpaid = rows.reduce((a, r) => a + r.unpaid, 0), gtd = rows.reduce((a, r) => a + r.guaranteed, 0);
  const holds = mc ? (mc.successProb >= 0.975 ? 'over 95%' : `about ${Math.round(mc.successProb * 20) * 5}%`) : null;
  const view: RingFace[] = [
    { key: 'answer', name: 'The answer', node: (
      <div className="h-full flex flex-col">
        <FaceHead title="The answer" right={<Small>{unlocked ? 'unlocked' : `${nSet} of 6 set`}</Small>} />
        <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ textShadow: '0 1px 14px rgba(0,0,0,.6)' }}>
          {hasMoney ? <>
            <div className="cx-serif leading-[.95]" style={{ fontSize: 'clamp(2.8rem, 14vw, 4.1rem)' }}>{fmt(month)}</div>
            <div className="text-[0.66rem] tracking-[0.2em] uppercase mt-1.5" style={{ color: 'var(--cx-dim)' }}>a month, for life</div>
            <p className="mt-3 text-[0.86rem]" style={{ color: 'var(--cx-dim)' }}>
              {lasts ? <b style={{ color: 'var(--cx-sage)' }}>Lasts into your {Math.floor(plan.horizonAge / 10) * 10}s.</b>
                : <b style={{ color: 'var(--cx-rose)' }}>Runs short at {dd.exhaustedAgeA}.</b>}
              {base && <> Could stretch to {fmt(base.year / 12)}.</>}
              {holds && <><br />Holds in {holds} of simulated futures.</>}
            </p>
          </> : <>
            <div className="cx-serif text-[3rem] leading-none" style={{ color: 'var(--cx-faint)' }}>—</div>
            <p className="mt-3 text-[0.86rem]" style={{ color: 'var(--cx-dim)' }}>Set your pensions and savings on the code ring below.</p>
          </>}
        </div>
      </div>) },
    { key: 'payslip', name: 'Payslip', node: r0 && (<>
      <FaceHead title="Payslip" right={<Small>{r0.year}, a month</Small>} />
      {([['State Pension', M(r0.spA + r0.spB)], ['Company pension', M(r0.dbA + r0.dbB)], ['From pensions', M(r0.grossA + r0.grossB)],
        ['Tax-free cash', M(r0.tfcA + r0.tfcB)], ['From ISAs and savings', M((r0.isaDraw || 0) + (r0.cashDraw || 0) + (r0.giaDraw || 0))]] as [string, number][])
        .filter(l => l[1] >= 1).map(([k, v]) => (
          <div key={k} className="flex justify-between py-[3px] text-[0.8rem]" style={{ color: 'var(--cx-dim)', borderBottom: '1px solid var(--cx-edge-soft)' }}>
            <span>{k}</span><span className="cx-serif text-[1.05rem]" style={{ color: 'var(--cx-ink)' }}>{fmt(v)}</span></div>))}
      <div className="flex justify-between py-[3px] text-[0.8rem]" style={{ color: 'var(--cx-dim)' }}>
        <span>Income tax</span><span className="cx-serif text-[1.05rem]" style={{ color: 'var(--cx-rose)' }}>−{fmt(M(r0.tax))}</span></div>
      <div className="flex justify-between items-baseline mt-1 pt-1.5" style={{ borderTop: '1px solid rgba(220,192,140,.45)' }}>
        <span className="text-[0.66rem] tracking-[0.18em] uppercase" style={{ color: 'var(--cx-gold)' }}>Take home</span>
        <span className="cx-serif text-[1.7rem] leading-none" style={{ color: 'var(--cx-gold-hi)' }}>{fmt(M(r0.netIncome))}</span></div>
    </>) },
    { key: 'months', name: 'Your months', node: (<>
      <FaceHead title="Your months" right={<Small>to {plan.horizonAge}</Small>} />
      <p className="text-[0.78rem] mb-2" style={{ color: 'var(--cx-dim)' }}>
        {total} months from stopping. {unpaid ? <b style={{ color: 'var(--cx-rose)' }}>{total - unpaid} paid for, {unpaid} not.</b>
          : <b style={{ color: 'var(--cx-sage)' }}>All {total} paid for.</b>} Guaranteed pensions cover <b style={{ color: 'var(--cx-ink)' }}>{gtd}</b>.</p>
      <svg viewBox={`0 0 300 ${12 * 7.4}`} className="block w-full h-auto" role="img" aria-label={`${total} months, one square each`}>
        {rows.map((r, c) => Array.from({ length: 12 }, (_, m) => {
          const cw = 300 / Math.max(1, rows.length), fill = m < r.guaranteed ? 'var(--cx-gold)' : m < 12 - r.unpaid ? 'rgba(143,180,209,.55)' : 'none';
          return <rect key={`${c}-${m}`} x={c * cw + 0.6} y={m * 7.4 + 0.6} width={Math.max(0.5, cw - 1.2)} height={6.2} rx={1}
            fill={fill} stroke={fill === 'none' ? 'var(--cx-rose)' : undefined} strokeWidth={0.6} />;
        }))}
      </svg>
      <p className="mt-2 flex gap-3 flex-wrap text-[0.72rem]" style={{ color: 'var(--cx-dim)' }}>
        <span><span style={{ color: 'var(--cx-gold)' }}>■</span> guaranteed</span><span><span style={{ color: 'var(--cx-cool)' }}>■</span> your pots</span>
        <span><span style={{ color: 'var(--cx-rose)' }}>□</span> not paid</span></p>
    </>) },
    { key: 'horizon', name: 'The horizon', node: (() => {
      const all = [...viz.high, ...viz.base], max = Math.max(1, ...all.map(d => d[1]));
      const y0 = viz.base[0]?.[0] ?? plan.startYear, y1 = viz.base[viz.base.length - 1]?.[0] ?? y0 + 1, W = 300, H = 132;
      const X = (y: number) => ((y - y0) / Math.max(1, y1 - y0)) * W, Y = (v: number) => H - 12 - (Math.max(0, v) / max) * (H - 22);
      const path = (s: [number, number][]) => s.map((d, i) => `${i ? 'L' : 'M'}${X(d[0]).toFixed(1)},${Y(d[1]).toFixed(1)}`).join('');
      const band = path(viz.high) + viz.low.slice().reverse().map(d => `L${X(d[0]).toFixed(1)},${Y(d[1]).toFixed(1)}`).join('') + 'Z';
      return <>
        <FaceHead title="The horizon" right={<Small>what you have</Small>} />
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label={`Wealth from ${y0} to ${y1}, today's money`}>
          <path d={band} fill="rgba(220,192,140,.14)" /><path d={path(viz.base)} fill="none" stroke="var(--cx-gold)" strokeWidth={2.4} />
          <line x1={X(plan.retireYear)} x2={X(plan.retireYear)} y1={6} y2={H - 12} stroke="rgba(255,255,255,.35)" strokeDasharray="2 3" />
          <text x={X(plan.retireYear) + 4} y={14} fontSize={10} fill="var(--cx-dim)">stop {plan.retireYear}</text>
          <text x={0} y={H - 1} fontSize={10} fill="var(--cx-faint)">{y0}</text><text x={W} y={H - 1} fontSize={10} fill="var(--cx-faint)" textAnchor="end">{y1}</text>
        </svg>
        <p className="text-[0.74rem] mt-1" style={{ color: 'var(--cx-dim)' }}>Gold: base returns. Band: poor to good. Today's money.</p>
      </>; })() },
    { key: 'fall', name: 'How far it could fall', node: (<>
      <FaceHead title="How far it could fall" right={<Small>safe a month</Small>} />
      {!rails ? <p className="text-[0.8rem]" style={{ color: 'var(--cx-dim)' }}>Working it out…</p> : (() => {
        const list = rails.filter(r => r.key !== 'good'), max = Math.max(month * 1.1, ...list.map(r => r.year / 12)) * 1.04;
        return <div className="relative grid gap-[5px] mt-1">
          {list.map(r => { const v = r.year / 12, ok = month <= v + 0.5; return (
            <div key={r.key}><div className="flex justify-between text-[0.72rem]" style={{ color: 'var(--cx-dim)' }}><span>{r.label}</span>
              <b className="cx-serif text-[0.92rem]" style={{ color: ok ? 'var(--cx-sage)' : 'var(--cx-rose)' }}>{fmt(v)}</b></div>
              <div className="h-[4px] rounded mt-[2px]" style={{ background: 'rgba(255,255,255,.08)' }}>
                <div className="h-full rounded" style={{ width: `${(v / max * 100).toFixed(1)}%`, background: ok ? 'var(--cx-sage)' : 'var(--cx-rose)', opacity: 0.7 }} /></div></div>); })}
          <div className="absolute top-0 bottom-0 w-[1.5px]" style={{ left: `${(month / max * 100).toFixed(1)}%`, background: 'var(--cx-gold)' }} />
        </div>; })()}
    </>) },
    { key: 'edge', name: 'The edge', node: (<>
      <FaceHead title="The edge" right={<Small>every retirement</Small>} />
      {!edge ? <p className="text-[0.8rem]" style={{ color: 'var(--cx-dim)' }}>Working out every retirement…</p> : (() => {
        const W = 300, H = 128, cw = W / edge.years.length, ch = H / edge.spends.length, lo = edge.spends[0], st = edge.spends[1] - lo, hi = edge.spends[edge.spends.length - 1];
        const fy = (v: number) => H - ((v - lo + st / 2) / (hi - lo + st)) * H, ix = edge.years.indexOf(plan.retireYear);
        return <>
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label="Stop year across, yearly spending up; the line is the most you can spend and still last">
            <defs><clipPath id="cxedge"><rect width={W} height={H} /></clipPath></defs>
            {edge.cells.map((col, i) => col.map((c, j) => <rect key={`${i}-${j}`} x={i * cw + 0.7} y={H - (j + 1) * ch + 0.7} width={cw - 1.4} height={ch - 1.4} rx={1.2}
              fill={c.ok ? 'rgba(169,199,162,.45)' : 'rgba(224,164,155,.3)'} />))}
            <path clipPath="url(#cxedge)" d={edge.edge.map((v, i) => `${i ? 'L' : 'M'}${(i * cw + cw / 2).toFixed(1)},${fy(v).toFixed(1)}`).join('')} fill="none" stroke="var(--cx-gold-hi)" strokeWidth={2.2} />
            {ix >= 0 && <circle cx={ix * cw + cw / 2} cy={Math.max(5, Math.min(H - 5, fy(plan.targetNet)))} r={5} fill="var(--cx-gold)" stroke="#0b1018" strokeWidth={2} />}
          </svg>
          <p className="text-[0.74rem] mt-1.5" style={{ color: 'var(--cx-dim)' }}>Across: the year you stop. Up: what you spend. The line is the most you can spend and still last{ix >= 0 && <> — <b style={{ color: 'var(--cx-ink)' }}>{fmt(edge.edge[ix] / 12)}</b> a month if you stop in {plan.retireYear}</>}.</p>
        </>; })()}
    </>) },
  ];

  // The moment it opens.
  const wasUnlocked = useRef(unlocked);
  useEffect(() => {
    if (unlocked && !wasUnlocked.current) { try { navigator.vibrate?.([12, 40, 18]); } catch { /* not supported */ } setViewI(0); }
    wasUnlocked.current = unlocked;
  }, [unlocked]);

  // Each ring takes the height its slot actually has (measured, never guessed),
  // and the horizon sits under the view ring wherever that lands.
  const [h, setH] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));
  useEffect(() => { const on = () => setH(window.innerHeight); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  const compact = h < 720;
  const viewSlot = useRef<HTMLDivElement | null>(null), codeSlot = useRef<HTMLDivElement | null>(null);
  const [viewH, setViewH] = useState(260), [codeH, setCodeH] = useState(230);
  useLayoutEffect(() => {
    const els = [viewSlot.current, codeSlot.current]; if (!els[0] || !els[1]) return;
    const measure = () => { setViewH(Math.max(170, Math.floor(els[0]!.clientHeight))); setCodeH(Math.max(190, Math.floor(els[1]!.clientHeight))); };
    measure(); const ro = new ResizeObserver(measure); els.forEach(e => ro.observe(e!)); return () => ro.disconnect();
  }, []);
  const viewBox = useRef<HTMLDivElement | null>(null);
  const [geo, setGeo] = useState({ hz: h * 0.42, cx: 200, size: 300 });
  useLayoutEffect(() => {
    const el = viewBox.current; if (!el) return;
    const measure = () => { const r = el.getBoundingClientRect(); setGeo({ hz: r.top + r.height * 0.8, cx: r.left + r.width / 2, size: Math.min(r.width * 0.95, r.height * 1.25) }); };
    measure(); const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect();
  }, [viewH, codeH]);
  const ridges = useMemo(() => ({ good: viz.high.map(d => d[1]), base: viz.base.map(d => d[1]), poor: viz.low.map(d => d[1]) }), [viz]);
  const onTurn = useCallback((deg: number) => setTurn(deg), []);

  const label = (name: string, current: string, i: number, set: (i: number) => void) => (
    <div className="flex items-center justify-between gap-2 px-1 mb-1">
      <span className="text-[0.66rem] tracking-[0.2em] uppercase" style={{ color: 'var(--cx-faint)' }}>{name}</span>
      <span className="flex items-center gap-1">
        <b className="text-[0.66rem] tracking-[0.2em] uppercase mr-1" style={{ color: 'var(--cx-gold)' }}>{current}</b>
        <button type="button" onClick={() => set((i + 5) % 6)} aria-label={`${name}: previous`} className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ border: '1px solid var(--cx-edge)', color: 'var(--cx-dim)' }}><ChevronUp size={15} /></button>
        <button type="button" onClick={() => set((i + 1) % 6)} aria-label={`${name}: next`} className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ border: '1px solid var(--cx-edge)', color: 'var(--cx-dim)' }}><ChevronDown size={15} /></button>
      </span>
    </div>
  );

  return (
    <div className={`cx${unlocked ? ' unlocked' : ''}`}>
      <Dawn k={nSet / PIECES.length} horizonY={geo.hz} sun={{ cx: geo.cx, size: geo.size }} ridges={ridges} turn={turn} />
      <div className="fixed inset-0 flex flex-col mx-auto max-w-[560px]" style={{ zIndex: 3,
        paddingTop: 'calc(env(safe-area-inset-top) + 0.8rem)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 5.4rem)',
        paddingLeft: 'max(14px, env(safe-area-inset-left))', paddingRight: 'max(14px, env(safe-area-inset-right))' }}>
        {header}
        <h1 className="cx-serif leading-[1.04] mt-1.5" style={{ fontSize: compact ? '1.6rem' : 'clamp(1.7rem, 7.4vw, 2.2rem)' }}>
          {unlocked ? <>Your pension code is <em style={{ color: 'var(--cx-gold)' }}>unlocked</em></> : <>Unlock your <em style={{ color: 'var(--cx-gold)' }}>pension code</em></>}
        </h1>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex gap-[5px] shrink-0" role="img" aria-label={`${nSet} of 6 pieces set`}>
            {PIECES.map(id => <span key={id} className="block w-[14px] h-[3px] rounded-sm transition-all duration-500"
              style={{ background: isSet(id) ? 'var(--cx-gold)' : 'rgba(255,255,255,.18)', boxShadow: isSet(id) ? '0 0 8px rgba(220,192,140,.6)' : undefined }} />)}
          </span>
          {!compact && <p className="text-[0.78rem] leading-snug" style={{ color: 'var(--cx-dim)' }}>
            {unlocked ? 'Every piece is set. Roll the view to see it every way.' : `${nSet} of 6 set. Roll the code to each piece and set it.`}</p>}
        </div>

        <div className="mt-2 flex flex-col min-h-0" style={{ flex: '1.12 1 0' }} ref={viewBox}>
          {label('The view', view[viewI].name, viewI, setViewI)}
          <div ref={viewSlot} className="flex-1 min-h-0">
            <Ring faces={view} index={viewI} onIndex={setViewI} height={viewH} label="The view" tone="view" onAngle={onTurn} />
          </div>
        </div>
        <div className="cx-seam my-2 shrink-0" aria-hidden="true" />
        <div className="flex flex-col min-h-0" style={{ flex: '1 1 0' }}>
          {label('The code', code[codeI].name, codeI, setCodeI)}
          <div ref={codeSlot} className="flex-1 min-h-0">
            <Ring faces={code} index={codeI} onIndex={setCodeI} height={codeH} label="The code" tone="code" />
          </div>
        </div>
      </div>
    </div>
  );
}
