import { useEffect, useRef, useState } from 'react';
import { useLabPlan } from './useLabPlan';
import type { LabFacts } from './useLabPlan';
import { MoonStage } from './moon';
import { ScalesStage } from './scales';
import { CoreStage } from './core';
import { readout } from '../lantern/words';

/**
 * The lab: whole-experience concepts for the home, on the real engine, at
 * ?lab=<name>. Reached only by its address; never linked from the app, never
 * the default. (Pension Scout, version 2, manual §3.3. The owner, 21 November
 * 2026: "the tower is not intuitive. You can remove it but only to replace
 * with something better and non standard. Think of all the 3d spacial
 * opportunities or 4D or button pressing to open more … visual levels of
 * depth".)
 *
 * Each concept is one object in the dark that is the answer at a glance, and
 * a press that takes you one level deeper into it.
 */
const gbp = (v: number) => `£${Math.round(v).toLocaleString('en-GB')}`;
const NAMES = ['moon', 'scales', 'core'] as const;
type Name = typeof NAMES[number];

/** Plain words for how sure it is. A lab wording, not the app's status rules. */
const verdict = (f: LabFacts) => (f.futures >= 80 ? 'On track' : f.futures >= 60 ? 'Likely, not certain' : f.futures >= 40 ? 'Touch and go' : f.futures >= 20 ? 'Unlikely as it stands' : 'Not enough yet');

function useStage<T extends { dispose(): void }>(make: (host: HTMLDivElement, overlay: HTMLDivElement) => T | null, deps: unknown[]) {
  const host = useRef<HTMLDivElement>(null), overlay = useRef<HTMLDivElement>(null), stage = useRef<T | null>(null);
  const [ok, setOk] = useState(true);
  useEffect(() => {
    if (!host.current || !overlay.current) return;
    try { stage.current = make(host.current, overlay.current); } catch { setOk(false); }
    return () => { stage.current?.dispose(); stage.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { host, overlay, stage, ok };
}

function Frame({ name, title, line, sub, back, onBack, host, overlay, onKey, describe }: {
  name: Name; title: string; line: string; sub?: string; back: boolean; onBack: () => void;
  host: React.RefObject<HTMLDivElement | null>; overlay: React.RefObject<HTMLDivElement | null>; onKey: (e: React.KeyboardEvent) => void; describe: string;
}) {
  return (
    <main data-lab={name} className="fixed inset-0" style={{ background: '#070C1F', color: '#F4F6FF' }}>
      {/* The scene fills the screen, so its glow has no edge; the words sit over it. */}
      <div className="absolute inset-0" role="button" tabIndex={0} aria-label={describe} onKeyDown={onKey} data-lab-stage>
        <div ref={host} className="absolute inset-0" />
        <div ref={overlay} className="absolute inset-0 pointer-events-none overflow-hidden" />
      </div>
      <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <header className="flex items-center justify-between px-4 pt-3 min-h-[52px]">
          {back
            ? <button type="button" data-lab-back onClick={onBack} className="pointer-events-auto min-h-[44px] min-w-[44px] -ml-2 px-2 text-[1rem] font-semibold" style={{ color: '#DCE6FF' }}><span aria-hidden="true">‹</span> Back</button>
            : <span className="text-[1.05rem] font-extrabold tracking-tight">Someday</span>}
          <a href="./" className="pointer-events-auto min-h-[44px] flex items-center text-[0.86rem] underline" style={{ color: '#9FB0D9' }}>Close</a>
        </header>
        <p data-lab-title className="px-5 pt-1 text-[1.7rem] font-extrabold leading-tight tracking-tight">{title}</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 px-5 pointer-events-none" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 22px)' }} aria-live="polite">
        <p data-lab-line className="text-[1.08rem] leading-snug font-semibold">{line}</p>
        {sub && <p data-lab-sub className="mt-1 text-[0.9rem] leading-snug" style={{ color: '#B9C8F5' }}>{sub}</p>}
      </div>
    </main>
  );
}

function Moon({ f }: { f: LabFacts }) {
  const [at, setAt] = useState<{ level: number; index: number }>({ level: 0, index: -1 });
  const { host, overlay, stage } = useStage((h, o) => new MoonStage(h, o, { p: f.p, years: f.years }, (level, index) => setAt({ level, index })), [f]);
  const floor = at.index >= 0 ? f.model.floors[at.index] : null;
  const answer = `In ${f.futures} of 100 futures, ${gbp(f.month)} a month lasts to ${f.toAge}.`;
  return <Frame name="moon" title={verdict(f)} back={at.level > 0} onBack={() => stage.current?.back()} host={host} overlay={overlay}
    line={floor ? readout(f.model, floor, 0) : answer}
    sub={at.level === 1 ? 'The years ahead, from the day you stop.' : undefined}
    describe={`${answer} Press to see the years ahead.`}
    onKey={e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); stage.current?.step(1); } else if (e.key === 'Escape' || e.key === 'ArrowDown') { e.preventDefault(); stage.current?.step(-1); } }} />;
}

function Scales({ f }: { f: LabFacts }) {
  const [open, setOpen] = useState<'need' | 'have' | null>(null);
  const { host, overlay, stage } = useStage((h, o) => new ScalesStage(h, o, f.cover, setOpen), [f]);
  const c = f.counts, answer = `What you have outweighs what you need in ${f.futures} of 100 futures.`;
  const have = [c.pensions > 0 ? `${gbp(c.pensions)} in pensions` : '', c.savings > 0 ? `${gbp(c.savings)} in ISAs and cash` : '', c.guaranteed > 0 ? `${gbp(c.guaranteed)} a year guaranteed for life` : ''].filter(Boolean).join(', ');
  return <Frame name="scales" title={verdict(f)} back={open != null} onBack={() => stage.current?.set(null)} host={host} overlay={overlay}
    line={open === 'need' ? `You need ${gbp(f.month)} a month after tax, from ${f.stopAge} to ${f.toAge}.` : open === 'have' ? `You have ${have}.` : answer}
    sub={open ? undefined : `${gbp(f.month)} a month, from ${f.stopAge} to ${f.toAge}.`}
    describe={`${answer} Press a pan to see what is in it.`}
    onKey={e => { if (e.key === 'ArrowLeft') stage.current?.set('need'); else if (e.key === 'ArrowRight') stage.current?.set('have'); else if (e.key === 'Escape') stage.current?.set(null); }} />;
}

function Core({ f }: { f: LabFacts }) {
  const [open, setOpen] = useState(false);
  const g = f.guaranteed, rest = Math.max(0, f.month - g.month);
  const { host, overlay, stage } = useStage((h, o) => new CoreStage(h, o, { p: f.p, share: g.share },
    { core: `<b style="display:block;font-size:15px">Guaranteed for life</b>${gbp(g.month)} a month from ${g.fromAge}`, shell: `<b style="display:block;font-size:15px">From your pots</b>lasts in ${f.futures} of 100 futures` }, setOpen), [f]);
  const answer = g.month > 0
    ? `${gbp(g.month)} of your ${gbp(f.month)} a month is guaranteed for life. The rest lasts in ${f.futures} of 100 futures.`
    : `In ${f.futures} of 100 futures, ${gbp(f.month)} a month lasts to ${f.toAge}.`;
  return <Frame name="core" title={verdict(f)} back={open} onBack={() => stage.current?.set(false)} host={host} overlay={overlay}
    line={open ? `${gbp(g.month)} a month is State Pension and other income for life, from ${g.fromAge}. The other ${gbp(rest)} must come from your pots.` : answer}
    describe={`${answer} Press to open it.`}
    onKey={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); stage.current?.set(!open); } else if (e.key === 'Escape') stage.current?.set(false); }} />;
}

export default function Lab() {
  const name = new URLSearchParams(window.location.search).get('lab') as Name | null;
  const { facts, failed } = useLabPlan();
  if (!name || !NAMES.includes(name)) {
    return (
      <main data-lab-index className="fixed inset-0 p-6" style={{ background: '#050916', color: '#F4F6FF' }}>
        <h1 className="text-[1.3rem] font-extrabold">Lab</h1>
        <p className="mt-2 text-[0.92rem]" style={{ color: '#B9C8F5' }}>Concepts for the home, on your own figures. Nothing here is the app yet.</p>
        <ul className="mt-4 space-y-3">{NAMES.map(n => <li key={n}><a className="block rounded-2xl px-4 py-4 text-[1.05rem] font-bold capitalize" style={{ background: '#16224A', border: '1px solid #6177BD' }} href={`./?lab=${n}`}>{n}</a></li>)}</ul>
        <a href="./" className="mt-6 inline-block underline text-[0.9rem]" style={{ color: '#9FB0D9' }}>Back to Someday</a>
      </main>
    );
  }
  if (!facts) return <main data-lab-wait className="fixed inset-0 flex items-center justify-center" style={{ background: '#050916', color: '#C9D4F2' }}><p className="text-[0.95rem]">{failed ? 'The futures could not be worked out for this plan.' : 'Working out 2,000 futures…'}</p></main>;
  return name === 'moon' ? <Moon f={facts} /> : name === 'scales' ? <Scales f={facts} /> : <Core f={facts} />;
}
