import { useEffect, useRef, useState } from 'react';

/**
 * The sky behind the home. Night while nothing is set; each step set brings
 * the light up, and the last one brings the sun over the horizon.
 * The hills are not decoration: they are drawn from your own projection —
 * the farthest ridge on good returns, the middle on base, the nearest on
 * poor — and they drift a little with each step, as if you were looking along them.
 */
const NIGHT = { s0: [5, 8, 13], s1: [9, 15, 23], s2: [15, 24, 34], s3: [24, 33, 44], l0: [6, 9, 13], l1: [5, 7, 10] };
const DAWN = { s0: [12, 26, 46], s1: [44, 62, 98], s2: [196, 128, 108], s3: [244, 196, 138], l0: [20, 24, 36], l1: [9, 11, 17] };
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c: number[]) => `rgb(${c.join(',')})`;

export default function Sky({ k, horizonY, sun, ridges, turn }: {
  k: number;                                   // 0 = night, 1 = sunrise
  horizonY: number;                            // in viewport pixels
  sun: { cx: number; size: number };           // where the sun comes up
  ridges: { good: number[]; base: number[]; poor: number[] } | null;
  turn: number;                                // degrees; the panorama drifts with the step
}) {
  const [shown, setShown] = useState(k);
  const shownRef = useRef(k); shownRef.current = shown;
  useEffect(() => {
    const from = shownRef.current, t0 = performance.now();
    const dur = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1400;
    let raf = 0;
    const step = (t: number) => { const f = Math.min(1, (t - t0) / dur); setShown(from + (k - from) * (1 - Math.pow(1 - f, 3))); if (f < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [k]);
  const e = Math.pow(shown, 1.15);
  const c = Object.fromEntries(Object.entries(NIGHT).map(([key, v]) => [key, rgb(mix(v, (DAWN as any)[key], e))])) as Record<string, string>;

  // Stars: drawn once, fading as it gets light.
  const stars = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const draw = () => {
      const cv = stars.current; if (!cv) return;
      const dpr = window.devicePixelRatio || 1, w = window.innerWidth, h = window.innerHeight;
      cv.width = w * dpr; cv.height = h * dpr; const g = cv.getContext('2d')!; g.scale(dpr, dpr);
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < Math.round(w * h / 2600); i++) {
        const r = rnd() < 0.92 ? rnd() * 0.8 + 0.2 : rnd() * 1.2 + 0.8;
        g.fillStyle = `rgba(${rnd() < 0.2 ? '240,220,180' : '220,230,245'},${(rnd() * 0.5 + 0.12).toFixed(2)})`;
        g.beginPath(); g.arc(rnd() * w, rnd() * h * 0.7, r, 0, 7); g.fill();
      }
    };
    draw(); window.addEventListener('resize', draw); return () => window.removeEventListener('resize', draw);
  }, []);

  // The hills: three ridges of your money, as a panorama that turns with the view.
  const land = useRef<HTMLCanvasElement | null>(null);
  const LAND_H = 130;
  useEffect(() => {
    const cv = land.current; if (!cv) return;
    const dpr = window.devicePixelRatio || 1, W = window.innerWidth, H = LAND_H;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    if (!ridges || !ridges.base.length) return;
    const max = Math.max(1, ...ridges.good, ...ridges.base);
    const P = W * 2.4, off = (((turn / 360) * P) % P + P) % P;
    const ridge = (vs: number[], hf: number, fill: string, rim?: string) => {
      const pts = [...vs, ...vs.slice().reverse()], n = pts.length, dx = P / n;
      const Y = (v: number) => H - 4 - (Math.max(0, v) / max) * (H - 16) * hf;
      g.beginPath(); g.moveTo(-dx, H);
      for (let rep = -1; rep <= 1; rep++) for (let i = 1; i <= n; i++) {
        const x = i * dx + rep * P - off, px = (i - 1) * dx + rep * P - off, y = Y(pts[i % n]), py = Y(pts[(i - 1) % n]);
        if (i === 1 && rep === -1) g.lineTo(px, py);
        g.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
      }
      g.lineTo(W + dx, H); g.closePath(); g.fillStyle = fill; g.fill();
      if (rim) { g.strokeStyle = rim; g.lineWidth = 1; g.stroke(); }
    };
    ridge(ridges.good, 0.92, `rgba(${mix([22, 30, 42], [120, 104, 132], e).join(',')},.55)`);
    ridge(ridges.base, 0.7, `rgba(${mix([14, 20, 29], [64, 58, 84], e).join(',')},.85)`, `rgba(255,214,160,${(0.05 + 0.35 * e).toFixed(2)})`);
    ridge(ridges.poor, 0.48, rgb(mix([8, 11, 16], [24, 26, 40], e)), `rgba(255,214,160,${(0.03 + 0.25 * e).toFixed(2)})`);
    g.fillStyle = `rgba(255,220,170,${(0.04 + 0.18 * e).toFixed(2)})`; g.fillRect(0, H - 3, W, 1);
  }, [ridges, turn, e]);

  // The sun climbs from behind the land; nothing of it shows below the horizon.
  const sunTop = horizonY - sun.size * 0.5 - sun.size * 0.2 * e + sun.size * 0.05;
  const cut = Math.max(0, sunTop + sun.size - horizonY);
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }} aria-hidden="true">
      <div className="absolute inset-0" style={{
        background: `linear-gradient(to bottom, ${c.s0} 0px, ${c.s1} ${horizonY * 0.5}px, ${c.s2} ${horizonY - 80}px, ${c.s3} ${horizonY}px, ${c.l0} ${horizonY + 1}px, ${c.l1} ${horizonY + 300}px, #070b10 100%)` }} />
      <canvas ref={stars} className="absolute inset-0 w-full h-full" style={{ opacity: 1 - 0.88 * e }} />
      <div className="absolute rounded-full" style={{
        left: sun.cx - sun.size / 2, top: sunTop, width: sun.size, height: sun.size, opacity: 0.06 + 0.94 * e,
        clipPath: `inset(0 0 ${cut.toFixed(1)}px 0)`,
        background: 'radial-gradient(circle, rgba(255,228,176,.82) 0%, rgba(246,192,120,.5) 30%, rgba(232,150,96,.18) 56%, rgba(232,150,96,0) 70%)' }} />
      <canvas ref={land} className="absolute left-0 w-full" style={{ top: horizonY - LAND_H + 2, height: LAND_H }} />
    </div>
  );
}
