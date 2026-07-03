/**
 * RetireLens 4 UI. Tabs mirror the Marshall workbook. Engine is pure and
 * lives in engine.js; everything here is rendering and state.
 */
import { createEngine } from './engine.js';

const E = createEngine();
const $ = (id) => document.getElementById(id);

// ── State ───────────────────────────────────────────────────────────────
const S = {
  P: E.defaults(),
  tab: 'dashboard',
  todayMoney: false,
  pinned: null,          // snapshot of KPIs for plan A vs B comparison
  mc: null,              // latest Monte Carlo result
  mcBusy: false,
  cache: {},
};

// Load saved state
try {
  const saved = localStorage.getItem('rl4-state');
  if (saved) {
    const obj = JSON.parse(saved);
    if (obj && obj.P) { S.P = mergeParams(E.defaults(), obj.P); S.todayMoney = !!obj.todayMoney; }
  }
  if (location.hash.startsWith('#plan=')) {
    const obj = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(6)))));
    if (obj) S.P = mergeParams(E.defaults(), obj);
  }
} catch (e) { /* fresh start on any parse problem */ }

function mergeParams(base, incoming) {
  const out = JSON.parse(JSON.stringify(base));
  const deep = (dst, src) => {
    for (const k of Object.keys(src || {})) {
      if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k]) deep(dst[k], src[k]);
      else dst[k] = src[k];
    }
  };
  deep(out, incoming);
  if (Array.isArray(incoming.spending)) out.spending = incoming.spending;
  if (Array.isArray(incoming.lifeEvents)) out.lifeEvents = incoming.lifeEvents;
  return out;
}

function save() {
  try { localStorage.setItem('rl4-state', JSON.stringify({ P: S.P, todayMoney: S.todayMoney })); } catch (e) {}
}

// ── Formatting ──────────────────────────────────────────────────────────
const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
function deflate(v, year) {
  if (!S.todayMoney || year == null) return v;
  return v / Math.pow(1 + S.P.inflation, year - S.P.startYear);
}
const fmt = (v, year) => GBP.format(Math.round(deflate(v, year)));
const fmtK = (v, year) => {
  const x = deflate(v, year);
  if (Math.abs(x) >= 1e6) return '£' + (x / 1e6).toFixed(2) + 'm';
  if (Math.abs(x) >= 1e3) return '£' + Math.round(x / 1e3) + 'k';
  return '£' + Math.round(x);
};
const pct = (v, dp) => (v * 100).toFixed(dp == null ? 0 : dp) + '%';

// ── Recompute ───────────────────────────────────────────────────────────
function recompute() {
  const P = S.P;
  const c = {};
  c.accBase = E.accumulate(P);
  c.accBear = E.accumulate(P, P.growthBear);
  c.accBull = E.accumulate(P, P.growthBull);
  c.dd = E.drawdown(P);
  c.strategies = E.compareStrategies(P);
  c.estate = E.estate(P);
  S.cache = c;
  scheduleMC();
}

// Monte Carlo in a Web Worker, debounced
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
      // Fall back to main thread if workers are unavailable
      S.mc = E.runMonteCarlo(S.P, Math.min(400, S.P.mcPaths), S.P.mcSeed);
      S.mcBusy = false;
      if (S.tab === 'dashboard' || S.tab === 'risk') renderTab();
    }
  }, 350);
}

function changed(rerenderAll) {
  save();
  recompute();
  renderTab();
}

// ── SVG chart helpers ───────────────────────────────────────────────────
function chart(opts) {
  const W = opts.w || 720, H = opts.h || 260;
  const padL = opts.padL || 46, padR = 12, padT = 12, padB = 26;
  const xs = opts.xDomain, ys = opts.yDomain;
  const X = (x) => padL + (x - xs[0]) / (xs[1] - xs[0] || 1) * (W - padL - padR);
  const Y = (y) => H - padB - (y - ys[0]) / (ys[1] - ys[0] || 1) * (H - padT - padB);
  let svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${opts.label || 'chart'}">`;
  // y grid
  const ticks = opts.yTicks || 4;
  for (let i = 0; i <= ticks; i++) {
    const v = ys[0] + (ys[1] - ys[0]) * i / ticks;
    const y = Y(v);
    svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--card-edge)" stroke-width="1"/>`;
    svg += `<text x="${padL - 5}" y="${y + 3}" text-anchor="end" font-size="9" fill="var(--ink-faint)">${opts.yFmt ? opts.yFmt(v) : Math.round(v)}</text>`;
  }
  // x labels
  const xt = opts.xTicks || 6;
  for (let i = 0; i <= xt; i++) {
    const v = Math.round(xs[0] + (xs[1] - xs[0]) * i / xt);
    svg += `<text x="${X(v)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="var(--ink-faint)">${opts.xFmt ? opts.xFmt(v) : v}</text>`;
  }
  return { svg, X, Y, W, H, close: () => svg + '</svg>', add: (s) => { svg += s; }, get: () => svg + '</svg>' };
}

function linePath(pts, X, Y) {
  return pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');
}
function areaPath(pts, base, X, Y) {
  // pts and base are arrays of [x, y], base traversed in reverse
  let d = linePath(pts, X, Y);
  for (let i = base.length - 1; i >= 0; i--) {
    d += ' L' + X(base[i][0]).toFixed(1) + ',' + Y(base[i][1]).toFixed(1);
  }
  return d + ' Z';
}

const COLORS = {
  db: '#8b5cf6', spB: '#0ea5e9', spA: '#1d4ed8',
  pension: '#0e7a6e', pcls: '#94a3b8', isa: '#b45309',
  bear: '#be123c', base: '#0e7a6e', bull: '#1d4ed8',
};

// ── Field helpers ───────────────────────────────────────────────────────
function moneyField(label, path, hint) {
  const val = getPath(path);
  return `<div class="field"><label>${label}</label>
    <input type="text" inputmode="decimal" data-path="${path}" value="${val}">
    ${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
}
function numField(label, path, hint, step) {
  const val = getPath(path);
  return `<div class="field"><label>${label}</label>
    <input type="number" ${step ? `step="${step}"` : ''} data-path="${path}" value="${val}">
    ${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
}
function pctField(label, path, hint) {
  const val = Math.round(getPath(path) * 10000) / 100;
  return `<div class="field"><label>${label}</label>
    <input type="number" step="0.25" data-path="${path}" data-pct="1" value="${val}">
    ${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
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

function wireInputs(root) {
  root.querySelectorAll('input[data-path], select[data-path]').forEach(el => {
    el.addEventListener('change', () => {
      let v = el.value;
      if (el.dataset.pct) v = (parseFloat(v) || 0) / 100;
      else if (el.type === 'number' || el.inputMode === 'decimal') v = parseFloat(String(v).replace(/[£,\s]/g, '')) || 0;
      setPath(el.dataset.path, v);
      changed();
    });
  });
}

// ── Views ───────────────────────────────────────────────────────────────

function renderDashboard(el) {
  const c = S.cache, P = S.P;
  const acc = c.accBase.atRetirement;
  const potsAtRet = acc.pensionA + acc.pensionB + acc.isaA + acc.isaB;
  const dd = c.dd;
  const y1 = dd.rows[0];
  const endYear = P.partnerA.birthYear + P.horizonAge;
  const mc = S.mc;
  const kpiDelta = (key, val) => {
    if (!S.pinned) return '';
    const d = val - S.pinned[key];
    if (Math.abs(d) < 1) return '<div class="d">no change vs plan A</div>';
    const good = (key === 'lifetimeTax') ? d < 0 : d > 0;
    return `<div class="d ${good ? 'up' : 'down'}">${d > 0 ? '+' : ''}${fmtK(d)} vs plan A</div>`;
  };

  const survives = dd.exhaustedAgeA == null;
  el.innerHTML = `
  <div class="card">
    <div class="kicker">${P.partnerA.name} and ${P.partnerB.name}, retiring April ${P.retireYear}</div>
    <h2>Where the plan stands</h2>
    <p class="sub">Base scenario at ${pct(P.growth, 1)} growth, ${pct(P.inflation, 1)} inflation. Drag the slider in the header and everything recomputes.</p>
    <div class="kpis">
      <div class="kpi good"><div class="v">${fmtK(potsAtRet, P.retireYear)}</div><div class="k">Pensions + ISAs at ${P.retireYear}</div>${kpiDelta('pots', potsAtRet)}</div>
      <div class="kpi ${y1.shortfall > 1 ? 'bad' : 'good'}"><div class="v">${fmtK(y1.netIncome, y1.year)}</div><div class="k">Net income in year one, target ${fmtK(y1.target, y1.year)}</div></div>
      <div class="kpi ${survives ? 'good' : 'bad'}"><div class="v">${survives ? 'To ' + P.horizonAge + '+' : 'Age ' + dd.exhaustedAgeA}</div><div class="k">${survives ? 'Pot survives the full plan' : 'Pot exhausted'}</div>${kpiDelta('endWealth', dd.endWealth)}</div>
      <div class="kpi"><div class="v">${fmtK(dd.lifetimeTax)}</div><div class="k">Income tax to age ${P.horizonAge}</div>${kpiDelta('lifetimeTax', dd.lifetimeTax)}</div>
      <div class="kpi ${mc ? (mc.successProb >= 0.85 ? 'good' : mc.successProb >= 0.6 ? 'warn' : 'bad') : ''}">
        <div class="v">${mc ? pct(mc.successProb) : '…'}</div><div class="k">Monte Carlo success, ${P.mcPaths} paths${S.mcBusy ? ', running' : ''}</div></div>
      <div class="kpi"><div class="v">${mc ? mc.confidenceAge : '…'}</div><div class="k">Confidence age, 85% threshold</div></div>
    </div>
    <div style="display:flex; gap:0.5rem; margin-top:0.9rem; flex-wrap:wrap;" class="no-print">
      <button id="btn-pin" class="small">${S.pinned ? 'Update plan A pin' : 'Pin as plan A'}</button>
      ${S.pinned ? '<button id="btn-unpin" class="small ghost">Clear pin</button>' : ''}
      <button id="btn-print" class="small">Download PDF report</button>
      <button id="btn-share" class="small">Copy share link</button>
    </div>
  </div>

  <div class="card">
    <div class="kicker">Scenario comparison</div>
    <h2>Bear ${pct(P.growthBear)}, Base ${pct(P.growth, 1)}, Bull ${pct(P.growthBull)}</h2>
    <div class="tbl-wrap"><table class="data">
      <tr><th>Scenario</th><th>${P.partnerA.name} pension at ${P.retireYear}</th><th>${P.partnerB.name} pension</th><th>ISAs</th><th>Wealth at ${P.horizonAge}</th><th>Lasts to</th></tr>
      ${[['🔴 Bear', c.accBear, P.growthBear], ['🟡 Base', c.accBase, P.growth], ['🟢 Bull', c.accBull, P.growthBull]].map(([name, a, g]) => {
        const r = E.drawdown(P, { growth: g, startPots: a.atRetirement });
        return `<tr${g === P.growth ? ' class="hl"' : ''}><td>${name} ${pct(g, 1)}</td>
          <td>${fmt(a.atRetirement.pensionA, P.retireYear)}</td>
          <td>${fmt(a.atRetirement.pensionB, P.retireYear)}</td>
          <td>${fmt(a.atRetirement.isaA + a.atRetirement.isaB, P.retireYear)}</td>
          <td>${fmt(r.endWealth, endYear)}</td>
          <td>${r.exhaustedAgeA == null ? P.horizonAge + '+' : 'age ' + r.exhaustedAgeA}</td></tr>`;
      }).join('')}
    </table></div>
    <p class="note">The 2030 pot figures line up with your workbook's Accumulation tab. Tax here is computed per partner, which saves roughly ${fmt(E.taxOn(y1.guaranteed + y1.grossA + y1.grossB) - y1.tax)} in year one alone versus taxing the household as one person.</p>
  </div>`;

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
  el.innerHTML = `
  <div class="card">
    <div class="kicker">Central control panel</div>
    <h2>Assumptions</h2>
    <p class="sub">Every figure driving the model, exactly like the ⚙️ tab of your spreadsheet. Change anything; all tabs update.</p>

    <h3>👤 ${P.partnerA.name}</h3>
    <div class="grid2">
      ${numField('Birth year', 'partnerA.birthYear')}
      ${numField('State pension age', 'partnerA.spAge')}
      ${moneyField('Pension pot today', 'partnerA.pension', 'SIPP value now')}
      ${moneyField('ISA today', 'partnerA.isa')}
      ${moneyField('Monthly pension investing', 'partnerA.monthlyPension', 'Until retirement')}
      ${moneyField('Monthly ISA investing', 'partnerA.monthlyIsa')}
      ${moneyField('State pension per year', 'partnerA.spAmount', "Today's money, indexed from ${P.startYear}")}
      ${moneyField('DB pension per year', 'partnerA.db')}
    </div>

    <h3>👤 ${P.partnerB.name}</h3>
    <div class="grid2">
      ${numField('Birth year', 'partnerB.birthYear')}
      ${numField('State pension age', 'partnerB.spAge')}
      ${moneyField('Pension pot today', 'partnerB.pension', 'SASS value now')}
      ${moneyField('ISA today', 'partnerB.isa')}
      ${moneyField('Monthly pension investing', 'partnerB.monthlyPension')}
      ${moneyField('Monthly ISA investing', 'partnerB.monthlyIsa')}
      ${moneyField('State pension per year', 'partnerB.spAmount')}
      ${moneyField('DB pension per year', 'partnerB.db', 'Starts ' + P.partnerB.dbStartYear)}
    </div>

    <h3>📅 Timing</h3>
    <div class="grid2">
      ${numField('Retirement year', 'retireYear')}
      ${numField('Plan to age', 'horizonAge', P.partnerA.name + "'s age the plan runs to")}
    </div>

    <h3>📊 Growth and inflation</h3>
    <div class="grid2">
      ${pctField('Base growth rate', 'growth', 'Also on the header slider')}
      ${pctField('Inflation', 'inflation')}
      ${pctField('Bear rate', 'growthBear')}
      ${pctField('Bull rate', 'growthBull')}
    </div>

    <h3>💰 Income need</h3>
    <div class="grid2">
      ${moneyField('Target net income per year', 'targetNet', "Today's money. The 🛒 Spending tab can drive this instead")}
    </div>

    <h3>🏠 Property and other assets</h3>
    <div class="grid2">
      ${moneyField('House value', 'house')}
      ${pctField('House growth per year', 'houseGrowth')}
      ${moneyField('Mortgage outstanding', 'mortgage')}
      ${moneyField('Mortgage monthly payment', 'mortgageMonthly')}
      ${moneyField('Motorhome value', 'motorhome')}
      ${moneyField('Motorhome depreciation per year', 'motorhomeDepPerYear')}
    </div>

    <h3>🎲 Monte Carlo</h3>
    <div class="grid2">
      ${pctField('Mean return', 'mcMean')}
      ${pctField('Volatility, standard deviation', 'mcSd')}
      ${numField('Paths', 'mcPaths')}
      ${numField('Seed', 'mcSeed', 'Fixed seed keeps results reproducible')}
    </div>

    <h3>🧾 Tax figures, 2026/27</h3>
    <div class="grid2">
      ${moneyField('Personal allowance', 'tax.personalAllowance')}
      ${moneyField('Higher rate from', 'tax.higherThreshold')}
      ${pctField('Basic rate', 'tax.basicRate')}
      ${pctField('Higher rate', 'tax.higherRate')}
      ${moneyField('PCLS lifetime cap', 'tax.pclsCap')}
      ${moneyField('Allowance taper starts', 'tax.taperStart')}
    </div>

    <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:1rem;" class="no-print">
      <button id="btn-export" class="small">Export JSON</button>
      <button id="btn-import" class="small">Import JSON</button>
      <button id="btn-reset" class="small danger">Reset to your workbook defaults</button>
    </div>
    <input type="file" id="import-file" accept=".json" style="display:none">
  </div>`;
  wireInputs(el);
  $('btn-export').onclick = () => {
    const blob = new Blob([JSON.stringify(S.P, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'retirelens-plan.json'; a.click();
  };
  $('btn-import').onclick = () => $('import-file').click();
  $('import-file').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { S.P = mergeParams(E.defaults(), JSON.parse(r.result)); changed(); } catch { alert('Could not read that file.'); } };
    r.readAsText(f);
  };
  $('btn-reset').onclick = () => { if (confirm('Reset every input to the workbook defaults?')) { S.P = E.defaults(); changed(); } };
}

function renderAccumulation(el) {
  const P = S.P, c = S.cache;
  const series = [
    { name: 'Bear ' + pct(P.growthBear), color: COLORS.bear, acc: c.accBear },
    { name: 'Base ' + pct(P.growth, 1), color: COLORS.base, acc: c.accBase },
    { name: 'Bull ' + pct(P.growthBull), color: COLORS.bull, acc: c.accBull },
  ];
  const total = (y) => y.pensionA + y.pensionB + y.isaA + y.isaB;
  const startTotal = P.partnerA.pension + P.partnerB.pension + P.partnerA.isa + P.partnerB.isa;
  let maxV = startTotal;
  for (const s of series) for (const y of s.acc.years) maxV = Math.max(maxV, total(y));

  const ch = chart({
    xDomain: [P.startYear, P.retireYear], yDomain: [0, maxV * 1.05],
    yFmt: (v) => fmtK(v), xTicks: Math.min(6, P.retireYear - P.startYear), label: 'Accumulation to retirement',
  });
  for (const s of series) {
    const pts = [[P.startYear, startTotal], ...s.acc.years.map(y => [y.year, total(y)])];
    ch.add(`<path d="${linePath(pts, ch.X, ch.Y)}" fill="none" stroke="${s.color}" stroke-width="${s.acc === c.accBase ? 3 : 1.8}" ${s.acc === c.accBase ? '' : 'stroke-dasharray="5 4" opacity="0.75"'}/>`);
  }

  const contribA = P.partnerA.monthlyPension * 12 * (P.retireYear - P.startYear);
  const contribB = P.partnerB.monthlyPension * 12 * (P.retireYear - P.startYear);
  const at = c.accBase.atRetirement;
  el.innerHTML = `
  <div class="card">
    <div class="kicker">Getting to April ${P.retireYear}</div>
    <h2>Accumulation</h2>
    <p class="sub">Pensions plus ISAs, growing with your monthly investing of ${fmt(P.partnerA.monthlyPension + P.partnerB.monthlyPension + P.partnerA.monthlyIsa + P.partnerB.monthlyIsa)} a month across the household.</p>
    ${ch.get()}
    <div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div>
    <div class="kpis" style="margin-top:0.9rem;">
      <div class="kpi"><div class="v">${fmtK(at.pensionA, P.retireYear)}</div><div class="k">${P.partnerA.name} pension at ${P.retireYear}</div></div>
      <div class="kpi"><div class="v">${fmtK(at.pensionB, P.retireYear)}</div><div class="k">${P.partnerB.name} pension</div></div>
      <div class="kpi"><div class="v">${fmtK(at.isaA + at.isaB, P.retireYear)}</div><div class="k">ISAs combined</div></div>
    </div>
    <p class="note">You will have paid in ${fmt(contribA)} (${P.partnerA.name}) and ${fmt(contribB)} (${P.partnerB.name}) of contributions by retirement. Mortgage remaining at ${P.retireYear}: ${fmt(c.accBase.atRetirement.mortgage)}.</p>
  </div>

  <div class="card">
    <div class="kicker">Year by year</div>
    <h2>The path, base scenario</h2>
    <div class="tbl-wrap"><table class="data">
      <tr><th>Year</th><th>${P.partnerA.name} pension</th><th>${P.partnerB.name} pension</th><th>ISAs</th><th>Mortgage left</th><th>Total investable</th></tr>
      ${c.accBase.years.map(y => `<tr><td>${y.year}</td><td>${fmt(y.pensionA, y.year)}</td><td>${fmt(y.pensionB, y.year)}</td><td>${fmt(y.isaA + y.isaB, y.year)}</td><td>${fmt(y.mortgage)}</td><td>${fmt(total(y), y.year)}</td></tr>`).join('')}
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
    <p class="sub">Build your real monthly spend from the headings below, then flip the switch to use it as the plan's income target instead of the single figure.</p>
    ${P.spending.map((r, i) => `
      <div class="spend-row">
        <label>${r.label}</label>
        <input type="text" inputmode="decimal" data-spend="${i}" value="${r.monthly}">
      </div>`).join('')}
    <div class="spend-total"><span>Total</span><span class="v">${fmt(totalMonthly)} / month, ${fmt(totalMonthly * 12)} / year</span></div>
    <label class="switch" style="margin-top:0.5rem;">
      <input type="checkbox" id="spend-on" ${P.spendingPlanOn ? 'checked' : ''}>
      Use this as my income target (currently ${P.spendingPlanOn ? 'on' : 'off, using ' + fmt(P.targetNet)})
    </label>
  </div>

  <div class="card">
    <div class="kicker">Spending through retirement</div>
    <h2>Slow down later, spend less</h2>
    <p class="sub">Most retirees spend less as they age. Choose when and by how much; both cuts compound.</p>
    <div class="grid2">
      <div class="field"><label class="switch"><input type="checkbox" id="ph1-on" ${P.phase1On ? 'checked' : ''}> First reduction</label></div><div></div>
      ${numField('From age', 'phase1Age')}
      ${pctField('Reduce spending by', 'phase1Cut')}
      <div class="field"><label class="switch"><input type="checkbox" id="ph2-on" ${P.phase2On ? 'checked' : ''}> Second reduction</label></div><div></div>
      ${numField('From age', 'phase2Age')}
      ${pctField('Reduce by a further', 'phase2Cut')}
    </div>
    <div id="spend-curve" style="margin-top:0.8rem;"></div>
    <p class="note">Shown in today's money so the phase steps are visible without inflation on top.</p>
  </div>`;

  // Spending curve, today's money
  const retAge = P.retireYear - P.partnerA.birthYear;
  const pts = [];
  for (let a = retAge; a <= P.horizonAge; a++) {
    pts.push([a, E.spendingAnnual(P) * E.phaseFactor(P, a)]);
  }
  const maxY = Math.max(...pts.map(p => p[1])) * 1.15 + 1;
  const ch = chart({ xDomain: [retAge, P.horizonAge], yDomain: [0, maxY], yFmt: fmtK, label: 'Spending by age', h: 200 });
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
  $('ph1-on').onchange = (e) => { P.phase1On = e.target.checked; changed(); };
  $('ph2-on').onchange = (e) => { P.phase2On = e.target.checked; changed(); };
  wireInputs(el);
}

function renderDrawdown(el) {
  const P = S.P, dd = S.cache.dd;
  const rows = dd.rows;
  const retAge = P.retireYear - P.partnerA.birthYear;

  // Stacked income layers vs target
  const layers = [
    { key: (r) => r.dbA + r.dbB, name: 'DB pension', color: COLORS.db },
    { key: (r) => r.spB, name: P.partnerB.name + ' state pension', color: COLORS.spB },
    { key: (r) => r.spA, name: P.partnerA.name + ' state pension', color: COLORS.spA },
    { key: (r) => r.grossA + r.grossB - r.taxA - r.taxB, name: 'Pension drawdown, net', color: COLORS.pension },
    { key: (r) => r.tfcA + r.tfcB, name: 'Tax-free cash', color: COLORS.pcls },
    { key: (r) => r.isaDraw + r.cashDraw, name: 'ISA and cash', color: COLORS.isa },
  ];
  const dv = (v, r) => deflate(v, r.year);
  let maxY = 0;
  for (const r of rows) maxY = Math.max(maxY, dv(r.netIncome, r), dv(r.target, r));
  const ch = chart({ xDomain: [rows[0].year, rows[rows.length - 1].year], yDomain: [0, maxY * 1.12 + 1], yFmt: fmtK, label: 'Income layers by year', h: 280 });
  let baseline = rows.map(r => [r.year, 0]);
  for (const L of layers) {
    const top = rows.map((r, i) => [r.year, baseline[i][1] + dv(Math.max(0, L.key(r)), r)]);
    ch.add(`<path d="${areaPath(top, baseline, ch.X, ch.Y)}" fill="${L.color}" opacity="0.82"/>`);
    baseline = top;
  }
  ch.add(`<path d="${linePath(rows.map(r => [r.year, dv(r.target, r)]), ch.X, ch.Y)}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="6 4"/>`);

  // Pot balances
  let maxW = 0;
  for (const r of rows) maxW = Math.max(maxW, dv(r.potA, r), dv(r.isaA + r.isaB + r.cash, r), dv(r.potB, r));
  const ch2 = chart({ xDomain: [rows[0].year, rows[rows.length - 1].year], yDomain: [0, maxW * 1.08 + 1], yFmt: fmtK, label: 'Pot balances', h: 220 });
  ch2.add(`<path d="${linePath(rows.map(r => [r.year, dv(r.potA, r)]), ch2.X, ch2.Y)}" fill="none" stroke="${COLORS.pension}" stroke-width="2.5"/>`);
  ch2.add(`<path d="${linePath(rows.map(r => [r.year, dv(r.potB, r)]), ch2.X, ch2.Y)}" fill="none" stroke="${COLORS.spB}" stroke-width="2"/>`);
  ch2.add(`<path d="${linePath(rows.map(r => [r.year, dv(r.isaA + r.isaB + r.cash, r)]), ch2.X, ch2.Y)}" fill="none" stroke="${COLORS.isa}" stroke-width="2"/>`);

  el.innerHTML = `
  <div class="card">
    <div class="kicker">Income layering, ${P.retireYear} to ${rows[rows.length - 1].year}</div>
    <h2>Who pays for each year</h2>
    <p class="sub">Guaranteed income first, pensions filled to the basic rate band, ISAs for the excess. The dashed line is your target.</p>
    ${ch.get()}
    <div class="legend">${layers.map(L => `<span><i style="background:${L.color}"></i>${L.name}</span>`).join('')}<span><i style="background:var(--ink)"></i>Target</span></div>
  </div>

  <div class="card">
    <div class="kicker">Pot balances</div>
    <h2>What is left</h2>
    ${ch2.get()}
    <div class="legend">
      <span><i style="background:${COLORS.pension}"></i>${P.partnerA.name} pension</span>
      <span><i style="background:${COLORS.spB}"></i>${P.partnerB.name} pension</span>
      <span><i style="background:${COLORS.isa}"></i>ISAs and cash</span>
    </div>
    ${dd.exhaustedAgeA ? `<div class="callout">⚠️ The pots run dry at age ${dd.exhaustedAgeA}. Try a later retirement, a lower target, or the spending reductions on the 🛒 tab.</div>` : ''}
  </div>

  <div class="card">
    <div class="kicker">Year by year</div>
    <h2>The full table</h2>
    <p class="sub">Your workbook's Drawdown tab, with per-partner tax. ${S.todayMoney ? "Today's money." : 'Nominal figures.'}</p>
    <div class="tbl-wrap"><table class="data">
      <tr><th>Year</th><th>Age ${P.partnerA.name[0]}/${P.partnerB.name[0]}</th><th>Guaranteed</th><th>Pension draw</th><th>Tax-free</th><th>Tax</th><th>ISA draw</th><th>Net income</th><th>Target</th><th>Pension pots</th><th>ISAs</th></tr>
      ${rows.map(r => `<tr${r.eventLabels.length ? ' class="hl" title="' + r.eventLabels.join(', ') + '"' : ''}${r.shortfall > 1 ? ' class="warn"' : ''}>
        <td>${r.year}${r.eventLabels.length ? ' 🎉' : ''}</td><td>${r.ageA}/${r.ageB}</td>
        <td>${fmt(r.guaranteed, r.year)}</td>
        <td>${fmt(r.grossA + r.grossB, r.year)}</td>
        <td>${fmt(r.tfcA + r.tfcB, r.year)}</td>
        <td>${fmt(r.tax, r.year)}</td>
        <td>${fmt(r.isaDraw + r.cashDraw, r.year)}</td>
        <td>${fmt(r.netIncome, r.year)}</td>
        <td>${fmt(r.target, r.year)}</td>
        <td>${fmt(r.potA + r.potB, r.year)}</td>
        <td>${fmt(r.isaA + r.isaB + r.cash, r.year)}</td>
      </tr>`).join('')}
    </table></div>
  </div>`;
}

function renderTax(el) {
  const P = S.P, dd = S.cache.dd;
  const strategies = S.cache.strategies;
  const best = strategies.reduce((a, b) => (b.lifetimeTax < a.lifetimeTax ? b : a));

  el.innerHTML = `
  <div class="card">
    <div class="kicker">Drawdown order</div>
    <h2>Three ways to fund the same life</h2>
    <p class="sub">Your workbook's Tax Optimisation tab, live. Tap a strategy to adopt it; every tab recomputes.</p>
    <div class="strategies">
      ${strategies.map(s => `
        <div class="strategy ${P.strategy === s.id ? 'on' : ''}" data-strat="${s.id}" role="button" tabindex="0">
          ${s.id === best.id ? '<span class="badge">LOWEST TAX</span>' : ''}
          <div class="name">${s.label}</div>
          <div class="stat">Lifetime tax <b>${fmtK(s.lifetimeTax)}</b></div>
          <div class="stat">Wealth at ${P.horizonAge}: <b>${fmtK(s.endWealth)}</b></div>
          <div class="stat">${s.exhaustedAgeA == null ? 'Never exhausts' : 'Runs dry at ' + s.exhaustedAgeA}</div>
        </div>`).join('')}
    </div>
    <h3>Tax-free cash</h3>
    <div class="seg" role="group" aria-label="PCLS mode">
      <button data-pcls="none" class="${P.pclsMode === 'none' ? 'on' : ''}">No PCLS</button>
      <button data-pcls="phased" class="${P.pclsMode === 'phased' ? 'on' : ''}">Phased 25%</button>
      <button data-pcls="upfront" class="${P.pclsMode === 'upfront' ? 'on' : ''}">Upfront 25%</button>
    </div>
    <p class="note">Phased takes a quarter of each year's withdrawal tax-free until the ${fmt(P.tax.pclsCap)} cap. Upfront crystallises everything at retirement.</p>
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
      const seg = (x, w, color, label, amt) => w < 0.5 ? '' : `
        <rect x="${x}" y="56" width="${w}" height="34" rx="6" fill="${color}" opacity="0.9"/>
        ${w > 46 ? `<text x="${x + w / 2}" y="77" text-anchor="middle" font-size="9" fill="#fff" font-weight="700">${label}</text>` : ''}`;
      let x = bx;
      let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${name} tax bands">`;
      svg += `<text x="${bx}" y="16" font-size="11" font-weight="800" fill="var(--ink)">${name}</text>`;
      svg += `<text x="${bx}" y="34" font-size="9.5" fill="var(--ink-dim)">Taxable income ${fmt(income, r.year)}, tax ${fmt(tax, r.year)}, marginal ${pct(marginal)}</text>`;
      svg += `<text x="${bx}" y="48" font-size="9.5" fill="var(--ink-faint)">Allowance ${fmt(pa)}${tfc > 0 ? ' plus ' + fmt(tfc, r.year) + ' PCLS outside the bands' : ''}</text>`;
      const wPA = inPA / scale * segW, wB = inBasic / scale * segW, wH = inHigher / scale * segW;
      svg += seg(x, wPA, 'var(--ink-faint)', '0%', inPA); x += wPA;
      svg += seg(x, wB, '#0e7a6e', '20%', inBasic); x += wB;
      svg += seg(x, wH, '#b45309', '40%', inHigher); x += wH;
      // Band edge markers
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
    <p class="sub">New car, a wedding, the big trip, a house deposit gift, an inheritance. Costs are met from ISAs first, then pensions. Incomes can be spent that year or invested.</p>
    ${rows || '<p class="note">Nothing yet. Add your first event below.</p>'}
    <div style="display:flex; gap:0.5rem; margin-top:0.7rem;" class="no-print">
      <button id="ev-add-cost" class="small">+ Add a cost</button>
      <button id="ev-add-income" class="small">+ Add income</button>
      <button id="ev-add-inherit" class="small primary">+ Inheritance, invested</button>
    </div>
  </div>
  <div class="card" id="ev-impact"></div>`;

  const impact = () => {
    const base = E.drawdown({ ...JSON.parse(JSON.stringify(P)), lifeEvents: [] });
    const withEv = S.cache.dd;
    const d = withEv.endWealth - base.endWealth;
    $('ev-impact').innerHTML = `
      <div class="kicker">Impact</div>
      <h2>What your events do to the plan</h2>
      <div class="kpis">
        <div class="kpi"><div class="v">${P.lifeEvents.length}</div><div class="k">Events</div></div>
        <div class="kpi ${d >= 0 ? 'good' : 'bad'}"><div class="v">${d >= 0 ? '+' : ''}${fmtK(d)}</div><div class="k">Wealth at ${P.horizonAge} vs no events</div></div>
        <div class="kpi ${withEv.exhaustedAgeA ? 'bad' : 'good'}"><div class="v">${withEv.exhaustedAgeA == null ? P.horizonAge + '+' : withEv.exhaustedAgeA}</div><div class="k">Pot lasts to</div></div>
      </div>
      <p class="note">An invested inheritance compounds at your growth rate inside the ISA pot; spent as cash it only offsets that year's need.</p>`;
  };
  impact();

  const add = (ev) => { P.lifeEvents.push(ev); changed(); };
  $('ev-add-cost').onclick = () => add({ year: P.retireYear + 2, label: 'New car', amount: 25000, kind: 'cost' });
  $('ev-add-income').onclick = () => add({ year: P.retireYear + 1, label: 'Downsize or windfall', amount: 50000, kind: 'income', invest: false });
  $('ev-add-inherit').onclick = () => add({ year: P.retireYear + 5, label: 'Inheritance', amount: 100000, kind: 'income', invest: true });
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
  const st = E.stressTests(P);
  const grid = E.sensitivityGrid(P);
  const mc = S.mc;

  const heatColor = (age) => {
    if (age == null) return 'var(--accent-soft)';
    if (age >= 90) return 'var(--amber-soft)';
    return 'var(--rose-soft)';
  };
  const heatText = (age) => age == null ? 'Never' : 'age ' + age;

  let mcHtml = '<p class="sub">Running ' + P.mcPaths + ' market paths in the background…</p>';
  if (mc) {
    // Fan chart of sample tracks
    const nY = mc.tracks[0] ? mc.tracks[0].length : 0;
    let maxY = 1;
    for (const t of mc.tracks) for (const v of t) maxY = Math.max(maxY, v);
    const retY = P.retireYear;
    const ch = chart({ xDomain: [retY, retY + nY - 1], yDomain: [0, maxY], yFmt: fmtK, h: 230, label: 'Monte Carlo paths' });
    for (const t of mc.tracks) {
      ch.add(`<path d="${linePath(t.map((v, i) => [retY + i, v]), ch.X, ch.Y)}" fill="none" stroke="var(--accent)" stroke-width="0.7" opacity="0.16"/>`);
    }
    // Solvency by age line rescaled onto the chart
    mcHtml = `
      <div class="kpis" style="margin-bottom:0.8rem;">
        <div class="kpi ${mc.successProb >= 0.85 ? 'good' : mc.successProb >= 0.6 ? 'warn' : 'bad'}"><div class="v">${pct(mc.successProb)}</div><div class="k">Paths fully funded to ${P.horizonAge}</div></div>
        <div class="kpi"><div class="v">${mc.confidenceAge}</div><div class="k">Confidence age, 85% threshold</div></div>
        <div class="kpi"><div class="v">${fmtK(mc.finalP50)}</div><div class="k">Median wealth at ${P.horizonAge} (p10 ${fmtK(mc.finalP10)}, p90 ${fmtK(mc.finalP90)})</div></div>
      </div>
      ${ch.get()}
      <p class="note">${Math.min(60, P.mcPaths)} of the ${mc.nPaths} simulated paths shown. If a path fails, the median income trim needed is ${pct(mc.medianTrim)}. Volatility ${pct(P.mcSd)} around a ${pct(P.mcMean)} mean, your workbook's Monte Carlo settings.</p>`;
  }

  el.innerHTML = `
  <div class="card">
    <div class="kicker">Monte Carlo</div>
    <h2>1000 possible markets</h2>
    ${mcHtml}
  </div>

  <div class="card">
    <div class="kicker">Stress tests</div>
    <h2>How the plan bends</h2>
    <p class="sub">Your workbook's scenarios, recomputed through the full model rather than a single formula.</p>
    <div class="tbl-wrap"><table class="data">
      <tr><th>Scenario</th><th>Wealth at ${P.horizonAge}</th><th>Change</th><th>Lasts to</th></tr>
      <tr class="hl"><td>Base plan</td><td>${fmtK(st.base.endWealth)}</td><td></td><td>${st.base.exhaustedAgeA == null ? P.horizonAge + '+' : st.base.exhaustedAgeA}</td></tr>
      ${st.tests.map(t => `<tr><td title="${t.note}">${t.label}</td><td>${fmtK(t.endWealth)}</td>
        <td class="${t.delta >= 0 ? 'pos' : 'neg'}">${t.delta >= 0 ? '+' : ''}${fmtK(t.delta)}</td>
        <td>${t.exhaustedAgeA == null ? P.horizonAge + '+' : 'age ' + t.exhaustedAgeA}</td></tr>`).join('')}
    </table></div>
  </div>

  <div class="card">
    <div class="kicker">Sensitivity</div>
    <h2>Withdrawal against growth: when the pot dies</h2>
    <p class="sub">Net annual target in today's money, run to age 100. Green never dies, red dies before 90.</p>
    <div class="tbl-wrap"><table class="data">
      <tr><th>Target</th>${grid.growths.map(g => `<th>${pct(g)}</th>`).join('')}</tr>
      ${grid.grid.map(row => `<tr><td>${fmtK(row.withdrawal)}</td>
        ${row.cells.map(c => `<td class="heat" style="background:${heatColor(c.exhaustedAgeA)}">${heatText(c.exhaustedAgeA)}</td>`).join('')}</tr>`).join('')}
    </table></div>
  </div>`;
}

function renderEstate(el) {
  const P = S.P;
  const es = S.cache.estate;
  el.innerHTML = `
  <div class="card">
    <div class="kicker">Inheritance tax</div>
    <h2>Estate at age ${P.horizonAge} (${es.year})</h2>
    <p class="sub">Base scenario. Pensions ${es.pensionsIn ? 'are inside' : 'stay outside'} the estate under the ${P.iht.pensionsInEstateFrom} rule change.</p>
    <div class="tbl-wrap"><table class="data">
      <tr><th>Component</th><th>Value</th><th>In IHT scope</th></tr>
      <tr><td>House at ${pct(P.houseGrowth)} a year</td><td>${fmt(es.house, es.year)}</td><td>Yes</td></tr>
      <tr><td>Less mortgage remaining</td><td>−${fmt(es.mortLeft)}</td><td></td></tr>
      <tr><td>Motorhome</td><td>${fmt(es.motorhome, es.year)}</td><td>Yes</td></tr>
      <tr><td>ISAs and cash</td><td>${fmt(es.isas, es.year)}</td><td>Yes</td></tr>
      <tr><td>Pensions remaining</td><td>${fmt(es.pensions, es.year)}</td><td>${es.pensionsIn ? 'Yes, from ' + P.iht.pensionsInEstateFrom : 'No'}</td></tr>
      <tr class="hl"><td>Estate in scope</td><td>${fmt(es.inScope, es.year)}</td><td></td></tr>
      <tr><td>Nil-rate bands (${P.iht.couple ? 'couple' : 'single'}, incl. residence)</td><td>−${fmt(es.nrb)}</td><td></td></tr>
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
    <p class="note">The residence band tapers away for estates over £2m; this model does not yet apply that taper, so large estates may owe more than shown. Gifting, trusts and insurance are for a conversation with an adviser, not a slider.</p>
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
}

function renderAllForPrint() {
  for (const t of Object.keys(VIEWS)) VIEWS[t]($('tab-' + t));
}

$('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  S.tab = b.dataset.tab;
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('main section').forEach(sec => sec.hidden = sec.id !== 'tab-' + S.tab);
  renderTab();
  window.scrollTo({ top: 0 });
});

// ── Header controls ─────────────────────────────────────────────────────
const gs = $('growth-slider');
function syncGrowthUI() {
  gs.value = String(Math.round(S.P.growth * 400) / 4);
  $('growth-out').textContent = (S.P.growth * 100).toFixed(2).replace(/\.?0+$/, '') + '%';
  gs.style.setProperty('--fill', (Number(gs.value) / 12 * 100) + '%');
  document.querySelectorAll('.scenario-chips button').forEach(b => {
    const map = { bear: S.P.growthBear, base: 0.07, bull: S.P.growthBull };
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
    const map = { bear: S.P.growthBear, base: 0.07, bull: S.P.growthBull };
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
  const cur = document.documentElement.dataset.theme
    || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = cur === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('rl4-theme', document.documentElement.dataset.theme); } catch (e) {}
};
try {
  const th = localStorage.getItem('rl4-theme');
  if (th) document.documentElement.dataset.theme = th;
} catch (e) {}

// ── Boot ────────────────────────────────────────────────────────────────
console.log('%cRetireLens 4 engine assertions', 'font-weight:bold');
for (const a of E.runAssertions()) {
  console.log((a.pass ? 'PASS ' : 'FAIL ') + a.name + ' [got ' + a.got + ']');
}
$('btn-money').textContent = S.todayMoney ? 'Nominal £' : "Today's £";
syncGrowthUI();
recompute();
renderTab();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
