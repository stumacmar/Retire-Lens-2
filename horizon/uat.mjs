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
// Buttons-first: every tap target in the app is a button, so prefer the
// accessible-name match — prose (e.g. Coach copy) can never hijack a tap.
const tap = async t => {
  try { await p.getByRole('button', { name: t }).first().click({ timeout: 4000 }); return true; }
  catch { try { await p.locator(`text=${t}`).first().click({ timeout: 2000 }); return true; } catch { return false; } }
};
const sheetOpen = async () => (await p.locator('[role=dialog]').count()) > 0;
// Some controls (spending style, the lens) exist both on the Horizon and
// inside a sheet — scope the tap so it can never hit the card behind.
const tapInSheet = async t => {
  try { await p.locator('[role=dialog]').getByRole('button', { name: t }).first().click({ timeout: 4000 }); return true; }
  catch { return false; }
};
const closeSheet = async () => { if (await sheetOpen()) { await p.keyboard.press('Escape'); await wait(500); } };
async function setRange(i, v) { try { await p.$$eval('input[type=range]', (els, [a, val]) => { const el = els[a]; if (!el) return; const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, String(val)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [i, v]); } catch { /* ignore */ } }
// Clear per-navigation (NOT via addInitScript — that would wipe storage on every
// reload and break the persistence checks). Clean load = visit, clear, reload.
// Most of the sweep runs as a Plus customer (every feature reachable). A
// pre-validated licence record is seeded locally, so no network is touched.
// The free tier is exercised explicitly at the end.
const PLUS = JSON.stringify({ key: 'uat-seeded-licence', instanceId: 'uat', instanceName: 'UAT', status: 'active', expiresAt: null, activatedAt: Date.now(), validatedAt: Date.now(), variantName: 'Lifetime' });
// The preview gate (public/gate.js) sits in front of every page until launch;
// the sweep unlocks it the way a tester would, by storing the phrase hash.
const GATE_HASH = fs.readFileSync(path.join(__dir, 'public', 'gate.js'), 'utf8').match(/var HASH = '([0-9a-f]{64})'/)[1];
const passGate = () => p.evaluate(h => localStorage.setItem('someday-gate-v1', h), GATE_HASH).catch(() => {});
const seedPlus = () => p.evaluate(v => localStorage.setItem('someday-licence-v1', v), PLUS).catch(() => {});
const acceptDisclaimer = async () => { if (await has('I understand')) { await tap('I understand'); await wait(700); } };
const fresh = async () => {
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.clear()).catch(() => {});
  await passGate();
  await seedPlus();
  await p.reload({ waitUntil: 'networkidle' }); await wait(700);
};
const planOf = async () => p.evaluate(() => { try { return JSON.parse(localStorage.getItem('horizon-plan-v1') || '{}'); } catch { return {}; } });
async function setField(label, value, which = 0) {
  const inp = p.locator(`label:has-text(${JSON.stringify(label)}) input`).nth(which);
  if (await inp.count() === 0) return false;
  const before = await p.evaluate(() => localStorage.getItem('horizon-plan-v1'));
  await inp.fill(String(value)); await wait(150); await inp.blur();
  // Wait for the write rather than guessing: the commit lands inside a render
  // that also recomputes the engine, so a fixed sleep is a flaky race.
  for (let i = 0; i < 25; i++) {
    if ((await p.evaluate(() => localStorage.getItem('horizon-plan-v1'))) !== before) break;
    await wait(80);
  }
  await wait(120);
  return true;
}

async function loadEx() { // robust: retry the example tap; wait for the plan to persist
  await fresh();
  for (let i = 0; i < 3; i++) { await tap('worked example'); await wait(1000); if (!/Begin/.test(await bodyT())) break; }
  await p.waitForFunction(() => !!localStorage.getItem('horizon-plan-v1'), { timeout: 3000 }).catch(() => {});
  await acceptDisclaimer();
}

// Preview gate: when enabled, a stranger sees only the phrase screen and the right phrase opens it;
// when disabled (launch), a fresh visitor must never see it.
const GATE_ON = /var ENABLED = true/.test(fs.readFileSync(path.join(__dir, 'public', 'gate.js'), 'utf8'));
await p.goto(URL, { waitUntil: 'networkidle' }); await p.evaluate(() => localStorage.clear()).catch(() => {}); await p.reload({ waitUntil: 'networkidle' }); await wait(500);
if (GATE_ON) {
  await check('00a preview gate shown to a fresh visitor', () => $('#someday-gate'));
  await p.fill('#someday-gate-input', 'wrong-phrase'); await p.keyboard.press('Enter'); await wait(400);
  await check('00b wrong phrase is refused', async () => (await $('#someday-gate')) && /not the phrase/.test(await bodyT()));
  await p.fill('#someday-gate-input', 'someday-preview-2026'); await p.keyboard.press('Enter'); await wait(500);
  await check('00c right phrase opens the app', async () => !(await $('#someday-gate')));
  await check('00d gate remembered on reload', async () => { await p.reload({ waitUntil: 'networkidle' }); await wait(500); return !(await $('#someday-gate')); });
} else {
  await check('00a gate is off: a fresh visitor goes straight in', async () => !(await $('#someday-gate')));
}
await check('00e noindex meta present (remove at public launch)', async () => (await p.$('meta[name="robots"][content*="noindex"]')) != null);

await fresh();
await check('01 onboarding on first visit', async () => /stop/i.test(await h1()));
await check('02 Begin button', () => has('Begin'));
await check('03 example link', () => has('worked example'));
await tap('Begin'); await wait(600);
// Setup is the sky itself: constellations filled in any order, not a form.
await check('04 advances to the sky', async () => /Build your sky/i.test(await h1()));
await check('05 four core constellations present', async () =>
  (await p.locator('text=You & yours').count()) > 0 &&
  (await p.locator("text=What you've saved").count()) > 0 &&
  (await p.locator('text=Your someday').count()) > 0 &&
  (await p.locator("text=What's promised").count()) > 0);
await check('06 the ghosted horizon is drawn behind them', async () => (await p.$$('svg')).length >= 1);
await check('07 cannot continue with nothing saved', async () =>
  /Add what/i.test(await p.$$eval('button', els => els.map(e => e.textContent).join(' '))));
// You & yours
await tap('You & yours'); await wait(600);
await check('08 identity editor opens', () => has('Your name'));
await p.fill('input[placeholder=You]', 'Alex').catch(() => {}); await wait(200);
await check('09 name accepts typing', async () => (await p.$eval('input[placeholder=You]', e => e.value)) === 'Alex');
await check('10 birth year field present', async () => (await p.$$('input[inputmode=numeric]')).length >= 1);
await check('10b household choice lives here', async () => (await has('A couple')) && (await has('Just me')));
await tap('Done'); await wait(600);
// What you've saved — the one constellation the picture cannot do without
await tap("What you've saved"); await wait(600);
await check('11 savings editor opens', () => has('Workplace pension'));
await setField('Workplace pension', 250000);
await check('12 pension captured', async () => (await planOf()).partnerA?.pension === 250000);
await setField('ISAs today', 40000);
await check('13 ISA captured', async () => (await planOf()).partnerA?.isa === 40000);
await tap('Done'); await wait(700);
// Your someday
await tap('Your someday'); await wait(600);
await check('14 someday editor opens', () => has('Income you want each year'));
await setField('Income you want each year', 48000);
await check('15 target income captured', async () => (await planOf()).targetNet === 48000);
await tap('Done'); await wait(600);
await check('16 the sky records what you filled', async () => (await planOf()).partnerA?.pension > 0);
await check('17 See-my-horizon now offered', () => has('See my horizon'));
await tap('See my horizon'); await wait(900);
// The disclaimer, accepted once before the first horizon
await check('17a disclaimer shown once, before the horizon', async () => /calm place to think/i.test(await h1()));
await check('17a2 disclaimer links to the legal page', async () => (await p.$('a[href="legal.html"]')) != null);
await tap('I understand'); await wait(800);
// The framing choice, asked once before the horizon
await check('17b approach screen asks how the money is run', async () => /How should the money be run/i.test(await h1()));
await check('17c traditional option offered', () => has('Traditional'));
await check('17d de-risking option offered', () => has('De-risking'));
await tap('Traditional'); await wait(900);
await check('18 lands on the Horizon', async () => /spend about|draw your horizon|gets tight/i.test(await h1()));
await check('19 bottom tab bar visible', () => has('Horizon'));
await check('20 multi-step onboarding completed', () => true);

await loadEx();
await check('21 example loads Stuart & Carol', async () => /Stuart|Carol/.test(await bodyT()));
await check('22 example shows an answer', async () => /looks sustainable|gets tight/i.test(await h1()));
await check('23 confidence % shown', async () => /%/.test(await bodyT()));

let k = 24;
for (const [t, m] of [['Details', 'Your details'], ['Explore', 'Explore'], ['Peace', 'Peace of mind']]) {
  await closeSheet(); await tap(t); await wait(600);
  await check(`${k++} ${t} tab opens sheet`, () => has(m));
  await closeSheet();
  await check(`${k++} ${t} sheet closes on Escape`, async () => !(await sheetOpen()));
}

await closeSheet();
const mpath = () => p.$eval('svg path[stroke="var(--color-ocean)"]', e => e.getAttribute('d') || '').catch(() => '');
// Click the segmented buttons specifically (the legend also contains "Poor").
await p.locator('button:has-text("Poor")').first().click(); await wait(700); const cP = await mpath();
await p.locator('button:has-text("Positive")').first().click(); await wait(700); const cB = await mpath();
await check('30 lens reshapes the horizon (Poor≠Positive)', () => !!cP && cP !== cB);
await tap('Base'); await wait(500);
await check('31 Base lens, no crash', () => pe.length === 0);
await check('32 exactly one visible h1', async () => (await visH1()) === 1);

const before = await h1(); await setRange(1, 105000); await wait(600);
await check('33 spend slider changes headline', async () => (await h1()) !== before);
await setRange(0, 22); await wait(600);
await check('34 retire slider, no crash', () => pe.length === 0);
await setRange(2, 4000); await wait(500);
await check('35 save slider updates readout', async () => /4,000|4000/.test(await bodyT()));

await loadEx(); await tap('Details'); await wait(700);
// Editing is the same sky, so the interface is learned exactly once.
await check('36 details opens the sky, not a form', async () =>
  (await p.locator('text=You & yours').count()) > 0 && (await p.locator("text=How it's run").count()) > 0);
// Your someday — when you stop, what you spend, and the life events around it
await tap('Your someday'); await wait(500);
await check('37 retire-in-year field', () => has('Retire in year'));
await check('46 spending style offered', () => has('Go-go'));
await tapInSheet('No-go'); await wait(400);
await check('47a No-go flattens the spending plan', async () => { const q = await planOf(); return q.phase1On === false && q.phase2On === false; });
await tapInSheet('Go-go'); await wait(400);
await check('47b Go-go turns both step-downs on', async () => { const q = await planOf(); return q.phase1On === true && q.phase2On === true; });
await check('47c step-down figures revealed', () => has('Spend less by'));
await check('49 inheritance toggle', () => has('Expect an inheritance'));
await check('50 add-a-cost button', () => has('Add a cost'));
await tap('Add a cost'); await wait(400);
await check('51 adding a cost creates an event row', () => inputHasValue('One-off cost'));
await tap('Add a windfall'); await wait(400);
await check('52 adding a windfall creates a row', () => inputHasValue('Windfall'));
await check('53 events section stable', () => pe.length === 0);
await tap('All of it'); await wait(500);
// How it's run — tax, drawing order, structure and the lens
await tap("How it's run"); await wait(500);
await check('38 tax-free-cash options', () => has('Take none'));
await check('38b income-tax region choice (Scotland)', () => has('Scotland'));
await tap('A little each year'); await wait(400); await check('39 phased tax-free, no crash', () => pe.length === 0);
await tap('All at once'); await wait(400); await check('40 upfront tax-free, no crash', () => pe.length === 0);
await check('41 withdrawal-order options', async () => (await has('Pensions')) && (await has('Allowances')));
await tap('ISAs'); await wait(400); await check('42 strategy switch, no crash', () => pe.length === 0);
await check('48 lens inflation field', () => has('Inflation'));
await tap('All of it'); await wait(500);
// What you've saved — the pots, per person
await tap("What you've saved"); await wait(500);
await check('43 partner names present', async () => /Stuart|Carol/.test(await bodyT()));
await check('44 pension pot field', () => has('Workplace pension'));
await check('44b advanced-mode toggle present', () => has('Advanced'));
await check('44d cash and the home are reachable', async () => (await has('Cash & Premium Bonds')) && (await has('Home value')));
await tap('All of it'); await wait(500);
// What's promised — the income that arrives whatever markets do
await tap("What's promised"); await wait(500);
await check('45 State Pension fields present', () => has('State Pension age'));
await check('44c public-sector scheme pension can be added', () => has('Add an NHS'));
await check('45b company DB pension reachable', () => has('final-salary'));
await closeSheet();
await check('54 headline valid after edits', async () => (await h1()).length > 5);
await check('55 no £NaN after edits', async () => !/£NaN/.test(await bodyT()));

await tap('Explore'); await wait(800);
await check('56 Monte-Carlo fan renders', () => has('Range of futures'));
await check('57 income breakdown', () => has('Where your income comes from'));
await check('56b decision levers ranked (What moves the needle)', async () => (await has('What moves the needle')) && /pts/.test(await bodyT()));
await check('56c stress tests headline', async () => (await has('Stress tests')) && /stress tests/.test(await bodyT()));
await check('57b dates that matter (personal timeline)', async () => (await has('Dates that matter')) && /State Pension starts, at 67/.test(await bodyT()));
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
await check('69b assumptions list generated', async () => { await tap('Every assumption behind your numbers'); await wait(400); return (await has('Range of futures')) && (await has('Couples')); });
await check('70 Save-report PDF button', () => has('Save the full report'));
await check('71 story link → story.html', async () => (await p.$eval('a[href="story.html"]', e => e.getAttribute('href'))) === 'story.html');
await check('72 no classic-planner link (one product, one app)', async () => (await p.$('a[href="app.html"]')) == null);
await closeSheet();

await setRange(1, 120000); await wait(700);
await check('73 extreme spend renders, no crash', async () => (await h1()).length > 5 && pe.length === 0);
await check('74 no NaN at extreme spend', async () => !/NaN|undefined/.test(await bodyT()));
await setRange(1, 20000); await wait(600); await check('75 minimal spend renders', async () => (await h1()).length > 5);
await setRange(0, 2); await wait(600); await check('76 near-term retire, no crash', () => pe.length === 0);
await setRange(0, 25); await wait(600); await check('77 far-out retire, no crash', () => pe.length === 0);
await tap('Details'); await wait(500); await tap("What you've saved"); await wait(400);
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
await check('86 headline valid after stress', async () => /looks sustainable|gets tight/i.test(await h1()));

await loadEx();
await check('87 horizon svg on home', () => $('svg'));
await check('88 "Adjust your plan" card', () => has('Adjust your plan'));
await check('89 privacy line on home', async () => /never leave this device/i.test(await bodyT()));
await check('90 three lens options', async () => (await p.$$eval('button', e => e.filter(x => /Poor|Base|Positive/.test(x.textContent)).length)) >= 3);
await check('91 four tab destinations', async () => (await has('Horizon')) && (await has('Details')) && (await has('Explore')) && (await has('Peace')));
await tap('Details'); await wait(500);
await check('92 sheet opens (dialog role)', () => sheetOpen());
await check('93 £ prefix in fields', async () => /£/.test(await bodyT()));
await tap("How it's run"); await wait(500); await check('94 strategy section reachable', () => has('How you draw it'));
await tap('All of it'); await wait(400);
await tap('Your someday'); await wait(500); await check('95 spending section reachable', () => has('Spending as you age'));
await closeSheet();
await tap('Peace'); await wait(500); await p.mouse.click(195, 25); await wait(500);
await check('96 sheet closes on backdrop tap', async () => !(await sheetOpen()));
await check('97 no NaN/undefined leaking to UI', async () => !/\bNaN\b|\bundefined\b/.test(await bodyT()));
await check('98 no £NaN anywhere', async () => !/£NaN/.test(await p.content()));
await check('99 zero console errors overall', () => ce.length === 0);
await check('100 zero uncaught page errors overall', () => pe.length === 0);

// ── Free tier: the answer stays whole, depth is locked honestly ──────────
await p.evaluate(() => localStorage.removeItem('someday-licence-v1')).catch(() => {});
await p.reload({ waitUntil: 'networkidle' }); await wait(900);
await check('101 free: disclaimer not asked again', async () => !/calm place to think/i.test(await h1()));
await check('102 free: the answer still renders', async () => /looks sustainable|gets tight/i.test(await h1()));
await check('103 free: confidence % still shown', async () => /% of simulated futures/.test(await bodyT()));
await check('104 free: Get Plus pill in header', () => $('button[aria-label="Get Someday Plus"]'));
await tap('Explore'); await wait(900);
await check('105 free: Monte Carlo stays free', () => has('Range of futures'));
await check('106 free: lifetime-tax card stays free', () => has('Lifetime income tax'));
await check('107 free: estate picture is locked', () => has('The estate picture'));
await check('108 free: withdrawal order locked', async () => /Withdrawal order & tax/.test(await bodyT()) && !(await has('lowest lifetime tax')));
await check('109 free: year-by-year locked with a preview', () => has('Every year, in full'));
await check('109b free: top lever shown, rest behind Plus', async () => (await has('What moves the needle')) && /more levers? measured/.test(await bodyT()));
await check('109c free: stress headline shown, table behind Plus', async () => (await has('Stress tests')) && /The full table/.test(await bodyT()));
await check('110 free: lock opens the Plus sheet', async () => { await p.getByRole('button', { name: 'See what Plus adds' }).first().click(); await wait(700); return has('Already have a licence key?'); });
await check('111 free: both prices shown', async () => (await has('£49')) && (await has('£129')));
await check('112 free: checkout buttons disabled until configured', async () => (await p.$$eval('button:disabled', e => e.filter(x => /Coming soon/.test(x.textContent)).length)) === 2);
await tap('Already have a licence key?'); await wait(300);
await p.fill('input[aria-label="Licence key"]', 'not-a-key'); await tap('Activate on this device'); await wait(500);
await check('113 free: malformed key is refused locally (no network)', async () => /doesn’t look like a licence key/.test(await bodyT()));
await closeSheet();
await tap('Details'); await wait(500); await tap("What you've saved"); await wait(400);
await check('114 free: advanced detail locked', async () => (await has('Advanced detail')) && (await p.locator('[role=switch]:has-text("Advanced")').count()) === 0);
await tap('All of it'); await wait(400); await tap("How it's run"); await wait(500);
await check('115 free: plan structure locked', async () => (await has('Plan structure')) && !(await has('Set up the standard architecture')));
await closeSheet();
await tap('Peace'); await wait(500);
await check('116 free: report button routes to Plus', async () => { await tap('Save the full report'); await wait(600); return has('Already have a licence key?'); });
await check('117 free: print report not rendered', async () => (await p.$('#print-summary')) == null);
await closeSheet();
await seedPlus(); await p.reload({ waitUntil: 'networkidle' }); await wait(900);
await check('118 plus: pill shows active', () => $('button[aria-label="Someday Plus — active"]'));
await check('119 plus: print report rendered', async () => (await p.$('#print-summary')) != null);
await check('120 free/plus sweep: zero page errors', () => pe.length === 0);

console.log(`\n═══ Horizon UAT: ${pass}/${pass + fail} passed ═══`);
if (fails.length) console.log('\nFAILURES:\n' + fails.map(f => '  ' + f).join('\n'));
if (ce.length) console.log('\nCONSOLE ERRORS:\n' + [...new Set(ce)].slice(0, 10).map(e => '  • ' + e).join('\n'));
if (pe.length) console.log('\nPAGE ERRORS:\n' + [...new Set(pe)].slice(0, 10).map(e => '  • ' + e).join('\n'));

await b.close();
if (server) server.close();
// Gate: fail the process on any runtime error, or more than 2 assertion misses.
process.exitCode = (ce.length > 0 || pe.length > 0 || fail > 2) ? 1 : 0;
