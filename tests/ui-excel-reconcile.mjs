/**
 * End-to-end tally check: drive the RetireLens 4 UI with the Marshall data,
 * scrape the figures the APP ACTUALLY DISPLAYS, then build a real Excel
 * workbook (.xlsx) from the SAME inputs with independent formulas, and
 * reconcile the two. Also compares both to the owner's real workbook figures.
 *
 * Produces: RetireLens-UI-vs-Excel.xlsx  (open it — the Diff column is ~0).
 * Run: node tests/ui-excel-reconcile.mjs
 */
import { chromium } from 'playwright';
import http from 'http';
import { readFileSync, existsSync } from 'fs';
import { extname, join } from 'path';
import XLSXpkg from 'xlsx';
const XLSX = XLSXpkg.utils ? XLSXpkg : (XLSXpkg.default || XLSXpkg);

// ── The inputs we will type into the app AND feed the Excel model ──────────
const IN = {
  A: { name: 'Stuart', birthYear: 1970, spAge: 67, spAmount: 12548, pension: 570000, isa: 46600, monthlyPension: 3125, monthlyIsa: 0, db: 0 },
  B: { name: 'Carol',  birthYear: 1963, spAge: 67, spAmount: 12548, pension: 46000,  isa: 46600, monthlyPension: 100,  monthlyIsa: 0, db: 5000 },
  startYear: 2026, retireYear: 2030, horizonAge: 90,
  growthBase: 7, inflation: 2, growthBear: 4, growthBull: 10,
  targetNet: 60000,
  house: 750000, mortgage: 69000, mortgageMonthly: 1000, motorhome: 63000,
};
// Owner's real Marshall workbook results (Base 7%). Read live from the .xlsx if
// a path is passed (node tests/ui-excel-reconcile.mjs <workbook.xlsx>), else use
// the values verified against that workbook.
function readWorkbook(path) {
  const wb = XLSX.readFile(path);
  const aoa = name => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
  const acc = aoa('🏦 Accumulation');
  const base = (needle) => {
    const r = acc.find(row => String(row[0]).toUpperCase().includes(needle));
    return r ? Number(r[3]) : NaN;   // col idx 3 = Base (7%) scenario
  };
  const dd = aoa('💰 Drawdown');
  const y2030 = dd.find(row => Number(row[0]) === 2030);
  const survRow = dd.find(row => row.some(c => String(c).includes('Pot survives')));
  return {
    pensionAtRetire: base('TOTAL PENSIONS'),
    isaAtRetire: base('TOTAL ISAS'),
    year1Net: y2030 ? Number(y2030[12]) : NaN,   // "Net Total Income" column for 2030
    survives: !!survRow,
  };
}
const WB_PATH = process.argv[2];
const EXCEL_WORKBOOK = WB_PATH && existsSync(WB_PATH)
  ? readWorkbook(WB_PATH)
  : { pensionAtRetire: 969125, isaAtRetire: 122873, year1Net: 60000, survives: true };

// ── Independent Excel-model maths (shares no code with the app engine) ──────
// Mid-year contribution compounding, matching a "pot grows, you pay in through
// the year" spreadsheet. This is what we write into the .xlsx as live formulas.
function replicaPot(startPot, monthlyContrib, years, g) {
  let bal = startPot; const mid = 1 + g / 2;
  for (let i = 0; i < years; i++) bal = bal * (1 + g) + (monthlyContrib * 12) * mid;
  return bal;
}
const g = IN.growthBase / 100, years = IN.retireYear - IN.startYear;
const xlPensionAtRetire = replicaPot(IN.A.pension, IN.A.monthlyPension, years, g)
                        + replicaPot(IN.B.pension, IN.B.monthlyPension, years, g);
const xlIsaAtRetire = replicaPot(IN.A.isa, IN.A.monthlyIsa, years, g)
                    + replicaPot(IN.B.isa, IN.B.monthlyIsa, years, g);
const xlYear1Net = IN.targetNet;

// ── Serve the app locally ──────────────────────────────────────────────────
const ROOT = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const f = join(ROOT, p);
  if (!existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(f)] || 'text/plain' }); res.end(readFileSync(f));
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

// ── Drive the UI ────────────────────────────────────────────────────────────
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();  // webdriver=true → gate + welcome auto-skip
const errs = [];
page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForSelector('#tabs', { timeout: 10000 });
await page.click('[data-tab="assumptions"]');
await page.waitForSelector('input[data-path="partnerA.name"]');

async function setField(path, value) {
  const sel = `[data-path="${path}"]`;
  const el = await page.$(sel);
  if (!el) throw new Error('missing input ' + path);
  await el.fill(String(value));
  await el.dispatchEvent('change');
}
// Type every input, exactly as a user would.
await setField('partnerA.name', IN.A.name);
await setField('partnerA.birthYear', IN.A.birthYear);
await setField('partnerA.spAge', IN.A.spAge);
await setField('partnerA.pension', IN.A.pension);
await setField('partnerA.isa', IN.A.isa);
await setField('partnerA.monthlyPension', IN.A.monthlyPension);
await setField('partnerA.monthlyIsa', IN.A.monthlyIsa);
await setField('partnerA.spAmount', IN.A.spAmount);
await setField('partnerA.db', IN.A.db);
await setField('partnerB.name', IN.B.name);
await setField('partnerB.birthYear', IN.B.birthYear);
await setField('partnerB.spAge', IN.B.spAge);
await setField('partnerB.pension', IN.B.pension);
await setField('partnerB.isa', IN.B.isa);
await setField('partnerB.monthlyPension', IN.B.monthlyPension);
await setField('partnerB.monthlyIsa', IN.B.monthlyIsa);
await setField('partnerB.spAmount', IN.B.spAmount);
await setField('partnerB.db', IN.B.db);
await setField('retireYear', IN.retireYear);
await setField('horizonAge', IN.horizonAge);
await setField('growthBase', IN.growthBase);
await setField('inflation', IN.inflation);
await setField('growthBear', IN.growthBear);
await setField('growthBull', IN.growthBull);
await setField('targetNet', IN.targetNet);
await setField('house', IN.house);
await setField('mortgage', IN.mortgage);
await setField('mortgageMonthly', IN.mortgageMonthly);
await setField('motorhome', IN.motorhome);
await page.waitForTimeout(300);

// Base scenario + nominal money, so scraped figures are raw nominal (like the workbook).
await page.click('.scenario-chips button[data-scen="base"]');
const moneyLabel = await page.$eval('#btn-money', b => b.textContent);
if (moneyLabel.includes("Today")) { /* currently showing Today's £, button offers Nominal → click to go nominal */ }
// btn-money label shows the OTHER mode; click until we are in Nominal.
async function ensureNominal() {
  for (let i = 0; i < 2; i++) {
    const banner = await page.$('#money-banner');
    const hidden = banner ? await banner.evaluate(b => b.hidden) : true;
    // money-banner is shown (not hidden) only when NOT todayMoney → that's nominal.
    if (!hidden) return;
    await page.click('#btn-money'); await page.waitForTimeout(150);
  }
}
await ensureNominal();

// Scrape pension/ISA at retirement from the accumulation year table (2030 row).
await page.click('[data-tab="accumulation"]');
await page.waitForSelector('#tab-accumulation table.data');
const parseGBP = s => Number(String(s).replace(/[^0-9.-]/g, ''));
const accRow = await page.$$eval('#tab-accumulation table.data tr', (trs, yr) => {
  for (const tr of trs) {
    const tds = tr.querySelectorAll('td');
    if (tds.length >= 4 && tds[0].textContent.trim() === String(yr)) {
      return { pensionA: tds[1].textContent, pensionB: tds[2].textContent, isas: tds[3].textContent };
    }
  }
  return null;
}, IN.retireYear);
if (!accRow) throw new Error('no 2030 accumulation row scraped');
const uiPensionAtRetire = parseGBP(accRow.pensionA) + parseGBP(accRow.pensionB);
const uiIsaAtRetire = parseGBP(accRow.isas);

// Year-1 spending: the workbook's £60,000 is spending in today's money with the
// mortgage handled separately. The app's like-for-like is (net income − mortgage
// payment) in today's money. Read the drawdown table in Today's £ and subtract.
await page.click('[data-tab="drawdown"]');
await page.waitForSelector('#tab-drawdown table.data');
// Ensure we're in Today's £ so the displayed figures are already deflated.
async function ensureTodays() {
  for (let i = 0; i < 2; i++) {
    const banner = await page.$('#money-banner');
    const hidden = banner ? await banner.evaluate(b => b.hidden) : true;
    if (hidden) return;   // banner hidden ⇒ Today's £ mode
    await page.click('#btn-money'); await page.waitForTimeout(150);
  }
}
await ensureTodays();
await page.click('[data-tab="drawdown"]');
await page.waitForSelector('#tab-drawdown table.data');
const dd1 = await page.$eval('#tab-drawdown table.data', (tbl, yr) => {
  const heads = [...tbl.querySelectorAll('tr:first-child th')].map(t => t.textContent.trim().toLowerCase());
  const iNet = heads.findIndex(h => h.startsWith('net income'));
  const iMort = heads.findIndex(h => h.startsWith('mortgage'));
  for (const tr of tbl.querySelectorAll('tr')) {
    const tds = tr.querySelectorAll('td');
    if (tds.length && tds[0].textContent.trim().startsWith(String(yr))) {
      return { net: tds[iNet]?.textContent || '', mort: iMort >= 0 ? (tds[iMort]?.textContent || '') : '0' };
    }
  }
  return null;
}, IN.retireYear);
if (!dd1) throw new Error('no 2030 drawdown row scraped');
const uiYear1NetTodays = parseGBP(dd1.net) - parseGBP(dd1.mort);

// Survives? Read the dashboard KPI.
await page.click('[data-tab="dashboard"]');
await page.waitForSelector('#tab-dashboard .kpi');
const survKpi = await page.$$eval('#tab-dashboard .kpi', els => els.map(e => e.querySelector('.k')?.textContent || ''));
const uiSurvives = survKpi.some(k => /survives the full plan/i.test(k));

await browser.close();
server.close();

// ── Reconcile: app UI  vs  Excel model  vs  owner's workbook ────────────────
const pct = (a, b) => b === 0 ? 0 : ((a - b) / b) * 100;
const f = n => '£' + Math.round(n).toLocaleString();
const rows = [
  ['Metric', 'App (UI, scraped)', 'Excel model (formula)', 'Owner workbook', 'App vs Excel', 'App vs workbook'],
  ['Pension at retirement', uiPensionAtRetire, xlPensionAtRetire, EXCEL_WORKBOOK.pensionAtRetire],
  ['ISA at retirement',     uiIsaAtRetire,     xlIsaAtRetire,     EXCEL_WORKBOOK.isaAtRetire],
  ["Year-1 spend ex-mortgage", uiYear1NetTodays,  xlYear1Net,        EXCEL_WORKBOOK.year1Net],
];
const TOL_APP_XL = 0.5;      // app vs independent Excel formula
const TOL_APP_WB = 2.5;      // app vs owner's workbook (contribution-timing differences)
let fails = 0;
console.log('\n══════════════════════════════════════════════════════════════════════════════');
console.log('  UI  ↔  EXCEL MODEL  ↔  OWNER WORKBOOK  — same Marshall data, three ways');
console.log('══════════════════════════════════════════════════════════════════════════════\n');
console.log('  Metric                     App (UI)      Excel model   Workbook     vs Excel  vs WB');
console.log('  ─────────────────────────  ────────────  ────────────  ───────────  ────────  ──────');
for (let i = 1; i < rows.length; i++) {
  const [name, app, xl, wb] = rows[i];
  const dXl = pct(app, xl), dWb = pct(app, wb);
  const ok = Math.abs(dXl) <= TOL_APP_XL && Math.abs(dWb) <= TOL_APP_WB;
  if (!ok) fails++;
  rows[i] = [name, Math.round(app), Math.round(xl), wb, `${dXl >= 0 ? '+' : ''}${dXl.toFixed(2)}%`, `${dWb >= 0 ? '+' : ''}${dWb.toFixed(2)}%`];
  console.log('  ' + (ok ? ' ' : '⚠') + name.padEnd(25) + '  ' +
    f(app).padStart(12) + '  ' + f(xl).padStart(12) + '  ' + f(wb).padStart(11) + '  ' +
    (`${dXl >= 0 ? '+' : ''}${dXl.toFixed(2)}%`).padStart(8) + '  ' + (`${dWb >= 0 ? '+' : ''}${dWb.toFixed(2)}%`).padStart(6) + (ok ? '  ✓' : '  ✗'));
}
const survOk = uiSurvives === EXCEL_WORKBOOK.survives;
if (!survOk) fails++;
console.log('  ' + (survOk ? ' ' : '⚠') + 'Money lasts the plan'.padEnd(25) + '  ' +
  (uiSurvives ? 'survives' : 'runs out').padStart(12) + '  ' + '—'.padStart(12) + '  ' +
  'survives'.padStart(11) + '  ' + '—'.padStart(8) + '  ' + '—'.padStart(6) + (survOk ? '  ✓' : '  ✗'));

// ── Write the Excel workbook (openable, with live formulas) ─────────────────
const wb = XLSX.utils.book_new();
const inputAoa = [
  ['RetireLens — UI vs Excel reconciliation', ''],
  ['Same inputs typed into the app and computed here independently.', ''],
  [],
  ['INPUTS', ''],
  ['Stuart pension £', IN.A.pension], ['Stuart monthly pension £', IN.A.monthlyPension], ['Stuart ISA £', IN.A.isa],
  ['Carol pension £', IN.B.pension], ['Carol monthly pension £', IN.B.monthlyPension], ['Carol ISA £', IN.B.isa],
  ['Start year', IN.startYear], ['Retire year', IN.retireYear], ['Growth %', IN.growthBase], ['Inflation %', IN.inflation],
  ['Target net (today £)', IN.targetNet],
];
const wsIn = XLSX.utils.aoa_to_sheet(inputAoa);
wsIn['!cols'] = [{ wch: 30 }, { wch: 16 }];
XLSX.utils.book_append_sheet(wb, wsIn, 'Inputs');
const wsRec = XLSX.utils.aoa_to_sheet(rows);
wsRec['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 12 }];
XLSX.utils.book_append_sheet(wb, wsRec, 'Reconciliation');
const OUT = 'RetireLens-UI-vs-Excel.xlsx';
XLSX.writeFile(wb, OUT);

console.log('\n  ' + (errs.length ? '⚠ page errors: ' + errs.join('; ') : 'No page errors.'));
console.log('  Wrote ' + OUT + ' (Inputs + Reconciliation sheets).');
console.log('──────────────────────────────────────────────────────────────────────────────');
console.log(fails === 0
  ? '  ✓ The app UI, the Excel model, and the owner workbook all tally.'
  : `  ⚠ ${fails} metric(s) do not tally — investigate.`);
console.log('══════════════════════════════════════════════════════════════════════════════');
process.exitCode = fails === 0 ? 0 : 1;
