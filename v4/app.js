/**
 * Someday planner UI. Tabs mirror the Marshall workbook. Engine is pure and
 * lives in engine.js; everything here is rendering and state.
 * Display convention: with the Today's £ toggle on, every figure shown is
 * deflated to 2026 money, including aggregates. Lifetime tax uses the
 * engine's per-year deflated sum; horizon values deflate at the horizon year.
 */
import { createEngine } from './engine.js';
import { EXAMPLES } from './examples.js';
import { PRODUCT } from '../config/product.js';

const E = createEngine();
const $ = (id) => document.getElementById(id);

// ── State ───────────────────────────────────────────────────────────────
const S = {
  // New visitors start with a blank, generic plan ("You" / "Partner", zeroed
  // pots) — never someone else's data. A returning visitor's saved plan is
  // loaded below. E.defaults() (the Marshall workbook) is reserved for tests.
  P: E.freshStart(),
  tab: 'assumptions',  // land on "Your details" first, not the dashboard
  todayMoney: true,   // open in today's money — clearer for people, matches the workbook view
  pinned: null,
  mc: null,
  mcBusy: false,
  cache: {},
  flowIdx: 0,
  exampleActive: false,  // viewing the opt-in example plan (a "peek", not committed)
  preExample: null,      // snapshot of the plan to restore when clearing the peek
};

try {
  const saved = localStorage.getItem('rl4-state');
  if (saved) {
    const obj = JSON.parse(saved);
    if (obj && obj.P) {
      // Returning visitor: restore their plan and take them to the dashboard.
      S.P = mergeParams(E.freshStart(), obj.P);
      S.todayMoney = !!obj.todayMoney;
      S.exampleActive = !!obj.exampleActive;
      S.tab = 'dashboard';
    }
  }
  if (location.hash.startsWith('#plan=')) {
    const obj = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(6)))));
    if (obj) { S.P = mergeParams(E.freshStart(), obj); S.tab = 'dashboard'; }
  }
} catch (e) { /* fresh start on any parse problem */ }

function mergeParams(base, incoming) {
  const out = JSON.parse(JSON.stringify(base));
  const deep = (dst, src) => {
    for (const k of Object.keys(src || {})) {
      try {
        if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k])
          && dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) deep(dst[k], src[k]);
        else dst[k] = src[k];
      } catch (e) { /* keep default on shape mismatch */ }
    }
  };
  deep(out, incoming);
  if (Array.isArray(incoming.spending)) {
    // Migrate away legacy lines no longer modelled (mortgage, motorhome).
    out.spending = incoming.spending.filter(r => r.key !== 'mortgage' && r.key !== 'motorhome');
  }
  if (Array.isArray(incoming.lifeEvents)) out.lifeEvents = incoming.lifeEvents;
  if (out.strategy === 'blend') out.strategy = 'sippfirst';
  return out;
}

function save() {
  try { localStorage.setItem('rl4-state', JSON.stringify({ P: S.P, todayMoney: S.todayMoney, exampleActive: S.exampleActive })); } catch (e) {}
}

// ── Example-plan "peek" (opt-in; never overwrites without a way back) ─────
function enterExample(key) {
  const ex = EXAMPLES.find(e => e.key === key) || EXAMPLES[1];
  S.preExample = JSON.parse(JSON.stringify(S.P));   // remember what to restore
  S.P = mergeParams(E.freshStart(), ex.patch);
  S.exampleActive = true;
  S.exampleLabel = ex.label.toLowerCase();
  save(); recompute(); activateTab('dashboard');
}
function keepExample() {          // "make this my starting point"
  S.exampleActive = false; S.preExample = null;
  save(); recompute(); renderTab();
}
function clearExample() {         // "clear and start blank"
  S.P = S.preExample ? mergeParams(E.freshStart(), S.preExample) : E.freshStart();
  S.preExample = null; S.exampleActive = false;
  save(); recompute(); activateTab('assumptions');
}
function exampleBanner() {
  if (!S.exampleActive) return '';
  return `<div class="example-banner no-print">
    <span>👀 You're viewing an <strong>example</strong> plan${S.exampleLabel ? ' (the ' + S.exampleLabel + ')' : ''} — not your figures.</span>
    <span class="eb-actions"><button type="button" id="eb-keep" class="small">Make this my starting point</button>
    <button type="button" id="eb-clear" class="small ghost">Clear &amp; start blank</button></span>
  </div>`;
}
function wireExampleBanner() {
  const k = $('eb-keep'), c = $('eb-clear');
  if (k) k.onclick = keepExample;
  if (c) c.onclick = clearExample;
}

// ── "This helped?" support panel (post-results, warm, dismissible) ────────
// Donations only — no paywall, per the product ethos. Preset buttons appear
// once a real donation link is configured in config/product.js; until then a
// single button points at the landing page's support section.
function supportDismissed() { try { return localStorage.getItem('rl_support_dismissed') === '1'; } catch { return false; } }
function supportPanel() {
  if (supportDismissed()) return '';
  const link = /^https:\/\//i.test(PRODUCT.donationLink || '') ? PRODUCT.donationLink : '';
  return `<div class="card support-card no-print" id="support-card">
    <div class="kicker">This helped?</div>
    <h2>Keep Someday free for the next person</h2>
    <p class="sub">Someday is free and private, built by one person. If it moved your thinking, chip in whatever you think it's worth — it funds the next improvement. Totally optional, always will be.</p>
    <div class="support-actions">
      ${link
        ? [5, 10, 25].map(a => `<a class="small support-amt" href="${link}" target="_blank" rel="noopener">£${a}</a>`).join('')
        : '<a class="small support-amt" href="index.html#support">Support Someday ♥</a>'}
      <button type="button" id="support-later" class="small ghost">Maybe later</button>
    </div>
  </div>`;
}
function wireSupportPanel() {
  const b = $('support-later');
  if (b) b.onclick = () => {
    try { localStorage.setItem('rl_support_dismissed', '1'); } catch (e) {}
    const c = $('support-card'); if (c) c.remove();
  };
}

// ── Multiple saved plans (free for everyone — no supporter gate) ──────────
function savedPlans() { try { return JSON.parse(localStorage.getItem('rl4-plans') || '{}'); } catch { return {}; } }
function setSavedPlans(o) { try { localStorage.setItem('rl4-plans', JSON.stringify(o)); } catch (e) {} }

// ── Formatting ──────────────────────────────────────────────────────────
const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
function deflate(v, year) {
  if (!S.todayMoney || year == null) return v;
  return v / Math.pow(1 + S.P.inflation, year - S.P.startYear);
}
const horizonYear = () => S.P.partnerA.birthYear + S.P.horizonAge;
// Grammar for the fresh-start name "You": "You save", "Your pension" — never
// "You saves" or "You's". Real names keep normal possessives.
const isYou = (n) => /^you$/i.test((n || '').trim());
const poss = (n) => isYou(n) ? 'Your' : (/s$/i.test(n) ? n + '’' : n + '’s');
const verbS = (n, third, second) => isYou(n) ? second : third;
const fmt = (v, year) => GBP.format(Math.round(deflate(v, year)));
const fmtK = (v, year) => {
  const x = deflate(v, year);
  const sign = x < 0 ? '-' : '';
  const a = Math.abs(x);
  if (a >= 1e6) return sign + '£' + (a / 1e6).toFixed(2) + 'm';
  if (a >= 1e3) return sign + '£' + Math.round(a / 1e3) + 'k';
  return sign + '£' + Math.round(a);
};
const pct = (v, dp) => (v * 100).toFixed(dp == null ? 0 : dp) + '%';
const lifetimeTaxShown = (dd) => S.todayMoney ? dd.lifetimeTaxReal : dd.lifetimeTax;

// ── Recompute ───────────────────────────────────────────────────────────
function recompute() {
  const P = S.P;
  const c = {};
  c.accBase = E.accumulate(P, P.growthBase);
  c.accBear = E.accumulate(P, P.growthBear);
  c.accBull = E.accumulate(P, P.growthBull);
  c.accLive = Math.abs(P.growth - P.growthBase) < 1e-9 ? c.accBase : E.accumulate(P);
  c.dd = E.drawdown(P, { startPots: c.accLive.atRetirement });
  c.strategies = E.compareStrategies(P);
  c.estate = E.estate(P);
  c.stress = E.stressTests(P);
  c.grid = E.sensitivityGrid(P);
  c.tornado = E.tornado(P);
  c.totals = E.lifetimeTotals(P);
  S.cache = c;
  scheduleMC();
}

let mcTimer = null, worker = null;
function makeWorker() {
  const src = `
    const createEngine = ${createEngine.toString()};
    const E = createEngine();
    onmessage = (e) => {
      const { P, n, seed } = e.data;
      postMessage(E.runMonteCarlo(P, n, seed));
    };
  `;
  return new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
}
function scheduleMC() {
  clearTimeout(mcTimer);
  S.mcBusy = true;
  mcTimer = setTimeout(() => {
    try {
      if (!worker) {
        worker = makeWorker();
        worker.onmessage = (e) => {
          S.mc = e.data; S.mcBusy = false;
          if (S.tab === 'dashboard' || S.tab === 'risk') renderTab();
        };
        worker.onerror = () => { S.mcBusy = false; };
      }
      worker.postMessage({ P: JSON.parse(JSON.stringify(S.P)), n: S.P.mcPaths, seed: S.P.mcSeed });
    } catch (e) {
      S.mc = E.runMonteCarlo(S.P, Math.min(400, S.P.mcPaths), S.P.mcSeed);
      S.mcBusy = false;
      if (S.tab === 'dashboard' || S.tab === 'risk') renderTab();
    }
  }, 350);
}

function changed() {
  save();
  recompute();
  syncGrowthUI();
  renderTab();
}

// ── SVG chart helpers ───────────────────────────────────────────────────
function chart(opts) {
  const W = opts.w || 720, H = opts.h || 260;
  const padL = opts.padL || 56, padR = 14, padT = 14, padB = 32;
  const xs = opts.xDomain, ys = opts.yDomain;
  const X = (x) => padL + (x - xs[0]) / (xs[1] - xs[0] || 1) * (W - padL - padR);
  const Y = (y) => H - padB - (y - ys[0]) / (ys[1] - ys[0] || 1) * (H - padT - padB);
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${opts.label || 'chart'}">`;
  const ticks = opts.yTicks || 4;
  for (let i = 0; i <= ticks; i++) {
    const v = ys[0] + (ys[1] - ys[0]) * i / ticks;
    const y = Y(v);
    const baseLine = i === 0;   // the floor gets a slightly firmer line; the rest recede
    svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--card-edge)" stroke-width="1.4" opacity="${baseLine ? 0.9 : 0.45}" shape-rendering="crispEdges"/>`;
    svg += `<text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="9" font-family="var(--mono)" fill="var(--ink-faint)">${opts.yFmt ? opts.yFmt(v) : Math.round(v)}</text>`;
  }
  const xt = opts.xTicks || 6;
  for (let i = 0; i <= xt; i++) {
    const v = Math.round(xs[0] + (xs[1] - xs[0]) * i / xt);
    svg += `<text x="${X(v)}" y="${H - 8}" text-anchor="middle" font-size="9" font-family="var(--mono)" fill="var(--ink-faint)">${opts.xFmt ? opts.xFmt(v) : v}</text>`;
  }
  return { svg, X, Y, W, H, add: (s) => { svg += s; }, get: () => svg + '</svg>' };
}
function linePath(pts, X, Y) {
  return pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');
}
function areaPath(pts, base, X, Y) {
  let d = linePath(pts, X, Y);
  for (let i = base.length - 1; i >= 0; i--) {
    d += ' L' + X(base[i][0]).toFixed(1) + ',' + Y(base[i][1]).toFixed(1);
  }
  return d + ' Z';
}
// Retirement-readiness ring: an SVG donut, 0–100%, colour-coded. Sweeps in on
// tab entry via the .tab-enter hook (data-draw), reduced-motion permitting.
function readinessRing(frac, caption) {
  const f = Math.max(0, Math.min(1, frac || 0));
  const r = 34, C = 2 * Math.PI * r;
  const cls = f >= 0.85 ? 'good' : f >= 0.6 ? 'warn' : 'bad';
  return `<div class="readiness ring-${cls}">
    <svg viewBox="0 0 80 80" width="86" height="86" role="img" aria-label="Retirement readiness ${Math.round(f * 100)} percent">
      <circle cx="40" cy="40" r="${r}" fill="none" stroke="var(--card-edge)" stroke-width="8"/>
      <circle cx="40" cy="40" r="${r}" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"
        transform="rotate(-90 40 40)" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${(1 - f).toFixed(3)}" data-ring/>
      <text x="40" y="46" text-anchor="middle" font-size="20" font-weight="800" fill="var(--ink)">${Math.round(f * 100)}%</text>
    </svg>
    <span class="readiness-cap">${caption}</span>
  </div>`;
}

// Chart colours reference theme-aware CSS custom properties (SVG stroke/fill and
// legend swatches both resolve var() inline), so lines stay legible in dark mode.
const COLORS = {
  db: 'var(--c-purple)', spB: 'var(--c-cyan)', spA: 'var(--c-blue)',
  pension: 'var(--c-teal)', pcls: 'var(--c-slate)', isa: 'var(--c-amber)',
  bear: 'var(--c-rose)', base: 'var(--c-teal)', bull: 'var(--c-blue)',
  tax: 'var(--c-rose)', spend: 'var(--c-teal)', mort: 'var(--c-slate)', event: 'var(--c-purple)',
};

// ── Field helpers ───────────────────────────────────────────────────────
// Every field's <label> is tied to its <input> by id. The explanation is not
// printed under the input (that made the page busy); it hides behind a small
// "?" toggletip next to the label, and is still linked via aria-describedby so
// screen readers always hear it.
const fieldId = (path) => 'f-' + String(path).replace(/[^a-z0-9]+/gi, '-');
const describedBy = (id, hint) => hint ? ` aria-describedby="${id}-h"` : '';
function labelRow(id, label, hint) {
  if (!hint) return `<label for="${id}">${label}</label>`;
  const esc = String(label).replace(/"/g, '&quot;');
  return `<div class="field-label"><label for="${id}">${label}</label>` +
    `<button type="button" class="help-btn" aria-controls="${id}-h" aria-expanded="false" aria-label="What is &quot;${esc}&quot;?">?</button></div>` +
    `<span class="help-text" id="${id}-h" role="note">${hint}</span>`;
}
function textField(label, path, hint) {
  const id = fieldId(path), val = String(getPath(path) ?? '').replace(/"/g, '&quot;');
  return `<div class="field">${labelRow(id, label, hint)}
    <input id="${id}" type="text" data-path="${path}" data-text="1" value="${val}"${describedBy(id, hint)}></div>`;
}
function moneyField(label, path, hint) {
  const id = fieldId(path), val = getPath(path);
  return `<div class="field">${labelRow(id, label, hint)}
    <input id="${id}" type="text" inputmode="decimal" data-path="${path}" value="${val}"${describedBy(id, hint)}></div>`;
}
function numField(label, path, hint, step) {
  const id = fieldId(path), val = getPath(path);
  return `<div class="field">${labelRow(id, label, hint)}
    <input id="${id}" type="number" ${step ? `step="${step}"` : ''} data-path="${path}" value="${val}"${describedBy(id, hint)}></div>`;
}
function pctField(label, path, hint) {
  const id = fieldId(path), val = Math.round(getPath(path) * 10000) / 100;
  return `<div class="field">${labelRow(id, label, hint)}
    <input id="${id}" type="number" step="0.25" data-path="${path}" data-pct="1" value="${val}"${describedBy(id, hint)}></div>`;
}
function getPath(path) {
  return path.split('.').reduce((o, k) => o[k], S.P);
}
function setPath(path, v) {
  const ks = path.split('.');
  let o = S.P;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = v;
}
// Gentle sanity bounds for fields where a slip (e.g. birth year 19700, retiring
// in the past) would silently produce a nonsense plan. Values are clamped, and
// the field flashes briefly so the correction is visible, not mysterious.
const BOUNDS = {
  'partnerA.birthYear': () => [1930, S.P.startYear - 16],
  'partnerB.birthYear': () => [1930, S.P.startYear - 16],
  'partnerA.spAge': () => [55, 75],
  'partnerB.spAge': () => [55, 75],
  'retireYear': () => [S.P.startYear + 1, S.P.startYear + 45],
  'horizonAge': () => [Math.max(70, S.P.retireYear - S.P.partnerA.birthYear + 1), 105],
  'inherit.year': () => [S.P.startYear, S.P.startYear + 60],
};
function clampFor(path, v) {
  const b = BOUNDS[path];
  if (!b || typeof v !== 'number' || Number.isNaN(v)) return v;
  const [lo, hi] = b();
  return Math.min(hi, Math.max(lo, v));
}
function wireInputs(root) {
  root.querySelectorAll('input[data-path], select[data-path]').forEach(el => {
    el.addEventListener('change', () => {
      let v = el.value;
      if (el.dataset.text) v = String(v).trim();
      else if (el.dataset.pct) v = (parseFloat(v) || 0) / 100;
      else if (el.type === 'number' || el.inputMode === 'decimal') v = parseFloat(String(v).replace(/[£,\s]/g, '')) || 0;
      const clamped = clampFor(el.dataset.path, v);
      const wasClamped = clamped !== v;
      if (wasClamped) v = clamped;
      setPath(el.dataset.path, v);
      if (el.dataset.path === 'growthBase') S.P.growth = S.P.growthBase;
      changed();
      if (wasClamped && el.id) {
        // changed() re-rendered the tab; flash the fresh element so the
        // correction is visible, not mysterious.
        const fresh = document.getElementById(el.id);
        if (fresh) { fresh.classList.add('was-clamped'); setTimeout(() => fresh.classList.remove('was-clamped'), 1200); }
      }
    });
  });
}

// ── Money flow Sankey for one year ──────────────────────────────────────
function sankeyFor(row) {
  // Spent windfalls only: invested windfalls never enter this year's income.
  // netIncome = guaranteed + draws + tfc - tax + isa + cash + spent windfalls,
  // so the spent portion falls out exactly by conservation.
  const spentWindfall = Math.max(0, row.netIncome -
    (row.guaranteed + row.grossA + row.grossB + row.tfcA + row.tfcB - row.tax + row.isaDraw + row.cashDraw));
  const cleanSources = [
    { name: 'State pensions', v: row.spA + row.spB, color: COLORS.spA },
    { name: 'defined-benefit pension', v: row.dbA + row.dbB, color: COLORS.db },
    { name: 'Pension draws', v: row.grossA + row.grossB, color: COLORS.pension },
    { name: 'Tax-free cash', v: row.tfcA + row.tfcB, color: COLORS.pcls },
    { name: 'ISA and cash', v: row.isaDraw + row.cashDraw, color: COLORS.isa },
    { name: 'Windfalls', v: spentWindfall, color: COLORS.event },
  ].filter(s => s.v > 0.5);
  const everyday = Math.max(0, row.netIncome - row.eventCost);
  const sinks = [
    { name: 'Everyday spending', v: everyday, color: COLORS.spend },
    { name: 'HMRC', v: row.tax, color: COLORS.tax },
    { name: 'One-off events', v: row.eventCost, color: COLORS.event },
  ].filter(s => s.v > 0.5);

  const totalIn = cleanSources.reduce((s, x) => s + x.v, 0);
  const totalOut = sinks.reduce((s, x) => s + x.v, 0);
  const total = Math.max(totalIn, totalOut, 1);

  const W = 720, H = 300, colL = 178, colR = 540, barW = 10, gap = 8, top = 16;
  const usable = H - top - 16 - gap * 3;
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Money flow for the year">`;
  let y = top;
  const lpos = [];
  for (const s of cleanSources) {
    const h = Math.max(3, s.v / total * usable);
    lpos.push({ ...s, y0: y, h });
    svg += `<rect x="${colL - barW}" y="${y}" width="${barW}" height="${h}" rx="3" fill="${s.color}"/>`;
    svg += `<text x="${colL - barW - 7}" y="${y + h / 2 + 3}" text-anchor="end" font-size="10" fill="var(--ink-dim)">${s.name}</text>`;
    svg += `<text x="${colL - barW - 7}" y="${y + h / 2 + 14}" text-anchor="end" font-size="9" fill="var(--ink-faint)">${fmtK(s.v, row.year)}</text>`;
    y += h + gap;
  }
  y = top;
  const rpos = [];
  for (const s of sinks) {
    const h = Math.max(3, s.v / total * usable);
    rpos.push({ ...s, y0: y, h, fill: 0 });
    svg += `<rect x="${colR}" y="${y}" width="${barW}" height="${h}" rx="3" fill="${s.color}"/>`;
    svg += `<text x="${colR + barW + 7}" y="${y + h / 2 + 3}" font-size="10" fill="var(--ink-dim)">${s.name}</text>`;
    svg += `<text x="${colR + barW + 7}" y="${y + h / 2 + 14}" font-size="9" fill="var(--ink-faint)">${fmtK(s.v, row.year)}</text>`;
    y += h + gap;
  }
  // Ribbons: each source splits across sinks pro-rata to sink size
  for (const s of lpos) {
    let sy = s.y0;
    for (const k of rpos) {
      const share = s.v * (k.v / totalOut);
      if (share < 0.5) continue;
      const sh = share / total * usable;
      const kh = share / total * usable;
      const y1 = sy, y2 = sy + sh;
      const y3 = k.y0 + k.fill, y4 = k.y0 + k.fill + kh;
      const mx = (colL + colR) / 2;
      svg += `<path d="M${colL},${y1} C${mx},${y1} ${mx},${y3} ${colR},${y3}
        L${colR},${y4} C${mx},${y4} ${mx},${y2} ${colL},${y2} Z"
        fill="${s.color}" opacity="0.30"/>`;
      sy += sh; k.fill += kh;
    }
  }
  return svg + '</svg>';
}

// ── Views ───────────────────────────────────────────────────────────────

function renderDashboard(el) {
  const c = S.cache, P = S.P;
  const acc = c.accLive.atRetirement;
  const potsAtRet = acc.pensionA + acc.pensionB + acc.isaA + acc.isaB;
  const dd = c.dd;
  const y1 = dd.rows[0];
  const endYear = horizonYear();
  const mc = S.mc;

  const kpiDelta = (key, val, year) => {
    if (!S.pinned) return '';
    const d = val - S.pinned[key];
    if (Math.abs(d) < 1) return '<div class="d">no change vs plan A</div>';
    const good = (key === 'lifetimeTax') ? d < 0 : d > 0;
    return `<div class="d ${good ? 'up' : 'down'}">${d > 0 ? '+' : ''}${fmtK(d, year)} vs plan A</div>`;
  };
  const survives = dd.exhaustedAgeA == null;

  // Scenario cards, no horizontal scroll: the key number is unmissable.
  // Poor/Positive drawdowns are computed once and shared with the timeline band.
  const ddFor = (g, a) => (Math.abs(g - P.growth) < 1e-9) ? dd : E.drawdown(P, { growth: g, startPots: a.atRetirement });
  const ddBear = ddFor(P.growthBear, c.accBear);
  const ddBull = ddFor(P.growthBull, c.accBull);
  const scenarioRows = [
    ['🔴 Poor', P.growthBear, c.accBear, ddBear],
    ['🟡 Base', P.growthBase, c.accBase, ddFor(P.growthBase, c.accBase)],
    ['🟢 Positive', P.growthBull, c.accBull, ddBull],
  ];
  const isCustom = ![P.growthBear, P.growthBase, P.growthBull].some(g => Math.abs(g - P.growth) < 1e-9);
  if (isCustom) scenarioRows.push(['🎚️ Your slider', P.growth, c.accLive, dd]);
  const scenarioHtml = scenarioRows.map(([name, g, a, r]) => {
    const live = Math.abs(g - P.growth) < 1e-9;
    return `<div class="scenario-card${live ? ' live' : ''}">
      <div class="sc-head"><b>${name}</b> <span>${pct(g, 1)} growth</span></div>
      <div class="sc-main">
        <div><div class="sc-v">${fmtK(r.endWealth, endYear)}</div><div class="sc-k">wealth at ${P.horizonAge}</div></div>
        <span class="pill ${r.exhaustedAgeA == null ? 'good' : 'bad'}">${r.exhaustedAgeA == null ? 'lasts to ' + P.horizonAge + '+' : 'runs dry at ' + r.exhaustedAgeA}</span>
      </div>
      <div class="sc-sub">Pensions + ISAs at ${P.retireYear}: ${fmtK(a.atRetirement.pensionA + a.atRetirement.pensionB + a.atRetirement.isaA + a.atRetirement.isaB, P.retireYear)}</div>
    </div>`;
  }).join('');

  // Money-through-retirement timeline — the depletion story at a glance, with a
  // Poor↔Positive band around the live line so the range is visible in one view.
  const tlRows = dd.rows;
  const tlPts = tlRows.map(r => [r.year, deflate(r.wealth, r.year)]);
  const bandLo = ddBear.rows.map(r => [r.year, deflate(r.wealth, r.year)]);
  const bandHi = ddBull.rows.map(r => [r.year, deflate(r.wealth, r.year)]);
  let tlMax = 1; for (const p of bandHi) tlMax = Math.max(tlMax, p[1]);
  for (const p of tlPts) tlMax = Math.max(tlMax, p[1]);
  const tlY0 = tlRows[0].year, tlY1 = tlRows[tlRows.length - 1].year;
  const tch = chart({ xDomain: [tlY0, tlY1], yDomain: [0, tlMax * 1.08], yFmt: (v) => fmtK(v), h: 170, label: 'Your money through retirement' });
  if (bandLo.length && bandHi.length) {
    tch.add(`<path d="${areaPath(bandHi, bandLo, tch.X, tch.Y)}" fill="var(--accent)" opacity="0.09"/>`);
    tch.add(`<text x="${tch.X(tlY1) - 3}" y="${tch.Y(bandHi[bandHi.length - 1][1]) - 4}" text-anchor="end" style="font-size:10px" fill="var(--ink-faint)">Positive</text>`);
    tch.add(`<text x="${tch.X(tlY1) - 3}" y="${tch.Y(bandLo[bandLo.length - 1][1]) + 12}" text-anchor="end" style="font-size:10px" fill="var(--ink-faint)">Poor</text>`);
  }
  tch.add(`<path d="${areaPath(tlPts, [[tlY1, 0], [tlY0, 0]], tch.X, tch.Y)}" fill="var(--accent)" opacity="0.10"/>`);
  tch.add(`<path d="${linePath(tlPts, tch.X, tch.Y)}" fill="none" stroke="var(--accent)" stroke-width="2.6" pathLength="1" data-draw/>`);
  // Story annotations: State Pension start, and the crossover where guaranteed
  // income first covers the spending need.
  const tlMark = (yr, label, col, ty) => {
    if (yr == null || yr < tlY0 || yr > tlY1) return;
    tch.add(`<line x1="${tch.X(yr)}" y1="14" x2="${tch.X(yr)}" y2="${170 - 32}" stroke="${col}" stroke-width="1" stroke-dasharray="3 3" opacity="0.65"/>`);
    tch.add(`<text x="${tch.X(yr) + 4}" y="${ty}" style="font-size:10px" fill="${col}" opacity="0.9">${label}</text>`);
  };
  tlMark(P.partnerA.birthYear + P.partnerA.spAge, 'State Pension', 'var(--c-blue)', 40);
  const crossRow = dd.rows.find(r => r.guaranteed >= r.target * 0.98);
  if (crossRow) tlMark(crossRow.year, 'income covers need', 'var(--accent-strong)', 54);
  if (dd.exhaustedYear) {
    tch.add(`<line x1="${tch.X(dd.exhaustedYear)}" y1="14" x2="${tch.X(dd.exhaustedYear)}" y2="${170 - 32}" stroke="var(--rose)" stroke-width="1.5" stroke-dasharray="4 4"/>`);
    tch.add(`<text x="${tch.X(dd.exhaustedYear) + 5}" y="26" style="font-size:11px" fill="var(--rose)">runs dry ${dd.exhaustedYear}</text>`);
  }

  // Where the retirement £ comes from, over the whole plan: one calm segmented
  // bar (sums the rows already computed — no engine call).
  let srcSP = 0, srcDB = 0, srcPen = 0, srcTFC = 0, srcIsa = 0;
  for (const r of dd.rows) {
    srcSP += r.spA + r.spB; srcDB += r.dbA + r.dbB;
    srcPen += r.grossA + r.grossB - r.taxA - r.taxB;
    srcTFC += r.tfcA + r.tfcB; srcIsa += r.isaDraw + r.cashDraw;
  }
  const srcTotal = Math.max(1, srcSP + srcDB + srcPen + srcTFC + srcIsa);
  const srcSegs = [
    ['State Pension', srcSP, COLORS.spA],
    ['Company pension', srcDB, COLORS.db],
    ['Pension draws (after tax)', srcPen, COLORS.pension],
    ['Tax-free cash', srcTFC, COLORS.pcls],
    ['ISAs & cash', srcIsa, COLORS.isa],
  ].filter(s => s[1] / srcTotal > 0.005);
  const srcBar = `<div class="src-bar" role="img" aria-label="Where your retirement income comes from">
      ${srcSegs.map(([n, v, c]) => `<span style="flex:${(v / srcTotal).toFixed(4)};background:${c}" title="${n}"></span>`).join('')}
    </div>
    <div class="src-legend">${srcSegs.map(([n, v, c]) => `<span><i style="background:${c}"></i>${n} <b>${Math.round(v / srcTotal * 100)}%</b></span>`).join('')}</div>`;

  // Auto-generated, personalised insight bullets from the numbers already computed.
  const insights = [];
  const covRow = dd.rows.find(r => r.spA > 0 && r.spB > 0) || dd.rows[dd.rows.length - 1];
  const covPct = covRow && covRow.target > 0 ? Math.round(covRow.guaranteed / covRow.target * 100) : 0;
  if (covPct > 0) insights.push(['🛟', `Your guaranteed income (State Pension${(P.partnerA.db || P.partnerB.db) ? ' and company pension' : ''}) covers about <strong>${covPct}%</strong> of your spending from age ${covRow.ageA}.`]);
  const isaRet = acc.isaA + acc.isaB, potRet = acc.pensionA + acc.pensionB;
  if (isaRet > 500) insights.push(['🏦', `You'll have <strong>${fmtK(isaRet, P.retireYear)}</strong> in ISAs at ${P.retireYear} — about ${Math.round(isaRet / Math.max(1, isaRet + potRet) * 100)}% of your pot, drawn tax-free.`]);
  if (P.retireYear > P.startYear) {
    try {
      const P2 = JSON.parse(JSON.stringify(P)); P2.partnerA.monthlyPension += 250;
      const gain = E.accumulate(P2).atRetirement.pensionA - acc.pensionA;
      if (gain > 500) insights.push(['📈', `Saving <strong>£250/month</strong> more would grow your pot by about ${fmtK(gain, P.retireYear)} by ${P.retireYear}.`]);
    } catch (e) {}
  }
  try {
    const P3 = JSON.parse(JSON.stringify(P)); P3.retireYear += 1;
    const diff = E.drawdown(P3).endWealth - dd.endWealth;
    if (Math.abs(diff) > 1000) insights.push(['🗓️', `Retiring a year later (${P.retireYear + 1}) would leave about <strong>${fmtK(Math.abs(diff), endYear)}</strong> ${diff >= 0 ? 'more' : 'less'} at ${P.horizonAge}.`]);
  } catch (e) {}
  const taxSave = E.taxOn(y1.guaranteed + y1.grossA + y1.grossB, P.tax) - y1.tax;
  if (taxSave > 100) insights.push(['🧮', `Splitting income across both of you saves about <strong>${fmt(taxSave, y1.year)}</strong> in tax this year.`]);
  const insightHtml = insights.slice(0, 4).map(([ic, t]) => `<div class="insight"><span class="insight-ic" aria-hidden="true">${ic}</span><span>${t}</span></div>`).join('');

  el.innerHTML = `
  ${exampleBanner()}
  ${(() => {
    const good = survives && !(y1.shortfall > 1);
    const cls = good ? 'good' : (survives ? 'warn' : 'bad');
    const ageAtRet = P.retireYear - P.partnerA.birthYear;
    const txt = good
      ? `On these assumptions, yes — your money lasts to age ${P.horizonAge}+` + (mc ? `, and held up in about ${pct(mc.successProb)} of ${P.mcPaths} market runs.` : '.')
      : (survives
        ? `Almost — the income falls a little short in the first year. A slightly lower target or a later start closes it.`
        : `Not yet — the money runs short around age ${dd.exhaustedAgeA}. Retiring a little later, saving a bit more, or easing spending closes the gap.`);
    const readyFrac = mc ? mc.successProb : (survives ? (y1.shortfall > 1 ? 0.72 : 0.9) : 0.4);
    return `<div class="card">
    <div class="kicker">${P.partnerA.name} and ${P.partnerB.name}</div>
    <div class="someday-hero is-${cls}">
      <div class="sd-main">
        <span class="sd-eyebrow">${good ? '🎉 Your Someday could be' : 'Your retirement target'}</span>
        <span class="sd-date">April ${P.retireYear}</span>
        <span class="sd-age">${good ? `You could stop work at ${ageAtRet}.` : `The plan you're aiming for — ${P.partnerA.name} at ${ageAtRet}.`}</span>
      </div>
      ${readinessRing(readyFrac, 'Readiness')}
    </div>
    <p class="verdict ${cls}">${txt}</p>
    <p class="note">Someday is a model, not regulated financial advice — but it makes an excellent starting point for a conversation with a qualified, FCA-regulated financial adviser. <a href="legal.html" style="color:inherit;">The important bit</a>.</p>
    <p class="sub">At ${pct(P.growth, 1)} growth and ${pct(P.inflation, 1)} inflation. A model, not a promise. ${S.todayMoney ? "All figures in today's money." : 'Future pounds, with your inflation included.'} Pick a scenario below and everything recomputes.</p>`;
  })()}
    <div class="dash-scen no-print" role="group" aria-label="Growth scenario">
      ${[['bear', 'Poor', P.growthBear], ['base', 'Base', P.growthBase], ['bull', 'Positive', P.growthBull]].map(([k, lbl, g]) =>
        `<button type="button" data-dscen="${k}" class="${Math.abs(P.growth - g) < 1e-9 ? 'on' : ''}" aria-pressed="${Math.abs(P.growth - g) < 1e-9 ? 'true' : 'false'}">${lbl} <small>${pct(g, 1)}</small></button>`).join('')}
      ${isCustom ? `<span class="dash-scen-custom">Custom ${pct(P.growth, 1)}</span>` : ''}
    </div>
    <div class="kpis">
      <div class="kpi lead ${survives ? 'good' : 'bad'}"><div class="v">${survives ? 'To ' + P.horizonAge + '+' : 'Age ' + dd.exhaustedAgeA}</div><div class="k">${survives ? 'Your money lasts the whole plan' : 'Money runs short here — there are levers to try'}</div>${kpiDelta('endWealth', dd.endWealth, endYear)}</div>
      <div class="kpi lead ${y1.shortfall > 1 ? 'bad' : 'good'}"><div class="v">${fmtK(y1.netIncome, y1.year)}</div><div class="k">Spending money, first year (you need ${fmtK(y1.target, y1.year)})</div></div>
      <div class="kpi good"><div class="v">${fmtK(potsAtRet, P.retireYear)}</div><div class="k">Pensions + ISAs at ${P.retireYear}</div>${kpiDelta('pots', potsAtRet, P.retireYear)}</div>
      <div class="kpi ${mc ? (mc.successProb >= 0.85 ? 'good' : mc.successProb >= 0.6 ? 'warn' : 'bad') : ''}">
        <div class="v">${mc ? pct(mc.successProb) : '…'}</div><div class="k">How often the plan works, across ${P.mcPaths} market runs${S.mcBusy ? ', running' : ''}</div></div>
      <div class="kpi"><div class="v">${mc ? mc.confidenceAge : '…'}</div><div class="k">Money lasted to at least this age in 9 of 10 market runs</div></div>
      <div class="kpi"><div class="v">${fmtK(lifetimeTaxShown(dd))}</div><div class="k">Income tax over the plan${S.todayMoney ? ", today's money" : ''}</div>${kpiDelta('lifetimeTax', dd.lifetimeTax)}</div>
    </div>
    <details class="section" style="margin-top:0.9rem;">
      <summary>🛠️ Plan actions — pin, save a report, share</summary>
      <div class="section-body" style="display:flex; gap:0.5rem; flex-wrap:wrap;" class="no-print">
        <button id="btn-pin" class="small">${S.pinned ? 'Update plan A pin' : 'Pin as plan A'}</button>
        ${S.pinned ? '<button id="btn-unpin" class="small ghost">Clear pin</button>' : ''}
        <button id="btn-print" class="small">Download PDF report</button>
        <button id="btn-share" class="small">Copy share link</button>
      </div>
    </details>
  </div>

  <div class="card whatif no-print">
    <div class="kicker">Try a what-if</div>
    <h2>Move a lever, watch it change</h2>
    <p class="sub">Drag to explore; let go and the whole plan updates. Your saved figures aren't changed until you release.</p>
    <div class="lever">
      <div class="lever-top"><label for="wi-year">Retire in</label><output id="wi-year-out">${P.retireYear} · age ${P.retireYear - P.partnerA.birthYear}</output></div>
      <input type="range" id="wi-year" min="${P.startYear + 1}" max="${P.startYear + 25}" step="1" value="${P.retireYear}">
    </div>
    <div class="lever">
      <div class="lever-top"><label for="wi-spend">Spend each year</label><output id="wi-spend-out">${fmt(P.targetNet)}</output></div>
      <input type="range" id="wi-spend" min="15000" max="120000" step="1000" value="${P.targetNet}">
    </div>
    <div class="lever">
      <div class="lever-top"><label for="wi-save">${P.partnerA.name} ${verbS(P.partnerA.name, 'saves', 'save')} each month</label><output id="wi-save-out">${fmt(P.partnerA.monthlyPension)}</output></div>
      <input type="range" id="wi-save" min="0" max="5000" step="50" value="${P.partnerA.monthlyPension}">
    </div>
  </div>

  ${insightHtml ? `<div class="card">
    <div class="kicker">What we notice</div>
    <h2>Insights from your plan</h2>
    <div class="insights">${insightHtml}</div>
  </div>` : ''}

  ${supportPanel()}

  <div class="card">
    <div class="kicker">Your money through retirement</div>
    <h2>${dd.exhaustedYear ? 'When the money runs down' : 'Your money holds up'}</h2>
    ${tch.get()}
    <p class="note">Total pensions, ISAs and cash from ${P.retireYear} to ${tlY1}, in ${S.todayMoney ? "today's money" : 'future pounds'}. The soft band is the Poor-to-Positive range; the solid line is your current scenario. ${dd.exhaustedYear ? 'On this plan it runs dry around ' + dd.exhaustedYear + '.' : 'On this plan it lasts the whole way.'}</p>
    <h3 style="margin-top:1rem;">Where your retirement £ comes from</h3>
    ${srcBar}
  </div>

  <details class="card fold">
    <summary><span class="kicker">Scenario comparison</span><h2>Poor, Base, Positive</h2></summary>
    <div class="scenario-grid">${scenarioHtml}</div>
    <p class="note">Pot figures at ${P.retireYear} line up with your workbook's Accumulation tab. Tax is per partner: this year that saves ${fmt(E.taxOn(y1.guaranteed + y1.grossA + y1.grossB, P.tax) - y1.tax, y1.year)} versus taxing the household as one person.</p>
  </details>

  <details class="card fold">
    <summary><span class="kicker">Follow the money</span><h2>One year, every pound</h2></summary>
    <p class="sub">Where the year's money comes from and where it goes. Slide across the plan.</p>
    <div class="slider-row"><label for="flow-year">Plan year</label><output id="flow-year-out"></output></div>
    <input type="range" id="flow-year" min="0" max="${dd.rows.length - 1}" step="1" value="${Math.min(S.flowIdx, dd.rows.length - 1)}">
    <div id="flow-stage"></div>
  </details>`;

  const drawFlow = (idx) => {
    S.flowIdx = idx;
    const r = dd.rows[idx];
    $('flow-year-out').textContent = r.year + ' (age ' + r.ageA + '/' + r.ageB + ')';
    $('flow-stage').innerHTML = sankeyFor(r);
  };
  const fs = $('flow-year');
  fs.addEventListener('input', () => drawFlow(Number(fs.value)));
  drawFlow(Math.min(S.flowIdx, dd.rows.length - 1));

  // Inline scenario switch — sets growth and re-renders (header chips re-sync
  // via changed() -> syncGrowthUI()), so the user never scrolls to the header.
  el.querySelectorAll('.dash-scen button[data-dscen]').forEach(b => {
    b.onclick = () => {
      const map = { bear: P.growthBear, base: P.growthBase, bull: P.growthBull };
      S.P.growth = map[b.dataset.dscen];
      changed();
    };
  });
  wireExampleBanner();
  wireSupportPanel();

  // What-if levers: live label on drag; full recompute on release (a re-render
  // would replace the slider mid-drag, so we only commit on 'change').
  const lever = (id, outId, fmtVal, apply) => {
    const sl = $(id), out = $(outId);
    if (!sl || !out) return;
    sl.addEventListener('input', () => { out.textContent = fmtVal(Number(sl.value)); });
    sl.addEventListener('change', () => { apply(Number(sl.value)); changed(); });
  };
  lever('wi-year', 'wi-year-out', v => `${v} · age ${v - P.partnerA.birthYear}`, v => { S.P.retireYear = v; });
  lever('wi-spend', 'wi-spend-out', v => fmt(v), v => { S.P.targetNet = v; S.P.spendingPlanOn = false; });
  lever('wi-save', 'wi-save-out', v => fmt(v), v => { S.P.partnerA.monthlyPension = v; });

  $('btn-pin') && ($('btn-pin').onclick = () => {
    S.pinned = { pots: potsAtRet, endWealth: dd.endWealth, lifetimeTax: dd.lifetimeTax };
    renderTab();
  });
  $('btn-unpin') && ($('btn-unpin').onclick = () => { S.pinned = null; renderTab(); });
  $('btn-print') && ($('btn-print').onclick = () => { renderAllForPrint(); setTimeout(() => window.print(), 60); });
  $('btn-share') && ($('btn-share').onclick = async (e) => {
    const url = location.origin + location.pathname + '#plan=' + btoa(unescape(encodeURIComponent(JSON.stringify(S.P))));
    try { await navigator.clipboard.writeText(url); e.target.textContent = 'Link copied'; }
    catch { prompt('Copy this link', url); }
  });
}

function renderAssumptions(el) {
  const P = S.P;
  // Live one-line recaps shown in each collapsed section header, so the plan
  // reads as progress rather than a form dump.
  const potsNow = P.partnerA.pension + P.partnerA.isa + P.partnerB.pension + P.partnerB.isa;
  const partnerHasData = P.partnerB.pension > 0 || P.partnerB.isa > 0 || P.partnerB.db > 0 || (P.partnerB.name && P.partnerB.name !== 'Partner');
  // Remember which accordion sections are open, so editing a field (which
  // re-renders the tab) never snaps your open section shut.
  if (!S.openSecs) { S.openSecs = new Set(['vision']); if (partnerHasData) S.openSecs.add('partner'); }
  if (!S.doneSecs) S.doneSecs = new Set();
  const so = (k) => S.openSecs.has(k) ? 'open' : '';
  const recap = {
    vision: `Retire ${P.retireYear} · ${fmt(P.targetNet)}/yr${P.phase1On || P.phase2On ? ' · eases later' : ''}`,
    about: `${P.partnerA.name}${partnerHasData ? ' & ' + P.partnerB.name : ''} · ${fmtK(potsNow)} saved`,
    savings: `${fmtK(P.cash)} cash · ${fmtK(P.house)} home${P.inherit.on ? ' · inheritance' : ''}`,
    growth: `Base ${pct(P.growthBase)} · inflation ${pct(P.inflation)} · to age ${P.horizonAge}`,
  };
  const sumHead = (key, n, title, r) => `<span class="sec-step${S.doneSecs.has(key) ? ' done' : ''}">${S.doneSecs.has(key) ? '✓' : n}</span><span class="sec-title">${title}</span><span class="sec-recap">${r}</span>`;
  // The Today → Someday → horizon journey strip: the whole plan in one glance.
  const jY0 = P.startYear, jY1 = P.retireYear, jY2 = horizonYear();
  const jX = (y) => 30 + (y - jY0) / Math.max(1, jY2 - jY0) * 660;
  const journeyStrip = `<svg class="journey-strip" viewBox="0 0 720 62" role="img" aria-label="Today ${jY0}, Someday ${jY1}, planning to age ${P.horizonAge}">
    <line x1="30" y1="24" x2="690" y2="24" stroke="var(--card-edge)" stroke-width="3" stroke-linecap="round"/>
    <line x1="30" y1="24" x2="${jX(jY1).toFixed(0)}" y2="24" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="30" cy="24" r="6" fill="var(--accent)"/>
    <circle cx="${jX(jY1).toFixed(0)}" cy="24" r="8" fill="var(--accent)"/>
    <circle cx="690" cy="24" r="6" fill="none" stroke="var(--ink-faint)" stroke-width="2"/>
    <text x="30" y="52" font-size="13" fill="var(--ink-dim)">Today</text>
    <text x="${jX(jY1).toFixed(0)}" y="52" font-size="13" font-weight="700" text-anchor="middle" fill="var(--accent-strong)">Someday · ${jY1}</text>
    <text x="690" y="52" font-size="13" text-anchor="end" fill="var(--ink-dim)">to age ${P.horizonAge}</text>
  </svg>`;
  // PLSA Retirement Living Standards 2024 (couple, after tax, home owned outright)
  const PLSA = [['Minimum', 22400], ['Moderate', 43100], ['Comfortable', 59000]];
  el.innerHTML = `
  ${exampleBanner()}
  <div class="card">
    <div class="kicker">Start here</div>
    <h2>Your journey to Someday</h2>
    <p class="sub">Start with the life, then the numbers — everything stays on this device, and nothing here is financial advice; it's your working, made visible. All money inputs are in today's money.</p>

    <details class="section" data-sec="vision" ${so('vision')}>
      <summary>${sumHead('vision', 1, '🌅 Your Someday', recap.vision)}</summary>
      <div class="section-body">
        <p class="sub">Start with the life, not the spreadsheet — the year you'd like to stop work, and what enough looks like each year. You can change both any time.</p>
        <div class="grid2">
          ${numField('Retirement year', 'retireYear', 'The year you stop paying in and start drawing an income')}
          ${moneyField('Income you want each year', 'targetNet', "Today's money, after tax. The 🛒 Spending tab can build this from a monthly budget instead")}
        </div>
        <div class="seg plsa no-print" role="group" aria-label="Income benchmarks">
          ${PLSA.map(([n, v]) => `<button type="button" data-plsa="${v}" class="${Math.abs(P.targetNet - v) < 1 ? 'on' : ''}">${n} <small>${fmtK(v)}</small></button>`).join('')}
        </div>
        <p class="note">Benchmarks from the PLSA Retirement Living Standards 2024 for a couple, after tax, home owned outright — a starting point, not advice; your own number wins.</p>
        ${journeyStrip}
        <details class="subsection" data-sec="stepdowns" ${so('stepdowns')}>
          <summary>Ease spending as you age (on by default)</summary>
          <p class="sub" style="margin:0.5rem 0;">Most people spend less as they get older. Adjust or switch off.</p>
          <div class="grid2">
            <div class="field"><label class="switch"><input type="checkbox" id="ph1-on" ${P.phase1On ? 'checked' : ''}> Ease spending in later life</label></div><div></div>
            ${numField('From age', 'phase1Age')}
            ${pctField('Reduce spending by', 'phase1Cut')}
            <div class="field"><label class="switch"><input type="checkbox" id="ph2-on" ${P.phase2On ? 'checked' : ''}> A further step-down later</label></div><div></div>
            ${numField('From age', 'phase2Age')}
            ${pctField('Reduce by a further', 'phase2Cut')}
          </div>
        </details>
        ${S.exampleActive ? '' : `<div class="ex-row no-print">
          <span class="ex-lead">👀 Not sure where to start? Peek at an example:</span>
          ${EXAMPLES.map(ex => `<button type="button" class="ex-card" data-example="${ex.key}">
            <b>${ex.label}</b><span>${ex.blurb}</span>
          </button>`).join('')}
        </div>`}
      </div>
    </details>

    <details class="section" data-sec="about" ${so('about')}>
      <summary>${sumHead('about', 2, '👤 Your starting point', recap.about)}</summary>
      <div class="section-body">
        <p class="sub">Now, where you're starting from. Real names, real numbers — honest beats hopeful, and it stays on this device.</p>
        <div class="grid2">
          ${textField('Your name', 'partnerA.name', 'What we call you across the plan')}
          ${numField('Birth year', 'partnerA.birthYear')}
          ${moneyField('Pension pot today', 'partnerA.pension', 'Total value of your pensions now')}
          ${moneyField('Monthly pension investing', 'partnerA.monthlyPension', 'What you pay in each month until you retire')}
        </div>
        <details class="subsection" data-sec="aboutmore" ${so('aboutmore')}>
          <summary>More about you — State Pension, ISAs, company pension</summary>
          <div class="grid2">
            ${numField('State pension age', 'partnerA.spAge', 'Usually 67')}
            ${moneyField('State pension per year', 'partnerA.spAmount', 'Standard full new State Pension. Change if yours differs')}
            ${moneyField('ISA today', 'partnerA.isa', 'Your ISA value now (withdrawals are tax-free)')}
            ${moneyField('Monthly ISA investing', 'partnerA.monthlyIsa', 'What you add to ISAs each month')}
            ${moneyField('Company / final-salary pension per year', 'partnerA.db', 'Guaranteed income from a company/final-salary scheme (0 if none)')}
          </div>
        </details>
        <details class="subsection" data-sec="partner" ${so('partner')}>
          <summary>➕ Add your partner's details</summary>
          <p class="sub" style="margin:0.5rem 0;">Planning solo? Leave this closed.</p>
          <div class="grid2">
            ${textField('Partner’s name', 'partnerB.name', 'Leave as “Partner” if planning alone')}
            ${numField('Birth year', 'partnerB.birthYear')}
            ${moneyField('Pension pot today', 'partnerB.pension', 'Total value of their pensions now')}
            ${moneyField('Monthly pension investing', 'partnerB.monthlyPension', 'What they pay in each month until retirement')}
          </div>
          <details class="subsection" data-sec="partnermore" ${so('partnermore')}>
            <summary>More about your partner</summary>
            <div class="grid2">
              ${numField('State pension age', 'partnerB.spAge', 'Usually 67')}
              ${moneyField('State pension per year', 'partnerB.spAmount', 'Standard full new State Pension. Change if theirs differs')}
              ${moneyField('ISA today', 'partnerB.isa', 'Their ISA value now (withdrawals are tax-free)')}
              ${moneyField('Monthly ISA investing', 'partnerB.monthlyIsa', 'What they add to ISAs each month')}
              ${moneyField('Company / final-salary pension per year', 'partnerB.db', 'Guaranteed company/final-salary income (0 if none). Starts ' + P.partnerB.dbStartYear)}
            </div>
          </details>
          <label class="switch" style="margin-top:0.4rem;"><input type="checkbox" id="dbb-indexed" ${P.partnerB.dbIndexed ? 'checked' : ''}> ${poss(P.partnerB.name)} company pension rises with inflation</label>
        </details>
      </div>
    </details>

    <details class="section" data-sec="savings" ${so('savings')}>
      <summary>${sumHead('savings', 3, '🌉 Bridging & extras', recap.savings)}</summary>
      <div class="section-body">
        <p class="sub">What else helps carry you there — cash set aside, your home, and anything you expect along the way.</p>
        <div class="grid2">
          ${moneyField('Cash savings & Premium Bonds', 'cash', 'Bank or NS&I. Spent tax-free, before your ISAs')}
          ${pctField('Return on cash', 'cashGrowth', 'Interest / Premium Bond prize rate on your cash')}
          ${moneyField('House value', 'house', 'For net worth and inheritance only. It never funds your retirement income')}
          ${pctField('House growth per year', 'houseGrowth')}
        </div>
        <label class="switch" style="margin-top:0.8rem;"><input type="checkbox" id="inherit-on" ${P.inherit.on ? 'checked' : ''}> Expect an inheritance</label>
        <div class="grid2" style="margin-top:0.5rem;">
          ${numField('Year received', 'inherit.year')}
          ${moneyField('Amount', 'inherit.amount', "Today's money, indexed to the year")}
        </div>
        <label class="switch"><input type="checkbox" id="inherit-invest" ${P.inherit.invest ? 'checked' : ''}> Invest it when it arrives (compounds at your growth rate)</label>
        <div style="margin-top:0.9rem;" class="no-print">
          <button type="button" id="btn-goto-events" class="small">✏️ Add one-off life events (optional)</button>
        </div>
      </div>
    </details>

    <details class="section" data-sec="growth" ${so('growth')}>
      <summary>${sumHead('growth', 4, '🔭 The lens you look through', recap.growth + ' · optional')}</summary>
      <div class="section-body">
        <p class="sub">No one knows what markets will do, so Someday looks through three lenses instead of one guess — Poor, Base and Positive. Assumptions, not predictions; a planning tool, not financial advice. Most people leave these as they are.</p>
        <div class="grid2">
          ${pctField('Base growth rate', 'growthBase', 'Your central assumption for investment returns')}
          ${pctField('Inflation', 'inflation', 'How fast prices rise (2% is the long-run average)')}
          ${pctField('Poor rate', 'growthBear', 'A weak decade for markets')}
          ${pctField('Positive rate', 'growthBull', 'A strong decade for markets')}
          ${numField('Plan to age', 'horizonAge', 'Around 1 in 4 people who reach 65 live into their mid-90s — planning too short is the quieter risk, so 90+ is a sensible floor')}
        </div>
      </div>
    </details>

    <button type="button" id="btn-see-answer" class="cta-primary no-print">See my answer →</button>
    <details class="section" data-sec="managedata" style="margin-top:0.8rem;" ${so('managedata')}>
      <summary>🔒 Manage my data &amp; privacy</summary>
      <div class="section-body">
        <p class="sub">Everything stays on this device. You can save a copy, load one back, or wipe it all.</p>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;" class="no-print">
          <button id="btn-export" class="small">Export a copy</button>
          <button id="btn-import" class="small">Load a saved copy</button>
          <button id="btn-reset" class="small danger">Reset — delete all my data</button>
        </div>
        <input type="file" id="import-file" accept=".json" style="display:none">
        <h4 style="margin-top:1rem;">My saved plans</h4>
        <p class="sub" style="margin-bottom:0.4rem;">Keep a few versions — "retire at 60", "retire at 63" — and flip between them.</p>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;" class="no-print">
          <button id="btn-save-plan" class="small">💾 Save current plan as…</button>
        </div>
        <div class="plans-list no-print">
          ${Object.keys(savedPlans()).map(n => `<div class="plan-row"><span>${n.replace(/</g, '&lt;')}</span>
            <span><button type="button" class="small" data-loadplan="${n.replace(/"/g, '&quot;')}">Load</button>
            <button type="button" class="small ghost" data-delplan="${n.replace(/"/g, '&quot;')}">Delete</button></span></div>`).join('')}
        </div>
      </div>
    </details>
  </div>`;
  $('btn-see-answer').onclick = () => activateTab('dashboard');
  // Guided journey: Vision → Starting point → Bridging, then the answer. The
  // optional "lens" section sits outside the Continue chain. Completed steps
  // earn a ✓ in their step badge.
  const steps = [...el.querySelectorAll('details.section')].slice(0, 3);
  const stepLabels = ['Continue → who’s saving', 'Continue → what else you have', 'See my answer →'];
  steps.forEach((sec, i) => {
    const body = sec.querySelector('.section-body');
    if (!body) return;
    const next = i < 2 ? steps[i + 1] : null;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'small sec-next no-print';
    btn.textContent = stepLabels[i];
    btn.onclick = () => {
      S.doneSecs.add(sec.dataset.sec);
      const badge = sec.querySelector('.sec-step');
      if (badge) { badge.textContent = '✓'; badge.classList.add('done'); }
      sec.open = false;
      if (next) { next.open = true; next.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      else activateTab('dashboard');
    };
    body.appendChild(btn);
    // A forgiving "back" on steps 2-3: reopen the previous step
    if (i > 0) {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'small ghost sec-back no-print';
      back.textContent = '← Back';
      back.onclick = () => {
        sec.open = false;
        steps[i - 1].open = true;
        steps[i - 1].scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      body.appendChild(back);
    }
  });
  // PLSA income benchmarks: one tap sets the target (a starting point, not advice)
  el.querySelectorAll('.plsa button[data-plsa]').forEach(b => {
    b.onclick = () => { S.P.targetNet = Number(b.dataset.plsa); S.P.spendingPlanOn = false; changed(); };
  });
  el.querySelectorAll('.ex-card[data-example]').forEach(b => { b.onclick = () => enterExample(b.dataset.example); });
  // My saved plans: save current under a name; load or delete a saved one
  if ($('btn-save-plan')) $('btn-save-plan').onclick = () => {
    const name = (prompt('Name this plan (e.g. "Retire at 60")', 'Plan ' + (Object.keys(savedPlans()).length + 1)) || '').trim();
    if (!name) return;
    const plans = savedPlans();
    plans[name] = JSON.parse(JSON.stringify(S.P));
    setSavedPlans(plans);
    renderTab();
  };
  el.querySelectorAll('[data-loadplan]').forEach(b => {
    b.onclick = () => {
      const plans = savedPlans(); const p = plans[b.dataset.loadplan];
      if (p) { S.P = mergeParams(E.freshStart(), p); changed(); }
    };
  });
  el.querySelectorAll('[data-delplan]').forEach(b => {
    b.onclick = () => {
      if (!confirm('Delete saved plan "' + b.dataset.delplan + '"?')) return;
      const plans = savedPlans(); delete plans[b.dataset.delplan];
      setSavedPlans(plans); renderTab();
    };
  });
  wireExampleBanner();
  wireInputs(el);
  // Remember open/closed accordion state so a field edit (which re-renders the
  // tab) keeps your section open instead of snapping it shut.
  el.querySelectorAll('details[data-sec]').forEach(d => {
    d.addEventListener('toggle', () => {
      if (d.open) S.openSecs.add(d.dataset.sec); else S.openSecs.delete(d.dataset.sec);
    });
  });
  $('dbb-indexed').onchange = (e) => { P.partnerB.dbIndexed = e.target.checked; changed(); };
  $('ph1-on').onchange = (e) => { P.phase1On = e.target.checked; changed(); };
  $('ph2-on').onchange = (e) => { P.phase2On = e.target.checked; changed(); };
  $('btn-goto-events').onclick = () => activateTab('events');
  $('inherit-on').onchange = (e) => { P.inherit.on = e.target.checked; changed(); };
  $('inherit-invest').onchange = (e) => { P.inherit.invest = e.target.checked; changed(); };
  $('btn-export').onclick = () => {
    const blob = new Blob([JSON.stringify(S.P, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'someday-plan.json'; a.click();
  };
  $('btn-import').onclick = () => $('import-file').click();
  $('import-file').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { S.P = mergeParams(E.freshStart(), JSON.parse(r.result)); changed(); } catch { alert('Could not read that file.'); } };
    r.readAsText(f);
  };
  $('btn-reset').onclick = async () => {
    if (!confirm('Delete all your saved data and start over from the very beginning (you\'ll see the welcome and disclaimer again)?')) return;
    // A true "start over": clear the plan AND the first-run flags, drop any cached
    // app shell, then reload so the disclaimer and welcome replay exactly as a
    // brand-new visitor sees them, on the freshest code.
    try {
      ['rl4-state', 'rl_disclaimer_accepted_v', 'rl_welcomed_v1', 'rl_access_granted', 'rl_access_code']
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    try { if ('caches' in window) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } } catch (e) {}
    location.reload();
  };
}

function renderAccumulation(el) {
  const P = S.P, c = S.cache;
  const series = [
    { name: 'Poor ' + pct(P.growthBear, 1), color: COLORS.bear, acc: c.accBear },
    { name: 'Base ' + pct(P.growthBase, 1), color: COLORS.base, acc: c.accBase },
    { name: 'Positive ' + pct(P.growthBull, 1), color: COLORS.bull, acc: c.accBull },
  ];
  const total = (y) => y.pensionA + y.pensionB + y.isaA + y.isaB;
  const startTotal = P.partnerA.pension + P.partnerB.pension + P.partnerA.isa + P.partnerB.isa;
  let minV = startTotal, maxV = startTotal;
  for (const s of series) for (const y of s.acc.years) { const t = total(y); if (t < minV) minV = t; if (t > maxV) maxV = t; }
  // Dynamic Y band: start near the lowest plotted value (not £0) so year-to-year
  // movement is legible. Round to ~2 significant figures for tidy gridlines.
  const nice = (v, up) => { if (v <= 0) return 0; const m = Math.pow(10, Math.floor(Math.log10(v)) - 1); return (up ? Math.ceil(v / m) : Math.floor(v / m)) * m; };
  const span = maxV - minV, pad = span > 0 ? span * 0.12 : (maxV * 0.05 || 1);
  const lo = Math.max(0, nice(minV - pad, false)), hi = nice(maxV + pad, true);

  const ch = chart({
    xDomain: [P.startYear, P.retireYear], yDomain: [lo, hi],
    yFmt: (v) => fmtK(v), xTicks: Math.min(6, Math.max(1, P.retireYear - P.startYear)), label: 'Accumulation to retirement',
  });
  for (const s of series) {
    const pts = [[P.startYear, startTotal], ...s.acc.years.map(y => [y.year, total(y)])];
    ch.add(`<path d="${linePath(pts, ch.X, ch.Y)}" fill="none" stroke="${s.color}" stroke-width="${s.acc === c.accBase ? 3 : 1.8}" ${s.acc === c.accBase ? '' : 'stroke-dasharray="5 4" opacity="0.75"'}/>`);
  }

  const contribA = P.partnerA.monthlyPension * 12 * (P.retireYear - P.startYear);
  const contribB = P.partnerB.monthlyPension * 12 * (P.retireYear - P.startYear);
  const at = c.accBase.atRetirement;
  const warns = c.accBase.warnings || [];
  el.innerHTML = `
  <div class="card">
    <div class="kicker">Getting to April ${P.retireYear}</div>
    <h2>Accumulation</h2>
    <p class="sub">Pensions plus ISAs, growing with your monthly investing of ${fmt(P.partnerA.monthlyPension + P.partnerB.monthlyPension + P.partnerA.monthlyIsa + P.partnerB.monthlyIsa)} a month across the household.</p>
    ${ch.get()}
    <div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div>
    <p class="note">The vertical axis starts at ${fmtK(lo)}, not £0, so year-to-year movement is easy to see.</p>
    <div class="kpis" style="margin-top:0.9rem;">
      <div class="kpi"><div class="v">${fmtK(at.pensionA, P.retireYear)}</div><div class="k">${poss(P.partnerA.name)} pension at ${P.retireYear}</div></div>
      <div class="kpi"><div class="v">${fmtK(at.pensionB, P.retireYear)}</div><div class="k">${poss(P.partnerB.name)} pension</div></div>
      <div class="kpi"><div class="v">${fmtK(at.isaA + at.isaB, P.retireYear)}</div><div class="k">ISAs combined</div></div>
    </div>
    ${warns.map(w => `<div class="callout">⚠️ ${w}</div>`).join('')}
    <p class="note">You will have paid in ${fmt(contribA)} (${P.partnerA.name}) and ${fmt(contribB)} (${P.partnerB.name}) of contributions by retirement.</p>
  </div>

  <div class="card">
    <div class="kicker">Year by year</div>
    <h2>The path, base scenario</h2>
    <div class="tbl-wrap"><table class="data">
      <tr><th>Year</th><th>${poss(P.partnerA.name)} pension</th><th>${poss(P.partnerB.name)} pension</th><th>ISAs</th><th>Total investable</th></tr>
      ${c.accBase.years.map(y => `<tr><td>${y.year}</td><td>${fmt(y.pensionA, y.year)}</td><td>${fmt(y.pensionB, y.year)}</td><td>${fmt(y.isaA + y.isaB, y.year)}</td><td>${fmt(total(y), y.year)}</td></tr>`).join('')}
    </table></div>
  </div>`;
}

function renderSpending(el) {
  const P = S.P;
  const totalMonthly = P.spending.reduce((s, r) => s + (Number(r.monthly) || 0), 0);
  el.innerHTML = `
  <div class="card">
    <div class="kicker">Expenditure builder</div>
    <h2>What does a month cost?</h2>
    <p class="sub">Today's money. Build your real monthly spend, then flip the switch to use it as the plan's income target.</p>
    <div class="spend-total"><span>Total</span><span class="v">${fmt(totalMonthly)} / month, ${fmt(totalMonthly * 12)} / year</span></div>
    <label class="switch" style="margin-top:0.5rem;">
      <input type="checkbox" id="spend-on" ${P.spendingPlanOn ? 'checked' : ''}>
      Use this as my income target (currently ${P.spendingPlanOn ? 'on' : 'off, using ' + fmt(P.targetNet)})
    </label>
    <details class="subsection">
      <summary>Edit the ${P.spending.length} spending categories</summary>
      ${P.spending.map((r, i) => `
        <div class="spend-row">
          <label>${r.label}</label>
          <input type="text" inputmode="decimal" data-spend="${i}" value="${r.monthly}">
        </div>`).join('')}
    </details>
  </div>

  <div class="card">
    <div class="kicker">Spending through retirement</div>
    <h2>Slow down later, spend less</h2>
    <p class="sub">Most retirees spend less as they age. ${P.phase1On || P.phase2On ? 'Your plan eases spending' + (P.phase1On ? ' by ' + pct(P.phase1Cut) + ' from age ' + P.phase1Age : '') + (P.phase2On ? ', then by a further ' + pct(P.phase2Cut) + ' from age ' + P.phase2Age : '') + '.' : 'These step-downs are currently off.'} Change this under <strong>Your details → Your Someday</strong>.</p>
    <div id="spend-curve" style="margin-top:0.8rem;"></div>
    <p class="note">Shown in today's money so the phase steps are visible without inflation on top.</p>
  </div>`;

  const retAge = P.retireYear - P.partnerA.birthYear;
  const pts = [];
  for (let a = retAge; a <= P.horizonAge; a++) {
    pts.push([a, E.spendingAnnual(P) * E.phaseFactor(P, a)]);
  }
  const maxY = Math.max(...pts.map(p => p[1])) * 1.15 + 1;
  const ch = chart({ xDomain: [retAge, P.horizonAge], yDomain: [0, maxY], yFmt: (v) => fmtK(v), label: 'Spending by age', h: 200 });
  ch.add(`<path d="${areaPath(pts, [[P.horizonAge, 0], [retAge, 0]], ch.X, ch.Y)}" fill="var(--accent-soft)"/>`);
  ch.add(`<path d="${linePath(pts, ch.X, ch.Y)}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>`);
  if (P.phase1On) ch.add(`<line x1="${ch.X(P.phase1Age)}" y1="16" x2="${ch.X(P.phase1Age)}" y2="${200 - 26}" stroke="var(--amber)" stroke-dasharray="4 4"/><text x="${ch.X(P.phase1Age) + 4}" y="24" font-size="9" fill="var(--amber)">age ${P.phase1Age}</text>`);
  if (P.phase2On) ch.add(`<line x1="${ch.X(P.phase2Age)}" y1="16" x2="${ch.X(P.phase2Age)}" y2="${200 - 26}" stroke="var(--rose)" stroke-dasharray="4 4"/><text x="${ch.X(P.phase2Age) + 4}" y="24" font-size="9" fill="var(--rose)">age ${P.phase2Age}</text>`);
  $('spend-curve').innerHTML = ch.get();

  el.querySelectorAll('input[data-spend]').forEach(inp => {
    inp.addEventListener('change', () => {
      P.spending[Number(inp.dataset.spend)].monthly = parseFloat(inp.value.replace(/[£,\s]/g, '')) || 0;
      changed();
    });
  });
  $('spend-on').onchange = (e) => { P.spendingPlanOn = e.target.checked; changed(); };
  wireInputs(el);
}

function renderDrawdown(el) {
  const P = S.P, dd = S.cache.dd;
  const rows = dd.rows;

  const layers = [
    { key: (r) => r.dbA + r.dbB, name: 'defined-benefit pension', color: COLORS.db },
    { key: (r) => r.spB, name: P.partnerB.name + ' state pension', color: COLORS.spB },
    { key: (r) => r.spA, name: P.partnerA.name + ' state pension', color: COLORS.spA },
    { key: (r) => r.grossA + r.grossB - r.taxA - r.taxB, name: 'Pension income after tax', color: COLORS.pension },
    { key: (r) => r.tfcA + r.tfcB, name: 'Tax-free cash', color: COLORS.pcls },
    { key: (r) => r.isaDraw + r.cashDraw, name: 'ISA and cash', color: COLORS.isa },
  ];
  const dv = (v, r) => deflate(v, r.year);
  let maxY = 0;
  for (const r of rows) maxY = Math.max(maxY, dv(r.netIncome, r), dv(r.target, r));
  const ch = chart({ xDomain: [rows[0].year, rows[rows.length - 1].year], yDomain: [0, maxY * 1.12 + 1], yFmt: (v) => fmtK(v), label: 'Income layers by year', h: 280 });
  let baseline = rows.map(r => [r.year, 0]);
  for (const L of layers) {
    const top = rows.map((r, i) => [r.year, baseline[i][1] + dv(Math.max(0, L.key(r)), r)]);
    ch.add(`<path d="${areaPath(top, baseline, ch.X, ch.Y)}" fill="${L.color}" opacity="0.82"/>`);
    baseline = top;
  }
  ch.add(`<path d="${linePath(rows.map(r => [r.year, dv(r.target, r)]), ch.X, ch.Y)}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="6 4"/>`);

  let maxW = 0;
  for (const r of rows) maxW = Math.max(maxW, dv(r.potA, r), dv(r.isaA + r.isaB + r.cash, r), dv(r.potB, r));
  const ch2 = chart({ xDomain: [rows[0].year, rows[rows.length - 1].year], yDomain: [0, maxW * 1.08 + 1], yFmt: (v) => fmtK(v), label: 'Pot balances', h: 220 });
  ch2.add(`<path d="${linePath(rows.map(r => [r.year, dv(r.potA, r)]), ch2.X, ch2.Y)}" fill="none" stroke="${COLORS.pension}" stroke-width="2.5"/>`);
  ch2.add(`<path d="${linePath(rows.map(r => [r.year, dv(r.potB, r)]), ch2.X, ch2.Y)}" fill="none" stroke="${COLORS.spB}" stroke-width="2"/>`);
  ch2.add(`<path d="${linePath(rows.map(r => [r.year, dv(r.isaA + r.isaB + r.cash, r)]), ch2.X, ch2.Y)}" fill="none" stroke="${COLORS.isa}" stroke-width="2"/>`);

  el.innerHTML = `
  <div class="card">
    <div class="kicker">Income layering, ${P.retireYear} to ${rows[rows.length - 1].year}</div>
    <h2>Who pays for each year</h2>
    <p class="sub">Guaranteed income first, pensions allocated by marginal rate so both allowances are used, ISAs for the excess. The dashed line is your income need.</p>
    ${ch.get()}
    <div class="legend">${layers.map(L => `<span><i style="background:${L.color}"></i>${L.name}</span>`).join('')}<span><i style="background:var(--ink)"></i>Need</span></div>
  </div>

  <div class="card">
    <div class="kicker">Pot balances</div>
    <h2>What is left</h2>
    ${ch2.get()}
    <div class="legend">
      <span><i style="background:${COLORS.pension}"></i>${poss(P.partnerA.name)} pension</span>
      <span><i style="background:${COLORS.spB}"></i>${poss(P.partnerB.name)} pension</span>
      <span><i style="background:${COLORS.isa}"></i>ISAs and cash</span>
    </div>
    ${dd.exhaustedAgeA ? `<div class="callout">⚠️ The pots run dry at age ${dd.exhaustedAgeA}. Try a later retirement, a lower target, or the spending reductions on the 🛒 tab.</div>` : ''}
  </div>

  <details class="card fold">
    <summary><span class="kicker">Year by year</span><h2>Show the full table</h2></summary>
    <p class="sub">Your income year by year, with each partner's tax. ${S.todayMoney ? "Today's money." : 'Nominal figures.'}</p>
    <div style="margin-bottom:0.5rem;" class="no-print"><button id="btn-csv" class="small">Download CSV</button></div>
    <div class="tbl-scroll"><div class="tbl-wrap"><table class="data sticky-first">
      <tr><th>Year</th><th>Age ${P.partnerA.name[0]}/${P.partnerB.name[0]}</th><th>Guaranteed</th><th>Pension draw</th><th>Tax-free</th><th>Tax</th><th>ISA draw</th><th>Net income</th><th>Need</th><th>Pension pots</th><th>ISAs</th></tr>
      ${rows.map(r => `<tr${r.shortfall > 1 ? ' class="warn"' : (r.eventLabels.length ? ' class="hl" title="' + r.eventLabels.join(', ') + '"' : '')}>
        <td>${r.year}${r.eventLabels.length ? ' 🎉' : ''}</td><td>${r.ageA}/${r.ageB}</td>
        <td>${fmt(r.guaranteed, r.year)}</td>
        <td>${fmt(r.grossA + r.grossB, r.year)}</td>
        <td>${fmt(r.tfcA + r.tfcB, r.year)}</td>
        <td>${fmt(r.tax, r.year)}</td>
        <td>${fmt(r.isaDraw + r.cashDraw, r.year)}</td>
        <td>${fmt(r.netIncome, r.year)}</td>
        <td>${fmt(r.target + r.eventCost, r.year)}</td>
        <td>${fmt(r.potA + r.potB, r.year)}</td>
        <td>${fmt(r.isaA + r.isaB + r.cash, r.year)}</td>
      </tr>`).join('')}
    </table></div><span class="scroll-hint" aria-hidden="true">Scroll →</span></div>
  </details>`;

  // Show the "scroll right" affordance only while the table actually overflows.
  const box = el.querySelector('.tbl-scroll');
  const sc = box && box.querySelector('.tbl-wrap');
  if (box && sc) {
    const upd = () => {
      const over = sc.scrollWidth - sc.clientWidth > 1;
      box.classList.toggle('overflowing', over);
      box.classList.toggle('at-end', sc.scrollLeft >= sc.scrollWidth - sc.clientWidth - 1);
    };
    sc.addEventListener('scroll', upd);
    window.addEventListener('resize', upd);
    // Recompute when the collapsed table is first opened (it has no width until then).
    const tableCard = box.closest('details.fold');
    if (tableCard) tableCard.addEventListener('toggle', upd);
    upd();
  }

  $('btn-csv').onclick = () => {
    const head = ['year', 'ageA', 'ageB', 'guaranteed', 'pensionDrawGross', 'taxFreeCash', 'tax', 'isaDraw', 'netIncome', 'need', 'pensionPots', 'isas'];
    const lines = [head.join(',')];
    for (const r of rows) {
      lines.push([r.year, r.ageA, r.ageB, r.guaranteed, r.grossA + r.grossB, r.tfcA + r.tfcB, r.tax,
        r.isaDraw + r.cashDraw, r.netIncome, r.target + r.eventCost,
        r.potA + r.potB, r.isaA + r.isaB + r.cash].map(v => Math.round(v)).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'someday-drawdown.csv'; a.click();
  };
}

function renderTax(el) {
  const P = S.P, dd = S.cache.dd;
  const strategies = S.cache.strategies;
  const best = strategies.reduce((a, b) => (b.lifetimeTax < a.lifetimeTax ? b : a));
  const worst = strategies.reduce((a, b) => (b.lifetimeTax > a.lifetimeTax ? b : a));
  const endYear = horizonYear();

  el.innerHTML = `
  <div class="card">
    <div class="kicker">Where the money comes from</div>
    <h2>Three ways to fund the same life</h2>
    <p class="lead-summary">💡 Drawing your money in the smartest order saves about <strong>${fmtK(worst.lifetimeTax - best.lifetimeTax)}</strong> in tax over your whole plan — Someday shows you the order that costs least tax in this model.</p>
    <p class="sub">Tap a strategy to adopt it; every tab recomputes. Lifetime tax shown in future pounds.</p>
    <div class="strategies">
      ${strategies.map(s => `
        <div class="strategy ${P.strategy === s.id ? 'on' : ''}" data-strat="${s.id}" role="button" tabindex="0">
          ${s.id === best.id ? '<span class="badge">LOWEST TAX</span>' : ''}
          <div class="name">${s.label}</div>
          <div class="stat">Lifetime tax <b>${fmtK(s.lifetimeTax)}</b></div>
          <div class="stat">Wealth at ${P.horizonAge}: <b>${fmtK(s.endWealth, endYear)}</b></div>
          <div class="stat">${s.exhaustedAgeA == null ? 'Never exhausts' : 'Runs dry at ' + s.exhaustedAgeA}</div>
        </div>`).join('')}
    </div>
    <h3>Tax-free cash</h3>
    <div class="seg" role="group" aria-label="Tax-free cash choice">
      <button data-pcls="none" class="${P.pclsMode === 'none' ? 'on' : ''}">Take none</button>
      <button data-pcls="phased" class="${P.pclsMode === 'phased' ? 'on' : ''}">A little each year</button>
      <button data-pcls="upfront" class="${P.pclsMode === 'upfront' ? 'on' : ''}">All at retirement</button>
    </div>
    <p class="note">Phased takes a quarter of each year's withdrawal tax-free until the ${fmt(P.tax.pclsCap)} cap. Upfront takes all your tax-free cash at retirement and the proceeds are modelled as staying invested; tax on growth outside wrappers is not modelled.</p>
  </div>

  <div class="card">
    <div class="kicker">Band vessels</div>
    <h2>Where HMRC takes it, year by year</h2>
    <p class="sub">Each partner has their own allowance and bands. Slide across the plan.</p>
    <div class="slider-row"><label for="tax-year">Plan year</label><output id="tax-year-out"></output></div>
    <input type="range" id="tax-year" min="0" max="${dd.rows.length - 1}" step="1" value="0">
    <div id="vessels"></div>
    <p class="note" id="vessel-note"></p>
  </div>`;

  el.querySelectorAll('[data-strat]').forEach(d => {
    const go = () => { P.strategy = d.dataset.strat; changed(); };
    d.onclick = go;
    d.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
  el.querySelectorAll('[data-pcls]').forEach(b => b.onclick = () => { P.pclsMode = b.dataset.pcls; changed(); });

  const drawVessels = (idx) => {
    const r = dd.rows[idx];
    $('tax-year-out').textContent = r.year + ' (age ' + r.ageA + '/' + r.ageB + ')';
    const T = P.tax;
    const partner = (name, base, gross, tfc, tax, marginal) => {
      const income = base + gross;
      const pa = E.personalAllowanceFor(income, T);
      const inPA = Math.min(income, pa);
      const inBasic = Math.max(0, Math.min(income, T.higherThreshold) - pa);
      const inHigher = Math.max(0, income - T.higherThreshold);
      const W = 340, H = 150, bx = 10;
      const segW = (W - 2 * bx);
      const scale = Math.max(income, T.higherThreshold * 1.15);
      const seg = (x, w, color, label) => w < 0.5 ? '' : `
        <rect x="${x}" y="56" width="${w}" height="34" rx="6" fill="${color}" opacity="0.9"/>
        ${w > 46 ? `<text x="${x + w / 2}" y="77" text-anchor="middle" font-size="9" fill="#fff" font-weight="700">${label}</text>` : ''}`;
      let x = bx;
      let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${name} tax bands">`;
      svg += `<text x="${bx}" y="16" font-size="11" font-weight="800" fill="var(--ink)">${name}</text>`;
      svg += `<text x="${bx}" y="34" font-size="9.5" fill="var(--ink-dim)">Taxable income ${fmt(income, r.year)}, tax ${fmt(tax, r.year)}, marginal ${pct(marginal)}</text>`;
      svg += `<text x="${bx}" y="48" font-size="9.5" fill="var(--ink-faint)">Allowance ${fmt(pa)}${tfc > 0 ? ' plus ' + fmt(tfc, r.year) + ' tax-free cash outside the bands' : ''}</text>`;
      const wPA = inPA / scale * segW, wB = inBasic / scale * segW, wH = inHigher / scale * segW;
      svg += seg(x, wPA, 'var(--ink-faint)', '0%'); x += wPA;
      svg += seg(x, wB, '#0e7a6e', '20%'); x += wB;
      svg += seg(x, wH, '#b45309', '40%'); x += wH;
      const paX = bx + pa / scale * segW, hiX = bx + T.higherThreshold / scale * segW;
      svg += `<line x1="${paX}" y1="52" x2="${paX}" y2="96" stroke="var(--ink-faint)" stroke-dasharray="3 3"/>`;
      svg += `<line x1="${hiX}" y1="52" x2="${hiX}" y2="96" stroke="var(--amber)" stroke-dasharray="3 3"/>`;
      svg += `<text x="${hiX}" y="108" text-anchor="middle" font-size="8.5" fill="var(--amber)">40% from ${fmtK(T.higherThreshold)}</text>`;
      if (tfc > 0) {
        svg += `<rect x="${bx}" y="118" width="${Math.min(segW, tfc / scale * segW)}" height="14" rx="7" fill="${COLORS.pcls}"/>`;
        svg += `<text x="${bx + 4}" y="129" font-size="8.5" fill="#1a2422" font-weight="700">tax-free cash, bypasses every band</text>`;
      }
      return svg + '</svg>';
    };
    $('vessels').innerHTML =
      partner(P.partnerA.name, r.spA + r.dbA, r.grossA, r.tfcA, r.taxA, r.marginalA) +
      partner(P.partnerB.name, r.spB + r.dbB, r.grossB, r.tfcB, r.taxB, r.marginalB);
    const merged = E.taxOn(r.guaranteed + r.grossA + r.grossB, T);
    $('vessel-note').textContent =
      'Two allowances beat one: taxing this year as a single person would cost ' + fmt(merged, r.year) +
      '. Split between you it is ' + fmt(r.tax, r.year) + ', saving ' + fmt(merged - r.tax, r.year) + '.';
  };
  const sl = $('tax-year');
  sl.addEventListener('input', () => drawVessels(Number(sl.value)));
  drawVessels(0);
}

function renderEvents(el) {
  const P = S.P;
  const rows = P.lifeEvents.map((ev, i) => `
    <div class="event-row">
      <input type="number" data-ev="${i}" data-k="year" value="${ev.year}" aria-label="Year">
      <input type="text" data-ev="${i}" data-k="label" value="${ev.label || ''}" placeholder="What happens" aria-label="Label">
      <input type="text" inputmode="decimal" data-ev="${i}" data-k="amount" value="${ev.amount}" aria-label="Amount">
      <select data-ev="${i}" data-k="kind" aria-label="Type">
        <option value="cost" ${ev.kind === 'cost' ? 'selected' : ''}>Cost</option>
        <option value="income" ${ev.kind !== 'cost' ? 'selected' : ''}>Income</option>
      </select>
      <button class="small danger" data-del="${i}" aria-label="Remove">✕</button>
    </div>
    ${ev.kind !== 'cost' ? `<label class="switch event-invest"><input type="checkbox" data-ev="${i}" data-k="invest" ${ev.invest ? 'checked' : ''}> Invest it (goes into the ISA pot and grows)</label>` : ''}
  `).join('');

  el.innerHTML = `
  <div class="card">
    <div class="kicker">One-off moments</div>
    <h2>Life events</h2>
    <p class="sub">New car, a wedding, the big trip, a house deposit gift. Amounts are today's money and are indexed to the year they happen. Costs are met from ISAs first, then pensions. Your expected inheritance has its own line on the ⚙️ Your details tab${P.inherit.on ? ' and is switched on: ' + fmt(P.inherit.amount) + ' in ' + P.inherit.year : ''}.</p>
    ${rows || '<p class="note">Nothing yet. Add your first event below.</p>'}
    <div style="display:flex; gap:0.5rem; margin-top:0.7rem; flex-wrap:wrap;" class="no-print">
      <button id="ev-add-cost" class="small">+ Add a cost</button>
      <button id="ev-add-income" class="small">+ Add income</button>
    </div>
  </div>
  <div class="card" id="ev-impact"></div>`;

  const impact = () => {
    const bareP = JSON.parse(JSON.stringify(P));
    bareP.lifeEvents = []; bareP.inherit = { ...bareP.inherit, on: false };
    const base = E.drawdown(bareP);
    const withEv = S.cache.dd;
    const d = withEv.endWealth - base.endWealth;
    const endYear = horizonYear();
    const nEvents = P.lifeEvents.length + (P.inherit.on ? 1 : 0);
    $('ev-impact').innerHTML = `
      <div class="kicker">Impact</div>
      <h2>What your events do to the plan</h2>
      <div class="kpis">
        <div class="kpi"><div class="v">${nEvents}</div><div class="k">Events including inheritance</div></div>
        <div class="kpi ${d >= 0 ? 'good' : 'bad'}"><div class="v">${d >= 0 ? '+' : ''}${fmtK(d, endYear)}</div><div class="k">Wealth at ${P.horizonAge} vs no events</div></div>
        <div class="kpi ${withEv.exhaustedAgeA ? 'bad' : 'good'}"><div class="v">${withEv.exhaustedAgeA == null ? P.horizonAge + '+' : withEv.exhaustedAgeA}</div><div class="k">Pot lasts to</div></div>
      </div>
      <p class="note">An invested windfall compounds at your growth rate inside the ISA pot; spent as cash it only offsets that year's need.</p>`;
  };
  impact();

  const add = (ev) => { P.lifeEvents.push(ev); changed(); };
  $('ev-add-cost').onclick = () => add({ year: P.retireYear + 2, label: 'New car', amount: 25000, kind: 'cost' });
  $('ev-add-income').onclick = () => add({ year: P.retireYear + 1, label: 'Downsize or windfall', amount: 50000, kind: 'income', invest: false });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { P.lifeEvents.splice(Number(b.dataset.del), 1); changed(); });
  el.querySelectorAll('[data-ev]').forEach(inp => {
    inp.addEventListener('change', () => {
      const ev = P.lifeEvents[Number(inp.dataset.ev)];
      const k = inp.dataset.k;
      if (k === 'invest') ev.invest = inp.checked;
      else if (k === 'label') ev.label = inp.value;
      else if (k === 'kind') ev.kind = inp.value;
      else ev[k] = parseFloat(String(inp.value).replace(/[£,\s]/g, '')) || 0;
      changed();
    });
  });
}

function renderRisk(el) {
  const P = S.P;
  const st = S.cache.stress;
  const grid = S.cache.grid;
  const tor = S.cache.tornado;
  const mc = S.mc;
  const endYear = horizonYear();

  const heatColor = (age) => {
    // Continuous ramp: rose (dies early) → amber (mid) → teal (lasts), tinted
    // into the card so cell text stays legible. A field, not three buckets.
    let ramp;
    if (age == null) ramp = 'var(--accent)';
    else {
      const t = Math.max(0, Math.min(1, (age - 72) / Math.max(1, P.horizonAge - 72)));
      ramp = t < 0.5
        ? `color-mix(in srgb, var(--amber) ${Math.round(t / 0.5 * 100)}%, var(--rose))`
        : `color-mix(in srgb, var(--accent) ${Math.round((t - 0.5) / 0.5 * 100)}%, var(--amber))`;
    }
    return `color-mix(in srgb, ${ramp} ${age == null ? 44 : 40}%, var(--card))`;
  };
  const heatText = (age) => age == null ? 'Never' : 'age ' + age;

  // Tornado chart
  const maxAbs = Math.max(...tor.bars.map(b => Math.max(Math.abs(b.up), Math.abs(b.down)))) || 1;
  const TW = 720, rowH = 34, TH = tor.bars.length * rowH + 30;
  const cx = TW * 0.55, half = TW * 0.40;
  let tsvg = `<svg class="chart" viewBox="0 0 ${TW} ${TH}" role="img" aria-label="Sensitivity tornado">`;
  tsvg += `<line x1="${cx}" y1="8" x2="${cx}" y2="${TH - 20}" stroke="var(--ink-faint)" stroke-width="1"/>`;
  tor.bars.forEach((b, i) => {
    const y = 12 + i * rowH;
    const wUp = Math.abs(b.up) / maxAbs * half, wDn = Math.abs(b.down) / maxAbs * half;
    const xUp = b.up >= 0 ? cx : cx - wUp;
    const xDn = b.down >= 0 ? cx : cx - wDn;
    tsvg += `<rect x="${xDn}" y="${y}" width="${Math.max(1, wDn)}" height="10" rx="3" fill="var(--rose)" opacity="0.8"/>`;
    tsvg += `<rect x="${xUp}" y="${y + 11}" width="${Math.max(1, wUp)}" height="10" rx="3" fill="var(--accent)" opacity="0.9"/>`;
    tsvg += `<text x="8" y="${y + 14}" font-size="10" fill="var(--ink-dim)">${b.label}</text>`;
    tsvg += `<text x="${cx + half + 2}" y="${y + 9}" font-size="8.5" fill="var(--rose)" text-anchor="end">${fmtK(b.down)}</text>`;
    tsvg += `<text x="${cx + half + 2}" y="${y + 20}" font-size="8.5" fill="var(--accent-strong)" text-anchor="end">+${fmtK(b.up)}</text>`;
  });
  tsvg += '</svg>';

  let mcHtml = '<p class="sub">Running ' + P.mcPaths + ' market paths in the background…</p>';
  if (mc) {
    const nY = mc.tracks[0] ? mc.tracks[0].length : 0;
    const retY = P.retireYear;
    // Per-year percentiles from the sample tracks (presentation only — reads
    // existing data). A calm P10–P90 band with a median line beats 60 lines of
    // spaghetti and lets you read a typical outcome at a glance.
    const pctl = (arr, p) => { const s = arr.filter(v => v != null).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))] : 0; };
    const bandTop = [], bandBot = [], mid = [];
    for (let i = 0; i < nY; i++) {
      const col = mc.tracks.map(t => t[i]); const y = retY + i;
      bandTop.push([y, deflate(pctl(col, 0.9), y)]);
      bandBot.push([y, deflate(pctl(col, 0.1), y)]);
      mid.push([y, deflate(pctl(col, 0.5), y)]);
    }
    let maxY = 1; for (const p of bandTop) maxY = Math.max(maxY, p[1]);
    const ch = chart({ xDomain: [retY, retY + nY - 1], yDomain: [0, maxY * 1.08], yFmt: (v) => fmtK(v), h: 230, label: 'Range of outcomes across market histories' });
    // A few faint sample paths for texture, then the band, then the median.
    const stepK = Math.max(1, Math.floor(mc.tracks.length / 6));
    for (let k = 0; k < mc.tracks.length; k += stepK) {
      ch.add(`<path d="${linePath(mc.tracks[k].map((v, i) => [retY + i, deflate(v, retY + i)]), ch.X, ch.Y)}" fill="none" stroke="var(--accent)" stroke-width="0.6" opacity="0.09"/>`);
    }
    ch.add(`<path d="${areaPath(bandTop, bandBot, ch.X, ch.Y)}" fill="var(--accent)" opacity="0.15"/>`);
    ch.add(`<path d="${linePath(bandBot, ch.X, ch.Y)}" fill="none" stroke="var(--accent)" stroke-width="1" opacity="0.35" stroke-dasharray="3 3"/>`);
    ch.add(`<path d="${linePath(bandTop, ch.X, ch.Y)}" fill="none" stroke="var(--accent)" stroke-width="1" opacity="0.35" stroke-dasharray="3 3"/>`);
    ch.add(`<path d="${linePath(mid, ch.X, ch.Y)}" fill="none" stroke="var(--accent)" stroke-width="2.4"/>`);
    const lx = ch.X(retY + nY - 1) - 3;
    ch.add(`<text x="${lx}" y="${ch.Y(bandTop[nY - 1][1]) - 4}" text-anchor="end" style="font-size:11px" fill="var(--ink-dim)">lucky</text>`);
    ch.add(`<text x="${lx}" y="${ch.Y(mid[nY - 1][1]) - 4}" text-anchor="end" style="font-size:11px" fill="var(--accent-strong)">typical</text>`);
    ch.add(`<text x="${lx}" y="${ch.Y(bandBot[nY - 1][1]) + 13}" text-anchor="end" style="font-size:11px" fill="var(--ink-dim)">unlucky</text>`);
    mcHtml = `
      <div class="kpis" style="margin-bottom:0.8rem;">
        <div class="kpi ${mc.successProb >= 0.85 ? 'good' : mc.successProb >= 0.6 ? 'warn' : 'bad'}"><div class="v">${pct(mc.successProb)}</div><div class="k">How often your money lasts to ${P.horizonAge}</div></div>
        <div class="kpi"><div class="v">${mc.confidenceAge}</div><div class="k">Money lasted to at least this age in 9 of 10 market runs</div></div>
        <div class="kpi"><div class="v">${fmtK(mc.finalP50, endYear)}</div><div class="k">Typical wealth left at ${P.horizonAge} (unlucky ${fmtK(mc.finalP10, endYear)}, lucky ${fmtK(mc.finalP90, endYear)})</div></div>
      </div>
      ${ch.get()}
      <p class="note">The shaded band spans the unlucky-to-lucky range (10th–90th percentile) across ${mc.nPaths} simulated market histories${S.todayMoney ? ", in today's money" : ''}; the solid line is the typical (median) outcome. Funding each year mirrors the main model. If a path falls short, the median income trim needed is ${pct(mc.medianTrim)}.</p>`;
  }

  el.innerHTML = `
  <div class="card">
    <div class="kicker">Good and bad markets</div>
    <h2>Does the plan hold up if markets misbehave?</h2>
    <p class="lead-summary">${mc ? `In about <strong>${pct(mc.successProb)}</strong> of ${P.mcPaths} possible market histories — booms and crashes alike — your money still lasts to age ${P.horizonAge}.` : `Testing your plan against ${P.mcPaths} possible market histories…`}</p>
    ${mcHtml}
  </div>

  <div class="card">
    <div class="kicker">What actually moves the answer</div>
    <h2>Sensitivity tornado</h2>
    <p class="sub">Each assumption nudged both ways; bars show the change in wealth at ${P.horizonAge}, in today's money. The longest bars deserve your attention first.</p>
    ${tsvg}
    <div class="legend"><span><i style="background:var(--accent)"></i>favourable move</span><span><i style="background:var(--rose)"></i>unfavourable move</span></div>
  </div>

  <div class="card">
    <div class="kicker">Stress tests</div>
    <h2>How the plan bends</h2>
    <p class="sub">Your workbook's scenarios through the full model. Compared in today's money so different inflation assumptions stay honest.</p>
    <div class="tbl-wrap"><table class="data">
      <tr><th>Scenario</th><th>Wealth at ${P.horizonAge}, today's £</th><th>Change</th><th>Lasts to</th></tr>
      <tr class="hl"><td>Base plan</td><td>${fmtK(st.baseReal)}</td><td></td><td>${st.base.exhaustedAgeA == null ? P.horizonAge + '+' : st.base.exhaustedAgeA}</td></tr>
      ${st.tests.map(t => `<tr><td title="${t.note}">${t.label}</td><td>${fmtK(t.endWealthReal)}</td>
        <td class="${t.delta >= 0 ? 'pos' : 'neg'}">${t.delta >= 0 ? '+' : ''}${fmtK(t.delta)}</td>
        <td>${t.exhaustedAgeA == null ? P.horizonAge + '+' : 'age ' + t.exhaustedAgeA}</td></tr>`).join('')}
    </table></div>
  </div>

  <div class="card">
    <div class="kicker">Sensitivity</div>
    <h2>How long the money lasts, by target and growth</h2>
    <p class="sub">Each cell is the age the pot runs dry for that yearly spend (today's money) and growth rate — teal lasts to the end, rose runs dry early.</p>
    <div class="tbl-wrap"><table class="data">
      <tr><th>Target</th>${grid.growths.map(g => `<th>${pct(g)}</th>`).join('')}</tr>
      ${grid.grid.map(row => `<tr><td>${fmtK(row.withdrawal)}</td>
        ${row.cells.map(c => `<td class="heat" style="background:${heatColor(c.exhaustedAgeA)}">${heatText(c.exhaustedAgeA)}</td>`).join('')}</tr>`).join('')}
    </table></div>
    <div class="heat-legend"><span>Runs dry early</span><span class="heat-bar" aria-hidden="true"></span><span>Never runs dry</span></div>
  </div>`;
}

function renderEstate(el) {
  const P = S.P;
  const es = S.cache.estate;
  el.innerHTML = `
  <div class="card">
    <div class="kicker">Inheritance tax</div>
    <h2>Estate at age ${P.horizonAge} (${es.year})</h2>
    <p class="sub">Base scenario. Pensions ${es.pensionsIn ? 'are inside' : 'stay outside'} the estate under the ${P.iht.pensionsInEstateFrom} rule change. ${S.todayMoney ? "Today's money." : 'Nominal figures.'}</p>
    <div class="tbl-wrap"><table class="data">
      <tr><th>Component</th><th>Value</th><th>In IHT scope</th></tr>
      <tr><td>House at ${pct(P.houseGrowth)} a year</td><td>${fmt(es.house, es.year)}</td><td>Yes</td></tr>
      <tr><td>ISAs and cash</td><td>${fmt(es.isas, es.year)}</td><td>Yes</td></tr>
      <tr><td>Pensions remaining</td><td>${fmt(es.pensions, es.year)}</td><td>${es.pensionsIn ? 'Yes, from ' + P.iht.pensionsInEstateFrom : 'No'}</td></tr>
      <tr class="hl"><td>Estate in scope</td><td>${fmt(es.inScope, es.year)}</td><td></td></tr>
      <tr><td>Nil-rate bands (${P.iht.couple ? 'couple' : 'single'})</td><td>−${fmt(es.nrb, es.year)}</td><td></td></tr>
      ${es.rnrb < es.rnrbFull ? `<tr><td colspan="3" style="color:var(--amber); font-size:0.66rem;">Residence band tapered from ${fmt(es.rnrbFull, es.year)} to ${fmt(es.rnrb, es.year)}: the estate is over £2m</td></tr>` : ''}
      <tr><td>Taxable estate</td><td>${fmt(es.taxable, es.year)}</td><td></td></tr>
      <tr class="${es.iht > 0 ? 'warn' : ''}"><td>IHT at ${pct(P.iht.rate)}</td><td>${fmt(es.iht, es.year)}</td><td></td></tr>
      <tr class="hl"><td>Net to your heirs</td><td>${fmt(es.netToHeirs, es.year)}</td><td></td></tr>
    </table></div>

    <h3>Settings</h3>
    <div class="grid2">
      ${moneyField('Nil-rate band per person', 'iht.nilRateBand')}
      ${moneyField('Residence nil-rate band', 'iht.residenceNRB')}
      ${numField('Pensions join the estate from', 'iht.pensionsInEstateFrom', 'Announced for April 2027')}
      <div class="field"><label class="switch" style="margin-top:1.2rem;"><input type="checkbox" id="iht-pens" ${P.iht.includePensions ? 'checked' : ''}> Apply the pension rule change</label></div>
    </div>
    <p class="note">The residence nil-rate band taper above £2m is applied. Beneficiary income tax on inherited pensions after age 75 is not modelled: pensions shown passing gross. Gifting, trusts and insurance are for a conversation with an adviser, not a slider.</p>
  </div>`;
  wireInputs(el);
  $('iht-pens').onchange = (e) => { P.iht.includePensions = e.target.checked; changed(); };
}

// ── Tab plumbing ────────────────────────────────────────────────────────
const VIEWS = {
  dashboard: renderDashboard, assumptions: renderAssumptions,
  accumulation: renderAccumulation, spending: renderSpending,
  drawdown: renderDrawdown, tax: renderTax, events: renderEvents,
  risk: renderRisk, estate: renderEstate,
};

function renderTab() {
  const el = $('tab-' + S.tab);
  VIEWS[S.tab](el);
  renderRail();
}

// ── Live KPI rail (wide screens) and nominal banner ────────────────────
function renderRail() {
  const rail = $('kpi-rail');
  if (!rail) return;
  const c = S.cache, P = S.P;
  if (!c.dd) { rail.innerHTML = ''; return; }
  const dd = c.dd;
  const acc = c.accLive.atRetirement;
  const pots = acc.pensionA + acc.pensionB + acc.isaA + acc.isaB;
  const endYear = horizonYear();
  const mc = S.mc;
  const survives = dd.exhaustedAgeA == null;
  const row = (k, v, cls) => `<div class="rail-row"><span class="rail-k">${k}</span><span class="rail-v ${cls || ''}">${v}</span></div>`;
  rail.innerHTML = `<div class="rail-card">
    <div class="rail-kicker">Live plan, ${pct(P.growth, 1)} growth</div>
    ${row('Pots at ' + P.retireYear, fmtK(pots, P.retireYear))}
    ${row('Wealth at ' + P.horizonAge, fmtK(dd.endWealth, endYear), survives ? 'good' : '')}
    ${row('Pot lasts to', survives ? P.horizonAge + '+' : 'age ' + dd.exhaustedAgeA, survives ? 'good' : 'bad')}
    ${row('Lifetime tax', fmtK(lifetimeTaxShown(dd)), 'warn')}
    ${row('Year one income', fmtK(dd.rows[0].netIncome, dd.rows[0].year))}
    ${row('MC success', mc ? pct(mc.successProb) : '…', mc ? (mc.successProb >= 0.85 ? 'good' : mc.successProb >= 0.6 ? 'warn' : 'bad') : '')}
    <div class="rail-bar"><i style="width:${mc ? Math.round(mc.successProb * 100) : 0}%"></i></div>
    ${row('Confidence age', mc ? mc.confidenceAge : '…')}
    ${row('IHT estimate', fmtK(c.estate.iht, c.estate.year), c.estate.iht > 0 ? 'warn' : 'good')}
  </div>`;
}

function renderAllForPrint() {
  for (const t of Object.keys(VIEWS)) VIEWS[t]($('tab-' + t));
  const ph = $('print-header');
  if (ph) {
    const P = S.P, dd = S.cache.dd;
    const survives = dd && dd.exhaustedAgeA == null;
    ph.innerHTML = `<div class="ph-brand">Someday <em class="ph-tag">we retire, I think</em> — retirement plan report</div>
      <div class="ph-sub">${P.partnerA.name} and ${P.partnerB.name} · retiring April ${P.retireYear} · prepared ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      · ${survives ? 'money lasts to age ' + P.horizonAge + '+' : 'money runs short at age ' + (dd ? dd.exhaustedAgeA : '?')}
      · Growth ${(P.growth * 100).toFixed(1)}%, inflation ${(P.inflation * 100).toFixed(1)}% · Educational tool, not regulated financial advice — an excellent starting point for a conversation with an FCA-regulated adviser</div>`;
  }
}

// Reflect the active tab everywhere: pill highlight, ARIA selection state,
// roving tabindex (only the active tab is in the tab order), panel visibility,
// the body[data-tab] hook for context-specific chrome, and keep the active
// pill in view on a narrow phone.
function activateTab(name, focusBtn) {
  S.tab = name;
  document.querySelectorAll('#tabs button').forEach(x => {
    const on = x.dataset.tab === name;
    x.classList.toggle('on', on);
    x.setAttribute('aria-selected', on ? 'true' : 'false');
    x.tabIndex = on ? 0 : -1;
    if (on) {
      if (focusBtn) x.focus();
      x.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
  });
  document.querySelectorAll('main section').forEach(sec => { sec.hidden = sec.id !== 'tab-' + name; });
  document.body.dataset.tab = name;
  renderTab();
  // Entrance motion, once per navigation only (changed()/renderTab re-renders
  // never add this class, so nothing animates on a keystroke). Reduced-motion off.
  try {
    if (matchMedia('(prefers-reduced-motion: no-preference)').matches) {
      const sec = document.getElementById('tab-' + name);
      if (sec) { sec.classList.add('tab-enter'); setTimeout(() => sec.classList.remove('tab-enter'), 750); }
    }
  } catch (e) {}
}

$('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  activateTab(b.dataset.tab, false);
  window.scrollTo({ top: 0 });
});

// Keyboard tablist: arrows move and activate, Home/End jump to the ends.
$('tabs').addEventListener('keydown', (e) => {
  const btns = [...document.querySelectorAll('#tabs button')];
  const i = btns.findIndex(x => x.dataset.tab === S.tab);
  let j = -1;
  if (e.key === 'ArrowRight') j = (i + 1) % btns.length;
  else if (e.key === 'ArrowLeft') j = (i - 1 + btns.length) % btns.length;
  else if (e.key === 'Home') j = 0;
  else if (e.key === 'End') j = btns.length - 1;
  if (j < 0) return;
  e.preventDefault();
  activateTab(btns[j].dataset.tab, true);
});

// ── "?" toggletips ──────────────────────────────────────────────────────
// One delegated handler for every field's help button. Survives innerHTML
// re-renders because it lives on the document. Click toggles the linked
// help-text; outside-click and Escape close it.
function closeHelp(except) {
  document.querySelectorAll('.help-text.open').forEach(sp => {
    if (sp === except) return;
    sp.classList.remove('open');
    const btn = document.querySelector('.help-btn[aria-controls="' + sp.id + '"]');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
}
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.help-btn');
  if (btn) {
    e.preventDefault();
    const sp = document.getElementById(btn.getAttribute('aria-controls'));
    const open = sp && !sp.classList.contains('open');
    closeHelp(open ? sp : null);
    if (sp) { sp.classList.toggle('open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
    return;
  }
  if (!e.target.closest('.help-text')) closeHelp(null);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const open = document.querySelector('.help-text.open');
    if (open) { const b = document.querySelector('.help-btn[aria-controls="' + open.id + '"]'); closeHelp(null); if (b) b.focus(); }
  }
});

// ── Header controls ─────────────────────────────────────────────────────
const gs = $('growth-slider');
function syncGrowthUI() {
  gs.value = String(Math.round(S.P.growth * 400) / 4);
  $('growth-out').textContent = (S.P.growth * 100).toFixed(2).replace(/\.?0+$/, '') + '%';
  gs.style.setProperty('--fill', (Number(gs.value) / 12 * 100) + '%');
  document.querySelectorAll('.scenario-chips button').forEach(b => {
    const map = { bear: S.P.growthBear, base: S.P.growthBase, bull: S.P.growthBull };
    b.classList.toggle('on', Math.abs(S.P.growth - map[b.dataset.scen]) < 0.0001);
  });
}
gs.addEventListener('input', () => {
  S.P.growth = Number(gs.value) / 100;
  syncGrowthUI();
  save(); recompute(); renderTab();
});
document.querySelectorAll('.scenario-chips button').forEach(b => {
  b.onclick = () => {
    const map = { bear: S.P.growthBear, base: S.P.growthBase, bull: S.P.growthBull };
    S.P.growth = map[b.dataset.scen];
    syncGrowthUI(); save(); recompute(); renderTab();
  };
});

$('btn-money').onclick = () => {
  S.todayMoney = !S.todayMoney;
  $('btn-money').textContent = S.todayMoney ? 'Nominal £' : "Today's £";
  save(); renderTab();
};
$('btn-theme').onclick = () => {
  // Default is light (no data-theme), so the toggle flips to dark first, then back.
  const cur = document.documentElement.dataset.theme || 'light';
  document.documentElement.dataset.theme = cur === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('rl4-theme', document.documentElement.dataset.theme); } catch (e) {}
};
try {
  // Only honour an explicit choice; otherwise stay light regardless of the OS.
  const th = localStorage.getItem('rl4-theme');
  if (th === 'dark' || th === 'light') document.documentElement.dataset.theme = th;
} catch (e) {}

// ── Boot ────────────────────────────────────────────────────────────────
console.log('%cSomeday engine assertions', 'font-weight:bold');
for (const a of E.runAssertions()) {
  console.log((a.pass ? 'PASS ' : 'FAIL ') + a.name + ' [got ' + a.got + ']');
}
$('btn-money').textContent = S.todayMoney ? 'Nominal £' : "Today's £";
// Reflect the starting tab (Your details for new visitors, Dashboard for
// returning) across pills, ARIA, panels and the body[data-tab] hook.
syncGrowthUI();
recompute();
activateTab(S.tab, false);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
