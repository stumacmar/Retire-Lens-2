import { useMemo } from 'react';

/**
 * The Horizon — a serene landscape, not a chart. (HIG: content over chrome,
 * depth via soft layers.) A dawn sky, a soft confidence glow between the Poor
 * and Positive futures, the median path as the horizon line, a warm sun at the
 * moment you stop work, and gentle hills grounding it all. No axes, no grid —
 * calm first, precision on the Explore screen.
 */
export interface HorizonProps {
  base: [number, number][];   // median wealth over time
  low: [number, number][];    // Poor
  high: [number, number][];   // Positive
  startYear: number;
  retireYear: number;
  horizonYear: number;
  retireWealth: number;
  lasts: boolean;
}

const W = 400, H = 250, padTop = 26, padBottom = 44;

// Catmull-Rom → cubic bézier: a calm, continuous curve (no jagged polylines).
function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export default function HorizonViz(props: HorizonProps) {
  const { base, low, high, startYear, retireYear, horizonYear, retireWealth, lasts } = props;

  const g = useMemo(() => {
    const yr0 = startYear, yr1 = horizonYear;
    let maxW = 1;
    for (const s of [base, low, high]) for (const [, v] of s) if (v > maxW) maxW = v;
    const x = (yr: number) => ((yr - yr0) / Math.max(1, yr1 - yr0)) * W;
    const y = (v: number) => H - padBottom - (Math.max(0, v) / maxW) * (H - padTop - padBottom);
    const map = (s: [number, number][]) => s.map(([yr, v]) => ({ x: x(yr), y: y(v) }));
    const baseP = map(base), lowP = map(low), highP = map(high);
    // Confidence area: Positive across the top, Poor back along the bottom.
    const bandTop = smooth(highP);
    const bandBottomPts = [...lowP].reverse();
    const areaD = bandTop + ' L ' + bandBottomPts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ') + ' Z';
    return {
      areaD, baseD: smooth(baseP), maxW,
      sunX: x(retireYear), sunY: y(retireWealth),
      endX: x(horizonYear), endY: baseP.length ? baseP[baseP.length - 1].y : y(0),
    };
  }, [base, low, high, startYear, retireYear, horizonYear, retireWealth]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
         aria-label="Your wealth over retirement, a calm horizon" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-dawn-1)" />
          <stop offset="0.55" stopColor="var(--color-dawn-2)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--color-canvas)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-calm)" stopOpacity="0.22" />
          <stop offset="1" stopColor="var(--color-calm)" stopOpacity="0.02" />
        </linearGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--color-hope)" stopOpacity="0.9" />
          <stop offset="0.45" stopColor="var(--color-hope)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--color-hope)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Dawn sky wash */}
      <rect x="0" y="0" width={W} height={H - padBottom + 10} fill="url(#sky)" />
      {/* Poor↔Positive confidence glow */}
      <path d={g.areaD} fill="url(#band)" />
      {/* Warm sun at the moment you stop work */}
      <circle cx={g.sunX} cy={g.sunY} r="34" fill="url(#sun)" />
      <circle cx={g.sunX} cy={g.sunY} r="7" fill="var(--color-hope)" />
      {/* The median path — the horizon line */}
      <path d={g.baseD} fill="none" stroke="var(--color-calm-strong)" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round" pathLength={1}
            style={{ strokeDasharray: 1, strokeDashoffset: 0 }} />
      {/* Gentle hills grounding the scene */}
      <path d={`M0 ${H - padBottom} C ${W * 0.2} ${H - padBottom - 14}, ${W * 0.35} ${H - padBottom + 6}, ${W * 0.55} ${H - padBottom - 4}
                S ${W * 0.85} ${H - padBottom - 16}, ${W} ${H - padBottom - 6} L ${W} ${H} L 0 ${H} Z`}
            fill="var(--color-dusk)" opacity="0.6" />
      <path d={`M0 ${H - padBottom + 12} C ${W * 0.25} ${H - padBottom + 2}, ${W * 0.5} ${H - padBottom + 20}, ${W * 0.75} ${H - padBottom + 8}
                S ${W} ${H - padBottom + 4}, ${W} ${H - padBottom + 10} L ${W} ${H} L 0 ${H} Z`}
            fill="var(--color-calm)" opacity="0.14" />
      {/* Age labels, whisper-quiet */}
      <text x="4" y={H - 10} fontSize="10" fill="var(--color-ink-faint)">Today</text>
      <text x={g.sunX} y={H - 10} fontSize="10" fill="var(--color-hope)" textAnchor="middle" fontWeight="700">Someday</text>
      <text x={W - 4} y={H - 10} fontSize="10" fill="var(--color-ink-faint)" textAnchor="end">
        {lasts ? 'and beyond' : 'the far years'}
      </text>
    </svg>
  );
}
