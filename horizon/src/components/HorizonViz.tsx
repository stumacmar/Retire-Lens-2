import { useMemo, useRef, useState } from 'react';
import { fmtK } from '../lib/format';

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
  dryYear?: number | null;
  inflation?: number;         // for today's-money scrub readout
  birthYear?: number;         // partner A, for the age readout
  onYearTap?: (year: number) => void;   // open the year drill-down sheet
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
  const { base, low, high, startYear, retireYear, horizonYear, retireWealth, lasts, dryYear,
          inflation = 0, birthYear, onYearTap } = props;

  // Scrub-to-read: drag horizontally to run a finger along your future;
  // a light tap opens the full year breakdown. Vertical pans still scroll.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const downX = useRef(0);
  const moved = useRef(0);
  const yearAt = (clientX: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || r.width < 1) return startYear;
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return Math.round(startYear + f * (horizonYear - startYear));
  };

  const g = useMemo(() => {
    const yr0 = startYear, yr1 = horizonYear;
    let maxW = 1;
    for (const s of [base, low, high]) for (const [, v] of s) if (v > maxW) maxW = v;
    const x = (yr: number) => ((yr - yr0) / Math.max(1, yr1 - yr0)) * W;
    const y = (v: number) => H - padBottom - (Math.max(0, v) / maxW) * (H - padTop - padBottom);
    const map = (s: [number, number][]) => s.map(([yr, v]) => ({ x: x(yr), y: y(v) }));
    const baseP = map(base), lowP = map(low), highP = map(high);
    const bandTop = smooth(highP);
    const bandBottomPts = [...lowP].reverse();
    const areaD = bandTop + ' L ' + bandBottomPts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ') + ' Z';
    const dryX = dryYear ? x(dryYear) : null;
    // A calm y-scale: a few round £ gridlines so the shape has a sense of size.
    const niceStep = (v: number) => {
      const raw = v / 3, mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
      const n = raw / mag;
      return (n >= 5 ? 5 : n >= 2 ? 2 : 1) * mag;
    };
    const step = niceStep(maxW);
    const yTicks: { y: number; label: string }[] = [];
    for (let v = 0; v <= maxW + 1; v += step) yTicks.push({ y: y(v), label: fmtK(v) });
    const xTicks = [
      { x: x(yr0), label: String(yr0) },
      { x: x(retireYear), label: String(retireYear) },
      { x: x(yr1), label: String(yr1) },
    ];
    const byYear = new Map<number, { x: number; y: number; v: number }>();
    for (const [yr, v] of base) byYear.set(yr, { x: x(yr), y: y(v), v });
    return {
      areaD, baseD: smooth(baseP), maxW,
      sunX: x(retireYear), sunY: y(retireWealth), groundY: H - padBottom,
      dryX, yTicks, xTicks, byYear,
    };
  }, [base, low, high, startYear, retireYear, horizonYear, retireWealth, dryYear]);

  // Below ~£10k of peak wealth the axis and scrub are meaningless noise —
  // treat the chart as a blank canvas and invite instead.
  const emptyPlan = g.maxW < 10000;

  const sc = !emptyPlan && scrub != null ? g.byYear.get(scrub) : undefined;
  const scToday = sc ? sc.v / Math.pow(1 + inflation, (scrub as number) - startYear) : 0;
  const scLabel = sc
    ? `${scrub}${birthYear != null ? ` · age ${(scrub as number) - birthYear}` : ''} · ${fmtK(scToday)}`
    : '';
  const scLabelX = sc ? Math.min(W - 8 - scLabel.length * 2.7, Math.max(8 + scLabel.length * 2.7, sc.x)) : 0;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
         aria-label="Your wealth over retirement, a calm horizon. Drag to read a year, tap for detail."
         style={{ display: 'block', touchAction: 'pan-y', cursor: 'crosshair' }}
         onPointerDown={e => {
           if (g.maxW < 10000) return;
           svgRef.current?.setPointerCapture(e.pointerId);
           downX.current = e.clientX; moved.current = 0;
           setScrub(yearAt(e.clientX));
         }}
         onPointerMove={e => {
           if (scrub == null) return;
           moved.current = Math.max(moved.current, Math.abs(e.clientX - downX.current));
           setScrub(yearAt(e.clientX));
         }}
         onPointerUp={e => {
           if (scrub != null && moved.current < 6) onYearTap?.(yearAt(e.clientX));
           setScrub(null);
         }}
         onPointerCancel={() => setScrub(null)}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-dawn-1)" />
          <stop offset="0.55" stopColor="var(--color-dawn-2)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--color-canvas)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-sage)" stopOpacity="0.26" />
          <stop offset="1" stopColor="var(--color-sage)" stopOpacity="0.03" />
        </linearGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="var(--color-calm)" stopOpacity="0.7" />
          <stop offset="0.45" stopColor="var(--color-calm)" stopOpacity="0.32" />
          <stop offset="1" stopColor="var(--color-calm)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Dawn sky wash */}
      <rect x="0" y="0" width={W} height={H - padBottom + 10} fill="url(#sky)" />
      {/* Faint £ gridlines — a quiet sense of scale (the y-axis) */}
      {!emptyPlan && g.yTicks.map((t, i) => (
        <g key={i}>
          <line x1="0" y1={t.y} x2={W} y2={t.y} stroke="var(--color-hairline)" strokeWidth="1"
                opacity={i === 0 ? 0.9 : 0.4} strokeDasharray={i === 0 ? undefined : '2 5'} />
          {i > 0 && <text x="3" y={t.y - 3} fontSize="9" fill="var(--color-ink-faint)">{t.label}</text>}
        </g>
      ))}
      {/* Poor↔Positive confidence glow */}
      <path d={g.areaD} fill="url(#band)" />
      {/* Warm sun at the moment you stop work */}
      <circle cx={g.sunX} cy={g.sunY} r="30" fill="url(#sun)" />
      <circle cx={g.sunX} cy={g.sunY} r="7" fill="var(--color-calm)" />
      {/* The median path — the horizon line */}
      <path d={g.baseD} fill="none" stroke="var(--color-ocean)" strokeWidth="2.4"
            strokeLinecap="round" strokeLinejoin="round" pathLength={1}
            style={{ strokeDasharray: 1, strokeDashoffset: 0 }} />
      {/* Gentle hills grounding the scene */}
      <path d={`M0 ${H - padBottom} C ${W * 0.2} ${H - padBottom - 14}, ${W * 0.35} ${H - padBottom + 6}, ${W * 0.55} ${H - padBottom - 4}
                S ${W * 0.85} ${H - padBottom - 16}, ${W} ${H - padBottom - 6} L ${W} ${H} L 0 ${H} Z`}
            fill="var(--color-dusk)" opacity="0.6" />
      <path d={`M0 ${H - padBottom + 12} C ${W * 0.25} ${H - padBottom + 2}, ${W * 0.5} ${H - padBottom + 20}, ${W * 0.75} ${H - padBottom + 8}
                S ${W} ${H - padBottom + 4}, ${W} ${H - padBottom + 10} L ${W} ${H} L 0 ${H} Z`}
            fill="var(--color-sage)" opacity="0.14" />
      {/* Where the money runs short — a gentle marker, never alarming */}
      {g.dryX != null && !emptyPlan && (
        <g>
          <line x1={g.dryX} y1={padTop} x2={g.dryX} y2={g.groundY} stroke="var(--color-hope)" strokeWidth="1" strokeDasharray="3 4" opacity="0.6" />
          <circle cx={g.dryX} cy={g.groundY} r="3.5" fill="var(--color-hope)" />
        </g>
      )}
      {/* Blank canvas: a quiet invitation instead of a broken axis */}
      {emptyPlan && (
        <g textAnchor="middle" fill="var(--color-ink-faint)">
          <text x={W / 2} y={H / 2 - 30} fontSize="12" fontWeight="650" fill="var(--color-ink-dim)">Your horizon will draw itself</text>
          <text x={W / 2} y={H / 2 - 13} fontSize="10.5">as soon as you add your pensions, ISAs or savings.</text>
        </g>
      )}
      {/* Scrub guide — run a finger along the future */}
      {sc && (
        <g pointerEvents="none">
          <line x1={sc.x} y1={padTop - 4} x2={sc.x} y2={g.groundY} stroke="var(--color-ink-dim)" strokeWidth="1" opacity="0.55" />
          <circle cx={sc.x} cy={sc.y} r="5" fill="var(--color-ocean)" stroke="var(--color-surface)" strokeWidth="2" />
          <rect x={scLabelX - scLabel.length * 2.9 - 7} y={2} width={scLabel.length * 5.8 + 14} height={17}
                rx="8.5" fill="var(--color-surface)" stroke="var(--color-hairline)" />
          <text x={scLabelX} y={14} fontSize="10.5" fontWeight="700" textAnchor="middle"
                fill="var(--color-ink)" className="tnum">{scLabel}</text>
        </g>
      )}
      {/* Age labels, whisper-quiet — Someday tucks under the sun only if there's room */}
      <text x="4" y={H - 22} fontSize="10" fill="var(--color-ink-faint)">Today</text>
      <text x="4" y={H - 10} fontSize="9" fill="var(--color-ink-faint)" opacity="0.75">{g.xTicks[0].label}</text>
      {g.sunX > 56 && g.sunX < W - 56 && (
        <>
          <text x={g.sunX} y={H - 22} fontSize="10" fill="var(--color-calm-strong)" textAnchor="middle" fontWeight="700">Someday</text>
          <text x={g.sunX} y={H - 10} fontSize="9" fill="var(--color-calm-strong)" textAnchor="middle" opacity="0.8">{g.xTicks[1].label}</text>
        </>
      )}
      <text x={W - 4} y={H - 22} fontSize="10" fill="var(--color-ink-faint)" textAnchor="end">
        {lasts ? 'and beyond' : 'the far years'}
      </text>
      <text x={W - 4} y={H - 10} fontSize="9" fill="var(--color-ink-faint)" textAnchor="end" opacity="0.75">{g.xTicks[2].label}</text>
    </svg>
  );
}
