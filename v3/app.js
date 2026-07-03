/**
 * RetireLens 3, app.js
 * UI layer. All calculation lives in engine.js. The Monte Carlo runs in a
 * Web Worker built from the same engine factory, so browser, worker and the
 * node stress harness share one implementation.
 */

import { createEngine } from './engine.js';

const E = createEngine();
const $ = (id) => document.getElementById(id);
const fmt = (n) => '£' + Math.round(n).toLocaleString('en-GB');
const fmtK = (n) => Math.abs(n) >= 1000000 ? '£' + (n / 1000000).toFixed(2) + 'm' : '£' + Math.round(n / 1000) + 'k';

// ── State ──────────────────────────────────────────────────────────────

const S = {
  params: E.defaultParams(),
  vesselPartner: 0,
  frontier: null,
  pickIdx: 0,
  mc: null,
  worker: null
};

// ── Load-time tax assertions, logged for real ─────────────────────────

console.log('%cRetireLens 3 tax assertions (2026/27)', 'font-weight:bold');
for (const a of E.runAssertions()) {
  console.log((a.pass ? 'PASS' : 'FAIL') + '  ' + a.name + '  [' + a.detail + ']');
}

// ── Web Worker from the shared engine factory ─────────────────────────

function makeWorker() {
  const src = `
    const createEngine = ${createEngine.toString()};
    const E = createEngine();
    self.onmessage = (e) => {
      const { params, strategyId, pclsCeiling, nPaths, seed, threshold } = e.data;
      const out = E.runMonteCarlo(params, strategyId, pclsCeiling, nPaths, seed, threshold);
      self.postMessage(out);
    };`;
  return new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
}

// ── Molten Tax-Band Vessels ────────────────────────────────────────────

function vesselZones(residence) {
  // Display zones in gross-income terms, bottom to top.
  if (residence === 'SC') {
    return [
      { name: 'Personal Allowance', rate: 0, from: 0, to: 12570, color: '#37d99a' },
      { name: 'Starter 19%', rate: 0.19, from: 12570, to: 16537, color: '#ffd27a' },
      { name: 'Basic 20%', rate: 0.20, from: 16537, to: 29526, color: '#ffb347' },
      { name: 'Intermediate 21%', rate: 0.21, from: 29526, to: 43662, color: '#ff9838' },
      { name: 'Higher 42%', rate: 0.42, from: 43662, to: 75000, color: '#ff7a1a' },
      { name: 'Advanced 45%', rate: 0.45, from: 75000, to: 100000, color: '#f2600f' },
      { name: 'Taper trap, effective 67.5%', rate: 0.675, from: 100000, to: 125140, color: '#ff2d55', trap: true },
      { name: 'Top 48%', rate: 0.48, from: 125140, to: 160000, color: '#c93400' }
    ];
  }
  return [
    { name: 'Personal Allowance', rate: 0, from: 0, to: 12570, color: '#37d99a' },
    { name: 'Basic 20%', rate: 0.20, from: 12570, to: 50270, color: '#ffb347' },
    { name: 'Higher 40%', rate: 0.40, from: 50270, to: 100000, color: '#ff7a1a' },
    { name: 'Taper trap, effective 60%', rate: 0.60, from: 100000, to: 125140, color: '#ff2d55', trap: true },
    { name: 'Additional 45%', rate: 0.45, from: 125140, to: 160000, color: '#c93400' }
  ];
}

function renderVessels() {
  const partner = S.vesselPartner === 0 ? S.params.partnerA : S.params.partnerB;
  const income = Number($('v-income').value);
  const pcls = Number($('v-pcls').value);
  $('v-income-out').textContent = fmt(income);
  $('v-pcls-out').textContent = fmt(pcls);
  $('v-income').style.setProperty('--fill', (income / 160000 * 100) + '%');
  $('v-pcls').style.setProperty('--fill', (pcls / 60000 * 100) + '%');

  const zones = vesselZones(partner.residence);
  const tax = E.computeTax(partner, income, partner.residence, '2026/27');

  const W = 700, H = 460, left = 150, vw = 300, gap = 6;
  const totalSpan = zones.reduce((s, z) => s + (z.to - z.from), 0);
  const usableH = H - 60 - gap * zones.length;

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img"
    aria-label="Income of ${fmt(income)} poured through ${partner.residence === 'SC' ? 'Scottish' : 'English'} tax bands">`;
  svg += `<defs>
    <linearGradient id="molten" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#e84a0c"/><stop offset="60%" stop-color="#ff7a1a"/><stop offset="100%" stop-color="#ffd27a"/>
    </linearGradient>
    <linearGradient id="trapfill" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#a3103a"/><stop offset="100%" stop-color="#ff2d55"/>
    </linearGradient>
    <linearGradient id="silver" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#8f9bb0"/><stop offset="50%" stop-color="#f2f6fc"/><stop offset="100%" stop-color="#8f9bb0"/>
    </linearGradient>
  </defs>`;

  let y = H - 30;
  for (const z of zones) {
    const span = z.to - z.from;
    const vh = Math.max(26, usableH * (span / totalSpan));
    y -= vh;
    const amtIn = Math.max(0, Math.min(income, z.to) - z.from);
    const fillFrac = span > 0 ? amtIn / span : 0;
    const fh = vh * fillFrac;
    const isTrap = !!z.trap;
    const active = amtIn > 0;

    svg += `<rect x="${left}" y="${y}" width="${vw}" height="${vh}" rx="8"
      fill="rgba(255,255,255,0.03)" stroke="${isTrap ? 'rgba(255,45,85,0.55)' : 'rgba(255,255,255,0.14)'}" stroke-width="1.2"/>`;
    if (fh > 0.5) {
      svg += `<rect class="vessel-fill ${active ? 'molten-live' : ''} ${isTrap && active ? 'trap-live' : ''}"
        x="${left + 3}" y="${y + vh - fh + (fh > 6 ? 3 : 0)}" width="${vw - 6}" height="${Math.max(2, fh - (fh > 6 ? 6 : 0))}" rx="6"
        fill="url(#${isTrap ? 'trapfill' : 'molten'})"/>`;
    }
    const marginalTax = amtIn * (isTrap ? z.rate : z.rate);
    svg += `<text x="${left - 10}" y="${y + vh / 2 - 4}" text-anchor="end" font-size="12" fill="${isTrap ? '#ff2d55' : '#9aa4b8'}" font-weight="700">${z.name}</text>`;
    svg += `<text x="${left - 10}" y="${y + vh / 2 + 12}" text-anchor="end" font-size="11" fill="#5c6678" font-family="monospace">${fmtK(z.from)} to ${fmtK(z.to)}</text>`;
    svg += `<text x="${left + vw + 10}" y="${y + vh / 2 - 4}" font-size="12" fill="${active ? '#e8ecf4' : '#5c6678'}" font-family="monospace" font-weight="700">${amtIn > 0 ? fmt(amtIn) : ''}</text>`;
    if (amtIn > 0 && z.rate > 0) {
      svg += `<text x="${left + vw + 10}" y="${y + vh / 2 + 12}" font-size="11" fill="${isTrap ? '#ff2d55' : '#9aa4b8'}" font-family="monospace">tax ${fmt(marginalTax)}</text>`;
    }
    y -= gap;
  }

  // PCLS silver stream: a channel down the far right that bypasses every vessel.
  if (pcls > 0) {
    const sx = left + vw + 118;
    svg += `<path class="pcls-stream" d="M ${sx} 20 C ${sx + 18} ${H * 0.3}, ${sx - 18} ${H * 0.6}, ${sx} ${H - 34}"
      fill="none" stroke="url(#silver)" stroke-width="${Math.max(4, Math.min(18, pcls / 3500))}" stroke-linecap="round" opacity="0.95"/>`;
    svg += `<text x="${sx}" y="14" text-anchor="middle" font-size="11" fill="#cfd8e6" font-weight="700">PCLS</text>`;
    svg += `<text x="${sx}" y="${H - 16}" text-anchor="middle" font-size="12" fill="#f2f6fc" font-family="monospace" font-weight="800">${fmt(pcls)}</text>`;
  }
  svg += `</svg>`;
  $('vessel-stage').innerHTML = svg;

  const trapZone = zones.find(z => z.trap);
  const inTrap = Math.max(0, Math.min(income, trapZone.to) - trapZone.from);
  $('vessel-proof').innerHTML =
    `Income tax <span class="num">${fmt(tax.tax)}</span>, marginal <span class="num">${(tax.marginalRate * 100).toFixed(1)}%</span>, ` +
    `effective <span class="num">${(tax.effectiveRate * 100).toFixed(1)}%</span>. ` +
    `Personal allowance <span class="num">${fmt(tax.personalAllowance)}</span>` +
    (pcls > 0 ? `, unchanged by the ${fmt(pcls)} PCLS stream: proof that tax-free cash never touches the taper.` : '.') +
    (inTrap > 0 ? ` <span style="color:#ff2d55; font-weight:700;">${fmt(inTrap)} is inside the taper trap.</span>` : '');
}

function renderVesselTabs() {
  const names = [S.params.partnerA.name, S.params.partnerB.name];
  $('vessel-tabs').innerHTML = names.map((n, i) =>
    `<button data-i="${i}" class="${S.vesselPartner === i ? 'on' : ''}">${n} (${(i === 0 ? S.params.partnerA : S.params.partnerB).residence === 'SC' ? 'Scotland' : 'England'})</button>`
  ).join('');
  $('vessel-tabs').querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => { S.vesselPartner = Number(b.dataset.i); renderVesselTabs(); renderVessels(); }));
}

// ── Tax Efficiency Frontier ────────────────────────────────────────────

function renderFrontier() {
  S.frontier = E.buildFrontier(S.params);
  const { points, frontier } = S.frontier;
  // The slider walks every strategy sorted by lifetime tax, cheapest first.
  // The glow marks the true Pareto frontier; when one strategy dominates all
  // others outright the frontier is a single point, and the walk still lets
  // you inspect what the dominated strategies would cost.
  S.walk = [...points].sort((a, b) => a.tax - b.tax || b.estate - a.estate);
  const W = 700, H = 380, pad = 56;
  // Y axis: residual estate when any strategy leaves one, otherwise plan
  // longevity (pot exhaustion age), so the frontier stays readable when every
  // strategy runs dry. A never-exhausted plan plots at the plan end age.
  const endAge = S.params.household.planEndAgeA;
  const useEstate = points.some(p => p.estate > 1);
  const yOf = (p) => useEstate ? p.estate : (p.exhaustAge == null ? endAge : p.exhaustAge);
  const yLabel = useEstate ? 'Residual estate at plan end' : 'Pot exhaustion age, later is better';
  const txs = points.map(p => p.tax), ys = points.map(yOf);
  const xMin = Math.min(...txs) * 0.97, xMax = Math.max(...txs) * 1.03 + 1;
  const yMin = Math.min(...ys) * 0.97, yMax = Math.max(...ys) * 1.03 + 1;
  const X = (v) => pad + (v - xMin) / (xMax - xMin) * (W - pad - 20);
  const Y = (v) => H - pad + (v - yMin) / (yMin - yMax) * (H - pad - 20);

  const sel = S.walk[Math.min(S.pickIdx, S.walk.length - 1)];

  let svg = `<svg class="frontier-svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Strategy frontier of lifetime tax against ${useEstate ? 'residual estate' : 'pot exhaustion age'}">`;
  svg += `<defs><filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  // Axes
  svg += `<line x1="${pad}" y1="${H - pad}" x2="${W - 14}" y2="${H - pad}" stroke="rgba(255,255,255,0.14)"/>`;
  svg += `<line x1="${pad}" y1="${H - pad}" x2="${pad}" y2="14" stroke="rgba(255,255,255,0.14)"/>`;
  svg += `<text x="${W / 2}" y="${H - 14}" text-anchor="middle" font-size="11" fill="#5c6678">Lifetime tax paid, lower is better</text>`;
  svg += `<text x="16" y="${H / 2}" font-size="11" fill="#5c6678" transform="rotate(-90 16 ${H / 2})" text-anchor="middle">${yLabel}</text>`;
  // Frontier glow curve
  const fs = [...frontier].sort((a, b) => a.tax - b.tax);
  svg += `<polyline filter="url(#glow)" fill="none" stroke="#5aa7ff" stroke-width="2.5" opacity="0.9"
    points="${fs.map(p => X(p.tax) + ',' + Y(yOf(p))).join(' ')}"/>`;
  // All points
  for (const p of points) {
    const onF = frontier.includes(p);
    const isSel = p === sel;
    svg += `<circle cx="${X(p.tax)}" cy="${Y(yOf(p))}" r="${isSel ? 9 : onF ? 6 : 4.5}"
      fill="${isSel ? '#ffb347' : onF ? '#5aa7ff' : 'rgba(255,255,255,0.25)'}"
      stroke="${isSel ? '#fff' : 'none'}" stroke-width="1.5" ${isSel ? 'filter="url(#glow)"' : ''}
      style="cursor:pointer" data-pt="${p.label}"/>`;
    if (onF) svg += `<text x="${X(p.tax) + 9}" y="${Y(yOf(p)) - 8}" font-size="10" fill="${isSel ? '#ffb347' : '#9aa4b8'}">${p.label}</text>`;
  }
  svg += `</svg>`;
  $('frontier-stage').innerHTML = svg;

  const sl = $('frontier-slider');
  sl.max = String(S.walk.length - 1);
  sl.value = String(Math.min(S.pickIdx, S.walk.length - 1));
  sl.style.setProperty('--fill', (Number(sl.value) / Math.max(1, S.walk.length - 1) * 100) + '%');
  $('frontier-slider-out').textContent = sel.label;
  const onFrontier = frontier.includes(sel);
  const best = frontier[0];
  $('frontier-pick').innerHTML =
    `Selected <b>${sel.label}</b>: lifetime tax <b>${fmt(sel.tax)}</b>, residual estate <b>${fmt(sel.estate)}</b>` +
    (sel.exhaustAge ? `, pot exhausted at age ${sel.exhaustAge}` : ', pots never exhaust in the deterministic run') + '.' +
    (onFrontier ? '' : (sel.tax - best.tax > 1 ?
      ` Off the frontier: this hands HMRC <b>${fmt(sel.tax - best.tax)}</b> more than ${best.label} for nothing in return.` :
      ` Ties ${best.label} on tax here without beating it on longevity or estate.`));
}

function selectedStrategy() {
  const w = S.walk || S.frontier.frontier;
  const sel = w[Math.min(S.pickIdx, w.length - 1)];
  return { strategyId: sel.id, pclsCeiling: sel.opts.pclsCeiling || null, label: sel.label };
}

// ── Crossover Horizon ──────────────────────────────────────────────────

function renderCrossover() {
  const sel = selectedStrategy();
  const run = E.runPlan(S.params, sel.strategyId, { pclsCeiling: sel.pclsCeiling });
  const rows = run.rows;
  const W = 700, laneH = 84, H = laneH * 2 + 70, pad = 46;
  const n = rows.length;
  const X = (i) => pad + i / (n - 1) * (W - pad - 16);

  const partners = [S.params.partnerA, S.params.partnerB];
  const mcAges = S.mc ? S.mc.perAgeSuccess : null;
  const confAge = S.mc ? S.mc.confidenceAge : null;

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Crossover horizon, one life lane per partner">`;
  partners.forEach((p, pi) => {
    const top = 18 + pi * (laneH + 18);
    const midY = top + laneH / 2;
    svg += `<text x="${pad}" y="${top - 4}" font-size="11" fill="#9aa4b8" font-weight="700">${p.name}, ${p.residence === 'SC' ? 'Scotland' : 'England'}</text>`;
    svg += `<line x1="${pad}" y1="${midY}" x2="${W - 16}" y2="${midY}" stroke="rgba(255,255,255,0.10)" stroke-width="10" stroke-linecap="round"/>`;
    // Guaranteed income intensity along the lane.
    rows.forEach((r, i) => {
      const g = E.guaranteedGross(p, r.year);
      if (g > 0) {
        svg += `<line x1="${X(i)}" y1="${midY}" x2="${X(Math.min(i + 1, n - 1))}" y2="${midY}"
          stroke="#37d99a" stroke-width="10" stroke-linecap="butt" opacity="${Math.min(0.85, 0.25 + g / 30000)}"/>`;
      }
    });
    // Own-wrapper depletion marker from the deterministic run.
    const wKey = pi === 0 ? 'wealthA' : 'wealthB';
    const depIdx = rows.findIndex(r => r[wKey] < 100);
    if (depIdx >= 0) {
      svg += `<line x1="${X(depIdx)}" y1="${top + 8}" x2="${X(depIdx)}" y2="${top + laneH - 8}" stroke="#ff7a1a" stroke-width="2" stroke-dasharray="4 3"/>`;
      svg += `<text x="${X(depIdx)}" y="${top + 6}" font-size="9" fill="#ff7a1a" text-anchor="middle">own pots empty ${rows[depIdx]['age' + (pi === 0 ? 'A' : 'B')]}</text>`;
    }
    // Confidence lamps from the live Monte Carlo, household level.
    if (mcAges) {
      rows.forEach((r, i) => {
        const rec = mcAges[i];
        if (!rec) return;
        svg += `<circle cx="${X(i)}" cy="${top + laneH - 8}" r="3.2" fill="#5aa7ff" opacity="${Math.max(0.06, rec.p)}"/>`;
      });
    }
    // Retirement marker.
    const retIdx = rows.findIndex(r => r.year >= p.retireYear);
    if (retIdx >= 0) {
      svg += `<circle cx="${X(retIdx)}" cy="${midY}" r="5" fill="#ffb347" stroke="#0b0e14" stroke-width="1.5"/>`;
    }
    // Age ticks.
    for (let i = 0; i < n; i += 5) {
      svg += `<text x="${X(i)}" y="${top + laneH + 10}" font-size="9" fill="#5c6678" text-anchor="middle">${rows[i]['age' + (pi === 0 ? 'A' : 'B')]}</text>`;
    }
  });
  // Household confidence age marker across both lanes.
  if (confAge != null) {
    const idx = rows.findIndex(r => r.ageA >= confAge);
    if (idx >= 0) {
      svg += `<line x1="${X(idx)}" y1="10" x2="${X(idx)}" y2="${H - 24}" stroke="#ff2d55" stroke-width="1.6" opacity="0.85"/>`;
      svg += `<text x="${X(idx) + 5}" y="${H - 28}" font-size="10" fill="#ff2d55" font-weight="800">Confidence Age ${confAge}</text>`;
    }
  }
  svg += `</svg>`;
  $('crossover-stage').innerHTML = svg;
  return run;
}

// ── Plan table ─────────────────────────────────────────────────────────

function renderTable(run) {
  let h = '<table class="plan"><thead><tr><th>Year</th><th>A</th><th>B</th><th>Guaranteed</th><th>Draw A</th><th>Draw B</th><th>Tax free</th><th>ISA</th><th>Tax A</th><th>Tax B</th><th>Net</th><th>Wealth</th></tr></thead><tbody>';
  for (const r of run.rows) {
    if (!r.retired) continue;
    h += `<tr class="${r.shortfall > 1 ? 'warn' : ''}"><td>${r.year}</td><td>${r.ageA}</td><td>${r.ageB}</td>` +
      `<td>${fmtK(r.guaranteed)}</td><td>${fmtK(r.drawA)}</td><td>${fmtK(r.drawB)}</td><td>${fmtK(r.taxfree)}</td><td>${fmtK(r.isaUsed)}</td>` +
      `<td>${fmtK(r.taxA)}</td><td>${fmtK(r.taxB)}</td><td>${fmtK(r.netDelivered)}</td><td>${fmtK(r.wealth)}</td></tr>`;
  }
  h += '</tbody></table>';
  if (run.warnings.length) {
    h += '<p class="mc-note" style="margin-top:0.5rem;">Warnings: ' + run.warnings.join('; ') + '.</p>';
  }
  $('plan-table').innerHTML = h;
}

// ── Monte Carlo ────────────────────────────────────────────────────────

function runMC() {
  const sel = selectedStrategy();
  $('mc-status').textContent = 'Running 1000 correlated market paths in a Web Worker, strategy: ' + sel.label + '...';
  if (S.worker) S.worker.terminate();
  S.worker = makeWorker();
  S.worker.onmessage = (e) => {
    S.mc = e.data;
    $('mc-status').textContent = '1000 live paths complete for ' + sel.label + '. Threshold ' + Math.round(S.mc.threshold * 100) + '%.';
    renderMCStats();
    renderEnvelope();
    renderCrossover();
  };
  S.worker.postMessage({
    params: S.params, strategyId: sel.strategyId, pclsCeiling: sel.pclsCeiling,
    nPaths: 1000, seed: 42, threshold: S.params.household.confidence
  });
}

function renderMCStats() {
  const m = S.mc;
  $('mc-stats').innerHTML = `
    <div class="mc-stat"><div class="v" style="color:#5aa7ff">${m.confidenceAge}</div><div class="k">Confidence Age</div></div>
    <div class="mc-stat"><div class="v">${Math.round(m.successProb * 100)}%</div><div class="k">Paths fully funded</div></div>
    <div class="mc-stat"><div class="v" style="color:${m.medianTrim > 0.15 ? '#ff2d55' : '#37d99a'}">${Math.round(m.medianTrim * 100)}%</div><div class="k">Median trim if failing</div></div>`;
}

function renderEnvelope() {
  const env = S.mc.envelopes;
  const W = 700, H = 220, pad = 44;
  const maxW = Math.max(...env.map(e => e.p90)) * 1.05 + 1;
  const X = (i) => pad + i / (env.length - 1) * (W - pad - 12);
  const Y = (v) => H - 26 - (v / maxW) * (H - 44);
  const line = (k) => env.map((e, i) => X(i) + ',' + Y(e[k])).join(' ');
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Percentile wealth envelopes">`;
  svg += `<polygon fill="rgba(90,167,255,0.12)" points="${line('p90')} ${[...env].reverse().map((e, i) => X(env.length - 1 - i) + ',' + Y(e.p10)).join(' ')}"/>`;
  svg += `<polyline fill="none" stroke="#5aa7ff" stroke-width="2" points="${line('p50')}"/>`;
  svg += `<text x="${pad}" y="14" font-size="10" fill="#5c6678">Wealth envelopes, p10 to p90, median line</text>`;
  for (let i = 0; i < env.length; i += 5) {
    svg += `<text x="${X(i)}" y="${H - 8}" font-size="9" fill="#5c6678" text-anchor="middle">${env[i].ageA}</text>`;
  }
  svg += `</svg>`;
  $('mc-envelope').innerHTML = svg;
}

// ── Intake ─────────────────────────────────────────────────────────────

function fieldRow(label, id, value, type) {
  return `<div class="field"><label for="${id}">${label}</label>
    <input id="${id}" type="text" inputmode="${type === 'int' ? 'numeric' : 'decimal'}" value="${value}"></div>`;
}

function renderIntake() {
  const p = S.params;
  const seg = (id, val) => `
    <div class="field"><label>${id.indexOf('a-') === 0 ? 'Partner A' : 'Partner B'} residence</label>
    <div class="seg" data-seg="${id}">
      <button data-v="EN" class="${val === 'EN' ? 'on' : ''}">England</button>
      <button data-v="SC" class="${val === 'SC' ? 'on' : ''}">Scotland</button>
    </div></div>`;
  $('intake-fields').innerHTML =
    seg('a-res', p.partnerA.residence) +
    `<div class="field-grid">
      ${fieldRow('Partner A age in 2026', 'a-age', p.partnerA.age2026, 'int')}
      ${fieldRow('A retirement year', 'a-ret', p.partnerA.retireYear, 'int')}
      ${fieldRow('A SIPP', 'a-sipp', p.partnerA.sipp, 'num')}
      ${fieldRow('A ISA', 'a-isa', p.partnerA.isa, 'num')}
      ${fieldRow('A state pension per year', 'a-sp', p.partnerA.spAmount, 'num')}
      ${fieldRow('A state pension age', 'a-spage', p.partnerA.spAge, 'int')}
    </div>` +
    seg('b-res', p.partnerB.residence) +
    `<div class="field-grid">
      ${fieldRow('Partner B age in 2026', 'b-age', p.partnerB.age2026, 'int')}
      ${fieldRow('B retirement year', 'b-ret', p.partnerB.retireYear, 'int')}
      ${fieldRow('B SIPP', 'b-sipp', p.partnerB.sipp, 'num')}
      ${fieldRow('B ISA', 'b-isa', p.partnerB.isa, 'num')}
      ${fieldRow('B DB pension per year', 'b-db', p.partnerB.dbAmount, 'num')}
      ${fieldRow('B DB start year', 'b-dbyr', p.partnerB.dbStartYear || 2030, 'int')}
      ${fieldRow('B state pension per year', 'b-sp', p.partnerB.spAmount, 'num')}
      ${fieldRow('B state pension age', 'b-spage', p.partnerB.spAge, 'int')}
    </div>
    <div class="field-grid">
      ${fieldRow('Target net household income', 'hh-target', p.household.targetNet, 'num')}
      ${fieldRow('Cash buffer', 'hh-cash', p.household.cash, 'num')}
      ${fieldRow('Confidence threshold %', 'hh-conf', Math.round(p.household.confidence * 100), 'int')}
      ${fieldRow('Plan end age, Partner A', 'hh-end', p.household.planEndAgeA, 'int')}
    </div>`;
  document.querySelectorAll('[data-seg]').forEach(segEl => {
    segEl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      segEl.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    }));
  });
}

function applyIntake() {
  const num = (id, d) => { const v = parseFloat(String($(id).value).replace(/[^0-9.\-]/g, '')); return Number.isFinite(v) ? v : d; };
  const segVal = (id, d) => { const on = document.querySelector(`[data-seg="${id}"] button.on`); return on ? on.dataset.v : d; };
  const p = S.params;
  p.partnerA.residence = segVal('a-res', 'EN');
  p.partnerA.age2026 = num('a-age', 56); p.partnerA.retireYear = num('a-ret', 2030);
  p.partnerA.sipp = num('a-sipp', 570000); p.partnerA.isa = num('a-isa', 46000);
  p.partnerA.spAmount = num('a-sp', 12547); p.partnerA.spAge = num('a-spage', 67);
  p.partnerB.residence = segVal('b-res', 'EN');
  p.partnerB.age2026 = num('b-age', 63); p.partnerB.retireYear = num('b-ret', 2030);
  p.partnerB.sipp = num('b-sipp', 47000); p.partnerB.isa = num('b-isa', 45000);
  p.partnerB.dbAmount = num('b-db', 3205); p.partnerB.dbStartYear = num('b-dbyr', 2030);
  p.partnerB.spAmount = num('b-sp', 12547); p.partnerB.spAge = num('b-spage', 67);
  p.household.targetNet = num('hh-target', 60000);
  p.household.cash = num('hh-cash', 10000);
  p.household.confidence = Math.min(0.99, Math.max(0.5, num('hh-conf', 85) / 100));
  p.household.planEndAgeA = num('hh-end', 95);
}

// ── Assumptions drawer ─────────────────────────────────────────────────

function renderDrawer() {
  const R = S.params.household.returns;
  $('drawer-body').innerHTML = `
    <p class="sub" style="margin-bottom:0.8rem;">Every figure driving this model. Change the return inputs and press Recompute. Nothing here is hidden.</p>
    <div class="field-grid">
      ${fieldRow('SIPP real return mean', 'as-sm', R.sippMean, 'num')}
      ${fieldRow('SIPP volatility', 'as-sv', R.sippVol, 'num')}
      ${fieldRow('ISA real return mean', 'as-im', R.isaMean, 'num')}
      ${fieldRow('ISA volatility', 'as-iv', R.isaVol, 'num')}
      ${fieldRow('SIPP to ISA correlation', 'as-corr', R.corr, 'num')}
      ${fieldRow('Cash real return', 'as-cm', R.cashMean, 'num')}
    </div>
    <button class="primary" id="as-apply" style="width:100%; margin:0.5rem 0 1rem;">Recompute</button>
    <dl>
      <dt>Tax year</dt><dd>2026/27 bands as configured, England and Scotland, per partner</dd>
      <dt>Personal allowance</dt><dd>£12,570, tapered £1 per £2 above £100,000, gone at £125,140</dd>
      <dt>PCLS</dt><dd>25% per crystallisation, lifetime cap £268,275, uses no allowance, never counts toward the taper</dd>
      <dt>UFPLS</dt><dd>25% of each withdrawal tax-free while the lifetime cap remains, 75% taxed as income</dd>
      <dt>ISA</dt><dd>Withdrawals tax-free, £20,000 annual contribution allowance for recycling</dd>
      <dt>Annual Allowance</dt><dd>£60,000, MPAA £10,000 after flexible access</dd>
      <dt>State pension</dt><dd>Default £12,547 per year, editable, starts at each partner's state pension age, held flat in real terms</dd>
      <dt>DB pension</dt><dd>Editable amount and start year, held flat in real terms</dd>
      <dt>National Insurance</dt><dd>Not charged on pension income, so not applied anywhere in this model</dd>
      <dt>Money terms</dt><dd>Everything is real, today's money. Returns are real returns. Target income is constant in real terms</dd>
      <dt>Mortality</dt><dd>No mortality table. The plan runs to a fixed end age you choose, default Partner A age 95</dd>
      <dt>Persona derivation</dt><dd>Partner B DB of £3,205 is the stated £15,752 guaranteed income minus one state pension of £12,547</dd>
      <dt>Monte Carlo</dt><dd>1000 paths, correlated normal real returns, Box-Muller, seeded Mulberry32, run live in a Web Worker</dd>
      <dt>Stress harness</dt><dd>Separate dev-time grid of 1152 deterministic combinations, see stress.md. The app does not claim these ran in your browser</dd>
    </dl>`;
  $('as-apply').addEventListener('click', () => {
    const num = (id, d) => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : d; };
    R.sippMean = num('as-sm', 0.03); R.sippVol = num('as-sv', 0.15);
    R.isaMean = num('as-im', 0.03); R.isaVol = num('as-iv', 0.12);
    R.corr = Math.max(-1, Math.min(1, num('as-corr', 0.8)));
    R.cashMean = num('as-cm', 0);
    rebuildAll();
  });
}

// ── Orchestration ──────────────────────────────────────────────────────

function rebuildAll() {
  renderVesselTabs();
  renderVessels();
  renderFrontier();
  const run = renderCrossover();
  renderTable(run);
  runMC();
}

$('v-income').addEventListener('input', renderVessels);
$('v-pcls').addEventListener('input', renderVessels);
$('frontier-slider').addEventListener('input', (e) => {
  S.pickIdx = Number(e.target.value);
  renderFrontier();
  const run = renderCrossover();
  renderTable(run);
});
$('frontier-slider').addEventListener('change', runMC);
$('btn-drawer').addEventListener('click', () => { renderDrawer(); $('drawer').classList.add('open'); });
$('drawer-close').addEventListener('click', () => $('drawer').classList.remove('open'));
$('btn-edit').addEventListener('click', () => { renderIntake(); $('intake').hidden = false; });
$('intake-apply').addEventListener('click', () => { applyIntake(); $('intake').hidden = true; rebuildAll(); });
$('intake-skip').addEventListener('click', () => { S.params = E.defaultParams(); $('intake').hidden = true; rebuildAll(); });

// First run: show the skippable intake over a fully working default plan.
renderIntake();
$('intake').hidden = false;
rebuildAll();
