import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * One ring of the cryptex: faces round a horizontal axis, rolled up and down
 * like a combination lock. The face lined up between the gold pointers is the
 * one you are reading; its neighbours tilt away above and below.
 *
 * Drag (or flick) up and down to roll it, use the scroll wheel or the arrow
 * keys (the ring's label row carries ▲ ▼ buttons too). Only the face in front can be reached by keyboard
 * or read out; the others are inert while they are turned away.
 */
export interface RingFace { key: string; name: string; node: React.ReactNode; set?: boolean }

const norm = (a: number) => ((a % 360) + 540) % 360 - 180;

export default function Ring({ faces, index, onIndex, height, label, tone = 'view', onAngle }: {
  faces: RingFace[]; index: number; onIndex: (i: number) => void; height: number; label: string; tone?: 'view' | 'code';
  /** Reports the ring's angle as it turns, for anything that should move with it. */
  onAngle?: (deg: number) => void;
}) {
  const N = faces.length, STEP = 360 / N;
  const PEEK = 14, faceH = Math.max(140, height - PEEK * 2);
  const R = (faceH / 2) / Math.tan(Math.PI / N) + 6;
  const [angle, setAngle] = useState(index * STEP);
  const angleRef = useRef(angle); angleRef.current = angle;
  useEffect(() => { onAngle?.(angle); }, [angle, onAngle]);
  const anim = useRef<number | null>(null);
  const dragging = useRef(false);
  const win = useRef<HTMLDivElement | null>(null);

  // Roll the shortest way round to a face.
  const rollTo = useCallback((i: number) => {
    const from = angleRef.current, d = norm(i * STEP - from), to = from + d;
    if (anim.current) cancelAnimationFrame(anim.current);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(d) < 0.01) { setAngle(to); return; }
    const t0 = performance.now(), dur = 480, ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (t: number) => { const f = Math.min(1, (t - t0) / dur); setAngle(from + d * ease(f)); if (f < 1) anim.current = requestAnimationFrame(step); };
    anim.current = requestAnimationFrame(step);
  }, [STEP]);

  // The index is owned by the parent; follow it whenever we are not being dragged.
  useLayoutEffect(() => { if (!dragging.current) rollTo(index); }, [index, rollTo]);
  useEffect(() => () => { if (anim.current) cancelAnimationFrame(anim.current); }, []);

  const front = ((Math.round(angle / STEP) % N) + N) % N;
  const go = (i: number) => onIndex(((i % N) + N) % N);

  // Drag up and down to roll; a flick carries on a little.
  useEffect(() => {
    const el = win.current; if (!el) return;
    let y0 = 0, a0 = 0, lastY = 0, lastT = 0, v = 0, active = false;
    const k = STEP / faceH;                         // one face per face-height of finger travel
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('input, button, select, label')) return;
      active = true; dragging.current = true; y0 = lastY = e.clientY; a0 = angleRef.current; lastT = performance.now(); v = 0;
      if (anim.current) cancelAnimationFrame(anim.current);
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!active) return;
      const now = performance.now(); v = (e.clientY - lastY) / Math.max(1, now - lastT); lastY = e.clientY; lastT = now;
      setAngle(a0 - (e.clientY - y0) * k);
    };
    const up = () => {
      if (!active) return; active = false; dragging.current = false;
      const fling = angleRef.current - v * k * 220;
      const i = ((Math.round(fling / STEP) % N) + N) % N;
      onIndex(i); rollTo(i);
    };
    let wheelAcc = 0, wheelT = 0;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelAcc += e.deltaY; const now = performance.now();
      if (Math.abs(wheelAcc) > 40 && now - wheelT > 220) { wheelT = now; const dir = wheelAcc > 0 ? 1 : -1; wheelAcc = 0;
        const cur = ((Math.round(angleRef.current / STEP) % N) + N) % N; onIndex(((cur + dir) % N + N) % N); }
    };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('wheel', wheel); };
  }, [N, STEP, faceH, onIndex, rollTo]);

  // The engraved ticks on the side rims travel with the ring.
  const tick = ((angle * Math.PI / 180) * R) % 10;
  const rimStyle: React.CSSProperties = {
    backgroundImage: 'repeating-linear-gradient(180deg, rgba(255,240,210,.55) 0 1px, transparent 1px 10px), linear-gradient(90deg, rgba(0,0,0,.35), rgba(255,236,200,.18) 45%, rgba(120,96,60,.2) 70%, rgba(0,0,0,.4))',
    backgroundSize: '6px 100%, 100% 100%', backgroundRepeat: 'repeat-y, no-repeat',
    backgroundPosition: `center ${(-tick).toFixed(2)}px, 0 0`,
  };

  return (
    <div className="relative select-none" role="group" aria-roledescription="carousel" aria-label={label}
      onKeyDown={e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); go(front + 1); }
        if (e.key === 'ArrowUp') { e.preventDefault(); go(front - 1); }
      }}>
      <div className="relative flex items-stretch gap-1.5" style={{ height }}>
        {/* left rim with its pointer */}
        <div className="cx-rim relative w-[12px] shrink-0 rounded-[6px]" style={rimStyle} aria-hidden="true">
          <span className="cx-pointer cx-pointer-l" />
        </div>
        <div ref={win} className="relative flex-1 min-w-0 overflow-hidden rounded-[16px]"
          style={{ perspective: 900, touchAction: 'none', cursor: 'grab' }}>
          <div className="absolute inset-x-0" style={{ top: PEEK, height: faceH, transformStyle: 'preserve-3d',
            transform: `translateZ(${-R}px) rotateX(${angle}deg)` }}>
            {faces.map((f, i) => {
              const rel = Math.abs(norm(i * STEP - angle)), isFront = i === front && rel < STEP / 2, vis = rel < 80;
              return (
                <section key={f.key} aria-label={f.name} aria-hidden={!isFront} inert={!isFront}
                  className={`cx-face cx-face-${tone}${f.set ? ' is-set' : ''}`}
                  style={{
                    position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
                    transform: `rotateX(${-i * STEP}deg) translateZ(${R}px)`,
                    opacity: vis ? 0.18 + 0.82 * Math.pow(Math.cos(rel * Math.PI / 180), 2.2) : 0,
                    filter: rel < 3 ? 'none' : `brightness(${(1 - Math.min(0.5, rel / 120)).toFixed(2)})`,
                    pointerEvents: isFront ? 'auto' : 'none',
                  }}>
                  {f.node}
                </section>
              );
            })}
          </div>
        </div>
        {/* right rim and its pointer */}
        <div className="cx-rim relative w-[12px] shrink-0 rounded-[6px]" style={rimStyle} aria-hidden="true">
          <span className="cx-pointer cx-pointer-r" />
        </div>
      </div>
    </div>
  );
}
