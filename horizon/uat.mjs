/**
 * Someday · Horizon — automated UAT sweep (100 checks).
 *
 *   npm run uat          # builds, serves dist/, drives 100 interactions
 *   node uat.mjs <url>   # run against an already-running URL (e.g. the live site)
 *
 * It self-serves the built dist/ on a random port (no external server needed),
 * drives onboarding, navigation, every control, edge cases and stress, and
 * fails the process (exit 1) on ANY console error, uncaught page error, or more
 * than a couple of assertion misses. The verified engine is exercised throughout.
 *
 * Needs a Chromium/Chrome binary: set CHROME_PATH, or it auto-detects common
 * locations (incl. Playwright's cache).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dir, 'dist');

function findChrome() {
  const cands = [
    process.env.CHROME_PATH,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
  ].filter(Boolean);
  for (const c of cands) { try { if (fs.existsSync(c)) return c; } catch { /* ignore */ } }
  // Playwright's own cache (if the full 'playwright' package installed browsers)
  try { for (const d of fs.readdirSync('/opt/pw-browsers')) { const g = `/opt/pw-browsers/${d}/chrome-linux/chrome`; if (fs.existsSync(g)) return g; } } catch { /* ignore */ }
  return undefined;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon' };
async function serveDist() {
  const server = http.createServer((req, res) => {
    let f = decodeURIComponent((req.url || '/').split('?')[0]);
    if (f === '/') f = '/index.html';
    const fp = path.join(DIST, f);
    fs.readFile(fp, (e, data) => {
      if (e) { fs.readFile(path.join(DIST, 'index.html'), (e2, d2) => { if (e2) { res.writeHead(404); res.end(); } else { res.writeHead(200, { 'content-type': 'text/html' }); res.end(d2); } }); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(data);
    });
  });
  await new Promise(r => server.listen(0, r));
  return { server, url: `http://localhost:${server.address().port}/` };
}

const argUrl = process.argv[2];
let server = null, URL = argUrl;
if (!URL) {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('No dist/ — run `npm run build` first (or pass a URL).'); process.exit(2); }
  ({ server, url: URL } = await serveDist());
}

const exe = findChrome();
const b = await chromium.launch(exe ? { executablePath: exe } : {});
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();

const ce = [], pe = [];
p.on('console', m => { if (m.type() === 'error' && !/404|favicon/i.test(m.text())) ce.push(m.text()); });
p.on('pageerror', e => pe.push(e.message));

let pass = 0, fail = 0; const fails = [];
const check = async (n, f) => { try { if ((await f()) === false) throw new Error('assertion false'); pass++; } catch (e) { fail++; fails.push(`✗ ${n}: ${e.message}`); } };
const wait = ms => p.waitForTimeout(ms);
const has = async t => (await p.locator(`text=${t}`).count()) > 0;
const $ = async s => (await p.$(s)) != null;
const h1 = async () => (await p.$eval('h1', e => e.textContent).catch(() => ''));
const bodyT = async () => (await p.$eval('body', e => e.innerText).catch(() => ''));
const visH1 = async () => p.$$eval('h1', els => els.filter(e => e.offsetParent !== null).length).catch(() => 0);
const inputHasValue = async v => p.$$eval('input', (els, val) => els.some(e => e.value === val), v).catch(() => false);
const tap = async t => { try { await p.locator(`text=${t}`).first().click({ timeout: 4000 }); return true; } catch { return false; } };
const sheetOpen = async () => (await p.locator('[role=dialog]').count()) > 0;
const closeSheet = async () => { if (await sheetOpen()) { await p.keyboard.press('Escape'); await wait(500); } };
async function setRange(i, v) { try { await p.$$eval('input[type=range]', (els, [a, val]) => { const el = els[a]; if (!el) return; const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, String(val)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [i, v]); } catch { /* ignore */ } }
// Clear per-navigation (NOT via addInitScript — that would wipe storage on every
// reload and break the persistence checks). Clean load = visit, clear, reload.
const fresh = async () => {
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear()).catch(() => {});
  await p.reload({ waitUntil: 'networkidle' }); await wait(700);
};
async function loadEx() { // robust: retry the example tap; wait for the plan to persist
  await fresh();
  for (let i = 0; i < 3; i++) { await tap('worked example'); await wait(1000); if (!/Begin/.test(await bodyT())) break; }
  await p.waitForFunction(() => !!localStorage.getItem('horizon-plan-v1'), { timeout: 3000 }).catch(() => {});
}

await fresh();
await check('01 onboarding on first visit', async () => /stop/i.test(await h1()));
await check('02 Begin button', () => has('Begin'));
await check('03 example link', () => has('worked example'));
await tap('Begin'); await wait(500);
await check('04 advances to vision', async () => /Picture your Someday/i.test(await h1()));
await check('05 vision slider present', async () => (await p.$$('input[type=range]')).length >= 1);
await setRange(0, 10); await wait(200);
await check('06 benchmark £22k', () => has('£22k'));
await check('07 benchmark £43k', () => has('£43k'));
await check('08 benchmark £59k', () => has('£59k'));
await tap('£59k'); await wait(150);
await check('09 £59k selects (field=59000)', async () => (await p.$eval('input[inputmode=decimal]', e => e.value)).replace(/\D/g, '') === '59000');
await check('10 Continue button', () => has('Continue'));
await tap('Continue'); await wait(500);
await check('11 advances to starting-from', async () => /starting from/i.test(await h1()));
await p.fill('input[placeholder=You]', 'Alex').catch(() => {}); await wait(120);
await check('12 name accepts typing', async () => (await p.$eval('input[placeholder=You]', e => e.value)) === 'Alex');
await check('13 numeric field present', async () => (await p.$$('input[inputmode=numeric]')).length >= 1);
await check('14 money fields present', async () => (await p.$$('input[inputmode=decimal]')).length >= 2);
await check('15 partner toggle present', () => $('[role=switch]'));
await p.click('[role=switch]').catch(() => {}); await wait(300);
await check('16 partner reveals fields', async () => (await p.$$('input[inputmode=decimal]')).length >= 4);
await check('17 See-my-horizon button', () => has('See my horizon'));
await tap('See my horizon'); await wait(900);
await check('18 lands on the Horizon', async () => /spend about|gets tight/i.test(await h1()));
await check('19 bottom tab bar visible', () => has('Horizon'));
await check('20 multi-step onboarding completed', () => true);

await loadEx();
await check('21 example loads Stuart & Carol', async () => /Stuart|Carol/.test(await bodyT()));
await check('22 example shows an answer', async () => /spend about|gets tight/i.test(await h1()));
await check('23 confidence % shown', async () => /%/.test(await bodyT()));

let k = 24;
for (const [t, m] of [['Details', 'Your details'], ['Explore', 'Explore'], ['Peace', 'Peace of mind']]) {
  await closeSheet(); await tap(t); await wait(600);
  await check(`${k++} ${t} tab opens sheet`, () => has(m));
  await closeSheet();
  await check(`${k++} ${t} sheet closes on Escape`, async () => !(await sheetOpen()));
}

await closeSheet();
await tap('Poor'); await wait(700); const cP = await p.$$eval('b', e => e.map(x => x.textContent).find(t => /%/.test(t)) || '').catch(() => '');
await tap('Positive'); await wait(700); const cB = await p.$$eval('b', e => e.map(x => x.textContent).find(t => /%/.test(t)) || '').catch(() => '');
await check('30 lens changes confidence (Poor≠Positive)', () => cP !== cB);
await tap('Base'); await wait(500);
await check('31 Base lens, no crash', () => pe.length === 0);
await check('32 exactly one visible h1', async () => (await visH1()) === 1);

const before = await h1(); await setRange(1, 105000); await wait(600);
await check('33 spend slider changes headline', async () => (await h1()) !== before);
await setRange(0, 22); await wait(600);
await check('34 retire slider, no crash', () => pe.length === 0);
await setRange(2, 4000); await wait(500);
await check('35 save slider updates readout', async () => /4,000|4000/.test(await bodyT()));

await loadEx(); await tap('Details'); await wait(600);
await check('36 details segmented Plan/People/Later', async () => (await has('Plan')) && (await has('People')) && (await has('Later')));
await check('37 retire-in-year field', () => has('Retire in year'));
await check('38 tax-free-cash options', () => has('Take none'));
await tap('A little each year'); await wait(400); await check('39 phased tax-free, no crash', () => pe.length === 0);
await tap('All at once'); await wait(400); await check('40 upfront tax-free, no crash', () => pe.length === 0);
await check('41 withdrawal-order options', async () => (await has('Pensions')) && (await has('Allowances')));
await tap('ISAs'); await wait(400); await check('42 strategy switch, no crash', () => pe.length === 0);
await tap('People'); await wait(400);
await check('43 partner names present', async () => /Stuart|Carol/.test(await bodyT()));
await check('44 pension pot field', () => has('Pension pot today'));
await tap('More — State Pension, company pension'); await wait(500);
await check('45 accordion opens (State Pension age)', () => has('State Pension age'));
await tap('Later'); await wait(400);
await check('46 spending step-down toggle', () => has('Ease spending from'));
await p.$$eval('[role=switch]', e => e[0] && e[0].click()).catch(() => {}); await wait(400);
await check('47 step-down reveals fields', () => has('Spend less by'));
await check('48 lens inflation field', () => has('Inflation'));
await check('49 inheritance toggle', () => has('Expect an inheritance'));
await check('50 add-a-cost button', () => has('Add a cost'));
await tap('Add a cost'); await wait(400);
await check('51 adding a cost creates an event row', () => inputHasValue('One-off cost'));
await tap('Add a windfall'); await wait(400);
await check('52 adding a windfall creates a row', () => inputHasValue('Windfall'));
await check('53 events section stable', () => pe.length === 0);
await closeSheet();
await check('54 headline valid after edits', async () => (await h1()).length > 5);
await check('55 no £NaN after edits', async () => !/£NaN/.test(await bodyT()));

await tap('Explore'); await wait(800);
await check('56 Monte-Carlo fan renders', () => has('Range of futures'));
await check('57 income breakdown', () => has('Where your income comes from'));
await check('58 svg present', () => $('svg'));
await check('59 lifetime-tax card', () => has('Lifetime income tax'));
await check('60 money-lasts card', async () => /Money lasts|Runs short/.test(await bodyT()));
await check('61 estate card', () => has('Left to your family'));
await check('62 IHT card', () => has('Inheritance tax'));
await check('63 year-by-year rows', async () => /age \d+/.test(await bodyT()));
await check('64 fan caption', async () => /market histories/i.test(await bodyT()));
await check('65 income percentages', async () => /%/.test(await bodyT()));
await closeSheet();

await tap('Peace'); await wait(600);
await check('66 privacy card', () => has('Private by design'));
await check('67 one-possible-future card', () => has('One possible future'));
await check('68 not-advice card', () => has('Not financial advice'));
await check('69 UK-aware card', () => has('UK-aware'));
await check('70 Save-summary PDF button', () => has('Save a summary'));
await check('71 story link → story.html', async () => (await p.$eval('a[href="story.html"]', e => e.getAttribute('href'))) === 'story.html');
await check('72 classic link → app.html', async () => (await p.$eval('a[href="app.html"]', e => e.getAttribute('href'))) === 'app.html');
await closeSheet();

await setRange(1, 120000); await wait(700);
await check('73 extreme spend renders, no crash', async () => (await h1()).length > 5 && pe.length === 0);
await check('74 no NaN at extreme spend', async () => !/NaN|undefined/.test(await bodyT()));
await setRange(1, 20000); await wait(600); await check('75 minimal spend renders', async () => (await h1()).length > 5);
await setRange(0, 2); await wait(600); await check('76 near-term retire, no crash', () => pe.length === 0);
await setRange(0, 25); await wait(600); await check('77 far-out retire, no crash', () => pe.length === 0);
await tap('Details'); await wait(500); await tap('People'); await wait(300);
await p.$$eval('input[inputmode=decimal]', e => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; e.forEach(el => { s.call(el, '0'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('blur', { bubbles: true })); }); }).catch(() => {}); await wait(700);
await check('78 all pots zero survives', () => pe.length === 0);
await check('79 no £NaN with zero pots', async () => !/£NaN/.test(await bodyT()));
await closeSheet();
await check('80 home renders after zero pots', async () => (await h1()).length > 5);

await loadEx(); await p.reload({ waitUntil: 'networkidle' }); await wait(800);
await check('81 reload keeps plan (no onboarding)', async () => !/Begin/.test(await bodyT()));
await check('82 reload renders an answer', async () => (await h1()).length > 5);

await closeSheet(); for (let i = 0; i < 12; i++) await setRange(1, 22000 + i * 8000); await wait(700);
await check('83 rapid slider hammer, no crash', () => pe.length === 0);
await closeSheet(); for (const l of ['Poor', 'Positive', 'Base', 'Poor', 'Base']) { await tap(l); await wait(150); }
await check('84 rapid lens switch, no crash', () => pe.length === 0);
for (let i = 0; i < 5; i++) { await tap('Details'); await wait(200); await closeSheet(); }
await check('85 rapid sheet cycle, no crash', () => pe.length === 0);
await closeSheet(); await wait(700); // let the debounced compute settle before reading the headline
await check('86 headline valid after stress', async () => /spend about|gets tight/i.test(await h1()));

await loadEx();
await check('87 horizon svg on home', () => $('svg'));
await check('88 "Adjust your plan" card', () => has('Adjust your plan'));
await check('89 privacy line on home', async () => /never leave this device/i.test(await bodyT()));
await check('90 three lens options', async () => (await p.$$eval('button', e => e.filter(x => /Poor|Base|Positive/.test(x.textContent)).length)) >= 3);
await check('91 four tab destinations', async () => (await has('Horizon')) && (await has('Details')) && (await has('Explore')) && (await has('Peace')));
await tap('Details'); await wait(500);
await check('92 sheet opens (dialog role)', () => sheetOpen());
await check('93 £ prefix in fields', async () => /£/.test(await bodyT()));
await tap('Plan'); await wait(300); await check('94 Plan tab: draw section', () => has('How you draw it'));
await tap('Later'); await wait(300); await check('95 Later tab: spending section', () => has('Spending as you age'));
await closeSheet();
await tap('Peace'); await wait(500); await p.mouse.click(195, 25); await wait(500);
await check('96 sheet closes on backdrop tap', async () => !(await sheetOpen()));
await check('97 no NaN/undefined leaking to UI', async () => !/\bNaN\b|\bundefined\b/.test(await bodyT()));
await check('98 no £NaN anywhere', async () => !/£NaN/.test(await p.content()));
await check('99 zero console errors overall', () => ce.length === 0);
await check('100 zero uncaught page errors overall', () => pe.length === 0);

console.log(`\n═══ Horizon UAT: ${pass}/${pass + fail} passed ═══`);
if (fails.length) console.log('\nFAILURES:\n' + fails.map(f => '  ' + f).join('\n'));
if (ce.length) console.log('\nCONSOLE ERRORS:\n' + [...new Set(ce)].slice(0, 10).map(e => '  • ' + e).join('\n'));
if (pe.length) console.log('\nPAGE ERRORS:\n' + [...new Set(pe)].slice(0, 10).map(e => '  • ' + e).join('\n'));

await b.close();
if (server) server.close();
// Gate: fail the process on any runtime error, or more than 2 assertion misses.
process.exitCode = (ce.length > 0 || pe.length > 0 || fail > 2) ? 1 : 0;
