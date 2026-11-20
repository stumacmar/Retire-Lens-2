import { useEffect, useRef, useState } from 'react';
import { LanternScene } from './scene';
import type { LanternModel } from './model';
import { WINDOWS, countWindows, modelOk } from './adapter';

/**
 * The one React component that owns the Lantern's scene. The scene is made
 * once; a new model (a changed plan, fresh futures) is handed to it and the
 * tower is rebuilt in place. It reports the face and the tapped floor out;
 * everything drawn is the scene's business.
 *
 * It is a slider to assistive technology and the keyboard: the arrow keys
 * move the open floor up and down the years, Home and End jump to the ends,
 * Escape closes it, and the reading for the open floor is its value text.
 */
export default function LanternCanvas({ model, lens, selected, summary, compact = false, locked = false, onLens, onSelect, onFailed }: {
  model: LanternModel; lens: number; selected: number; summary: string; compact?: boolean; locked?: boolean;
  onLens: (k: number) => void; onSelect: (i: number) => void; onFailed?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null), overlay = useRef<HTMLDivElement>(null);
  const scene = useRef<LanternScene | null>(null);
  const cb = useRef({ onLens, onSelect, onFailed }); cb.current = { onLens, onSelect, onFailed };
  const [face, setFace] = useState(lens), [settled, setSettled] = useState(true);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    if (!host.current || !overlay.current) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const fail = () => { setState('failed'); cb.current.onFailed?.(); };
    // Ask before building, so a browser without WebGL gets the notice and no console error.
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) { fail(); return; }
    let s: LanternScene | null = null;
    try {
      s = new LanternScene(host.current, overlay.current, model, {
        reducedMotion: reduced, compact, lockFace: locked,
        onFace: (k, done) => { setFace(k); setSettled(done); if (done) cb.current.onLens(k); },
        onSelect: i => cb.current.onSelect(i),
        onLost: fail,
      });
      scene.current = s; setState('ready');
    } catch { fail(); }
    return () => { s?.dispose(); scene.current = null; };
    // The scene lives as long as the component; the model reaches it through setModel below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { scene.current?.setModel(model); }, [model]);
  useEffect(() => { scene.current?.setLens(lens); }, [lens, state]);
  useEffect(() => { scene.current?.select(selected); }, [selected, state, model]);

  const F = model.floors, n = F.length;
  const onKey = (e: React.KeyboardEvent) => {
    let next: number | null = null;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = selected < 0 ? 0 : Math.min(n - 1, selected + 1);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = selected < 0 ? 0 : Math.max(0, selected - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else if (e.key === 'Escape') next = -1;
    if (next == null) return;
    e.preventDefault(); onSelect(next);
  };

  return (
    <div data-lantern data-ready={state === 'ready' ? '1' : '0'} data-face={face} data-settled={settled ? '1' : '0'}
      data-floors={n} data-windows={WINDOWS} data-model-ok={modelOk(model) ? '1' : '0'} data-selected={selected}
      data-first-age={F[0]?.age} data-lit={F.map(f => countWindows(f.windows).full).join(',')} data-lit-stress={F.map(f => countWindows(f.stress).full).join(',')}
      role="slider" tabIndex={0} aria-label="Years of your plan" aria-orientation="vertical"
      aria-valuemin={F[0]?.age} aria-valuemax={F[n - 1]?.age} aria-valuenow={selected >= 0 && selected < n ? F[selected].age : F[0]?.age} aria-valuetext={summary}
      onKeyDown={onKey}
      className="relative w-full h-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8FB0FF]">
      <div ref={host} className="absolute inset-0" />
      <div ref={overlay} className="absolute inset-0 pointer-events-none" />
      {state === 'failed' && (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-[0.86rem]" style={{ color: '#C9D4F2' }}>
          This picture needs WebGL, which this browser has switched off.
        </p>
      )}
    </div>
  );
}
