import { useEffect, useRef, useState } from 'react';
import { LanternScene } from './scene';
import type { LanternModel } from './model';
import { WINDOWS, modelOk } from './model';

/**
 * The one React component that owns the Lantern's scene. It passes the view
 * model in and reports the face and the tapped floor out; everything drawn
 * is the scene's business.
 */
export default function LanternCanvas({ model, lens, selected, summary, onLens, onSelect }: {
  model: LanternModel; lens: number; selected: number; summary: string;
  onLens: (k: number) => void; onSelect: (i: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null), overlay = useRef<HTMLDivElement>(null);
  const scene = useRef<LanternScene | null>(null);
  const cb = useRef({ onLens, onSelect }); cb.current = { onLens, onSelect };
  const [face, setFace] = useState(lens), [settled, setSettled] = useState(true);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    if (!host.current || !overlay.current) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let s: LanternScene | null = null;
    // Ask before building, so a browser without WebGL gets the notice and no console error.
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) { setState('failed'); return; }
    try {
      s = new LanternScene(host.current, overlay.current, model, {
        reducedMotion: reduced,
        onFace: (k, done) => { setFace(k); setSettled(done); if (done) cb.current.onLens(k); },
        onSelect: i => cb.current.onSelect(i),
        onLost: () => setState('failed'),
      });
      scene.current = s; setState('ready');
    } catch { setState('failed'); }
    return () => { s?.dispose(); scene.current = null; };
  }, [model]);

  useEffect(() => { scene.current?.setLens(lens); }, [lens, state]);
  useEffect(() => { scene.current?.select(selected); }, [selected, state]);

  return (
    <div data-lantern data-ready={state === 'ready' ? '1' : '0'} data-face={face} data-settled={settled ? '1' : '0'}
      data-floors={model.floors.length} data-windows={WINDOWS} data-model-ok={modelOk(model) ? '1' : '0'} data-selected={selected}
      role="img" aria-label={summary} className="relative w-full h-full overflow-hidden">
      <div ref={host} className="absolute inset-0" />
      <div ref={overlay} className="absolute inset-0 pointer-events-none" />
      {state === 'failed' && (
        <p className="absolute inset-0 flex items-center justify-center px-8 text-center text-[0.9rem]" style={{ color: '#C9D4F2' }}>
          This preview needs WebGL, which this browser has switched off. A flat view comes in a later stage.
        </p>
      )}
    </div>
  );
}
