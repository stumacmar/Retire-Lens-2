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
import { Engine as E } from './src/engine/engine.js';

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
// Every request that leaves the served app (there must be none: the app is
// private by design, and with Plus off there is not even a licence check).
const requests = [];
p.on('request', r => { const u = r.url(); if (!u.startsWith(URL) && !/^(data|blob|about):/.test(u)) requests.push(u); });

let pass = 0, fail = 0; const fails = [];
const check = async (n, f) => { try { if ((await f()) === false) throw new Error('assertion false'); pass++; } catch (e) { fail++; fails.push(`✗ ${n}: ${e.message}`); } };
const wait = ms => p.waitForTimeout(ms);
const has = async t => (await p.locator(`text=${t}`).count()) > 0;
// Every carousel page stays in the DOM, so "is this text on screen?" has to
// mean "on the page you are actually looking at" — otherwise an assertion
// about the Drawing page passes while you sit on Who.
const onPage = async t => (await p.locator('[data-active]').locator(`text=${t}`).count()) > 0;
const $ = async s => (await p.$(s)) != null;
const h1 = async () => (await p.$eval('h1', e => e.textContent).catch(() => ''));
const bodyT = async () => (await p.$eval('body', e => e.innerText).catch(() => ''));
const h2 = async () => (await p.$eval('h2', e => e.textContent).catch(() => ''));
const pageTitle = async () => (await p.$$eval('h2', els => { const v = els.filter(e => e.offsetParent !== null); return v.length ? v[v.length - 1].textContent : ''; }).catch(() => ''));
const visH1 = async () => p.$$eval('h1', els => els.filter(e => e.offsetParent !== null).length).catch(() => 0);
const inputHasValue = async v => p.$$eval('input', (els, val) => els.some(e => e.value === val), v).catch(() => false);
// Buttons-first: every tap target in the app is a button, so prefer the
// accessible-name match — prose (e.g. Coach copy) can never hijack a tap.
const tap = async t => {
  try { await p.getByRole('button', { name: t }).first().click({ timeout: 4000 }); return true; }
  catch { try { await p.locator(`text=${t}`).first().click({ timeout: 2000 }); return true; } catch { return false; } }
};
const sheetOpen = async () => (await p.locator('[role=dialog]').count()) > 0;
// The home: one screen. The answer, the time tunnel, three steppers (each also
// typeable) and two questions. (The Horizon Dial was retired in November 2026.)
const answerText = async () => (await p.$eval('[data-answer]', e => e.innerText).catch(() => '')).replace(/\s+/g, ' ');
const futuresText = async () => p.$eval('[data-futures]', e => e.textContent).catch(() => '');
const statusKey = async () => p.$eval('[data-status]', e => e.getAttribute('data-status')).catch(() => '');
const waitAnswer = async (ms = 25000) => p.waitForFunction(() => document.querySelector('[data-answer]')?.getAttribute('data-ready') === '1' && /of 100/.test(document.querySelector('[data-futures]')?.textContent || ''), null, { timeout: ms }).catch(() => {});
// Type a figure into one of the home's three steppers: 'Stop work at' (an
// age), 'Take home' or 'You pay in' / 'Pay in' (a month).
const homeType = async (label, value) => {
  await p.getByRole('button', { name: new RegExp(`^${label}: .*Tap to type`) }).click({ timeout: 4000 });
  await p.fill(`input[aria-label="${label}, type a figure"]`, String(value)); await p.keyboard.press('Enter'); await wait(400);
};
// What the tunnel is showing: the age read (if any), the reading under it, and the count of futures paying in full each year.
const sunState = async () => p.evaluate(() => { const el = document.querySelector('[data-tunnel]'); if (!el) return null; const sl = el.querySelector('[role=slider]');
  return { ready: el.getAttribute('data-ready') === '1', age: el.getAttribute('data-age') === '' ? null : +el.getAttribute('data-age'), first: +el.getAttribute('data-first'), last: +el.getAttribute('data-last'), n: +el.getAttribute('data-years'),
    counts: (el.getAttribute('data-full-counts') || '').split(',').filter(Boolean).map(Number), firstShort: el.getAttribute('data-first-short') === '' ? null : +el.getAttribute('data-first-short'),
    valuetext: sl?.getAttribute('aria-valuetext') || '', label: el.querySelector('[data-tunnel-text]')?.textContent || '', summary: document.getElementById('tunnel-summary')?.textContent || '', horizon: +el.getAttribute('data-horizon') }; });
// The tunnel's depth rule (TimeTunnel.tsx), written again here so the test does not trust the code it checks:
// at rest, at t (0 at your feet, 1 at the plan age) a frame is 1 - 0.87t the size of the one at your feet, and its floor that far below the vanishing point.
const roadS = t => 1 - 0.87 * t;
const gbp = v => '£' + Math.round(v).toLocaleString('en-GB');
const restingLine = (q, m, firstShort) => { const month = Math.round(q.targetNet / 12); const dip = m.worstYearRatioP10 < 0.995 ? Math.round((m.worstYearRatioP10 * month) / 10) * 10 : null;
  return firstShort == null ? `No future falls short before ${q.horizonAge}.` : `From ${firstShort}, some futures fall short.${dip != null ? ` In the worst 10 of 100, income dips to about ${gbp(dip)} a month.` : ''}`; };
// Controls that exist both on the Horizon and inside a sheet must be tapped
// where they are meant, never on the card behind.
const tapInSheet = async t => {
  try { await p.locator('[role=dialog]').getByRole('button', { name: t }).first().click({ timeout: 4000 }); return true; }
  catch { return false; }
};
// Jump to a named page of the form carousel via its rail.
// Jump to a named page of the form carousel via its rail, and WAIT for that
// page to be the one on screen. A fixed sleep is a guess: a jump across five
// pages takes as long as the device needs, and CI is slower than this one.
// Wait for a named page to be the one on screen (after a Next/Back tap).
const waitPage = async t => {
  try {
    await p.waitForFunction(want => {
      const el = document.querySelector('[data-active]');
      return !!el && el.getAttribute('data-title') === want;
    }, t, { timeout: 8000 });
    return true;
  } catch { return false; }
};
const goPage = async t => {
  if (!(await tapInSheet(t)) && !(await tap(t))) return false;
  try {
    await p.waitForFunction(want => {
      const el = document.querySelector('[data-active]');
      return !!el && el.getAttribute('data-title') === want;
    }, t, { timeout: 10000 });
  } catch { return false; }
  await wait(200);
  return true;
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
// Every carousel page stays in the DOM, so a page-wide selector would happily
// type into the page you are NOT looking at (and did: Jo's figures landed
// on Robin). Prefer the active page; fall back to the document for the
// screens that are not a carousel.
async function setField(label, value, which = 0) {
  const sel = `label:has-text(${JSON.stringify(label)}) input`;
  const onPane = p.locator(`[data-active] ${sel}`);
  const inp = (await onPane.count()) > 0 ? onPane.nth(which) : p.locator(sel).nth(which);
  if (await inp.count() === 0) return false;
  const before = await p.evaluate(() => localStorage.getItem('horizon-plan-v1'));
  await inp.fill(String(value)); await wait(260); await inp.blur();
  for (let i = 0; i < 25; i++) {
    if ((await p.evaluate(() => localStorage.getItem('horizon-plan-v1'))) !== before) break;
    await wait(80);
  }
  await wait(120);
  return true;
}

// The suite's own fixture: the reference workbook plan (E.defaults()), loaded directly. The
// "See a worked example" button loads a different, made-up couple (E.example()); check 03b.
async function loadEx() {
  await fresh();
  await p.evaluate(v => localStorage.setItem('horizon-plan-v1', v), JSON.stringify({ ...E.defaults(), approach: 'traditional' }));
  await p.reload({ waitUntil: 'networkidle' }); await wait(700);
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
  // The phrase itself is never written into this public repository: give it as GATE_PHRASE to type it
  // in; without it, the test unlocks with the stored hash, as a returning tester's device would.
  if (process.env.GATE_PHRASE) { await p.fill('#someday-gate-input', process.env.GATE_PHRASE); await p.keyboard.press('Enter'); await wait(500); }
  else { await passGate(); await p.reload({ waitUntil: 'networkidle' }); await wait(500); }
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
// Privacy (review, 17 November 2026): the worked example is a made-up couple, never the reference workbook.
await check('03b the worked example loads the made-up couple (Alex and Sam), not the workbook fixture', async () => {
  for (let i = 0; i < 3; i++) { await tap('worked example'); await wait(1000); if (!/Begin/.test(await bodyT())) break; }
  await p.waitForFunction(() => !!localStorage.getItem('horizon-plan-v1'), { timeout: 3000 }).catch(() => {});
  const q = await planOf(), ex = E.example(), D = E.defaults();
  return q.partnerA?.name === 'Alex' && q.partnerB?.name === 'Sam' && q.partnerA.pension === ex.partnerA.pension && q.partnerA.pension !== D.partnerA.pension; });
await fresh();
await tap('Begin'); await wait(900);
// The disclaimer, accepted once before the first answer
await check('17a disclaimer shown once, before the horizon', async () => /calm place to think/i.test(await h1()));
await check('17a2 disclaimer links to the legal page', async () => (await p.$('a[href="legal.html"]')) != null);
await tap('I understand'); await wait(800);
await check('17b approach screen asks how the money is run', async () => /How should the money be run/i.test(await h1()));
await check('17c traditional option offered', () => has('Traditional'));
await check('17d de-risking option offered', () => has('De-risking'));
await tap('Traditional'); await wait(1200);
// An empty plan lands on the home, which says what to do; the figures go in
// through Details, and the answer appears on the home as money goes in.
await check('04 home is the simple home, asking the question', async () => (await p.$('[data-simple-home]')) != null && /What could you take home/i.test(await h1()));
await check('05 one home: no dial, and no switch to one', async () => (await p.$('[data-home]')) == null && (await p.$('[data-home-switch]')) == null && !(await has('Dial view')));
await check('07 an empty plan says what to do', () => has('Add my details'));
await check('08 no sign-up gate before the result', async () => (await p.locator('input[type=email]').count()) === 0);
await tap('Add my details'); await wait(800);
await check('09 "Add my details" opens Details on who the plan is for', async () => (await sheetOpen()) && /^Who/.test(await pageTitle()));
await tapInSheet('A couple'); await wait(400);
await check('10 choosing a couple records a couple', async () => (await planOf()).household === 'couple');
await goPage('Someday');
await setField('Income you want each year', 42000);
await check('12 the income asked for writes the plan', async () => (await planOf()).targetNet === 42000);
{ const q = await planOf(); await setField('Retire in year', q.startYear + 6); }
await check('13 retire-in-year writes the year', async () => (await planOf()).retireYear === (await planOf()).startYear + 6);
await goPage('Your pots'); await setField('Workplace pension today', 300000);
await goPage('Their pots'); await setField('Workplace pension today', 120000);
await check('15 both pots captured', async () => { const q = await planOf(); return q.partnerA.pension === 300000 && q.partnerB.pension === 120000; });
await closeSheet(); await waitAnswer();
await check('16 with money in, the home gives the answer', async () => /£[\d,]+/.test(await answerText()) && /a month/.test(await answerText()));
await homeType('You pay in', 1500);
await check('16b tapping a figure on the home lets you type it', async () => (await planOf()).partnerA.monthlyPension === 1500);
await p.getByRole('button', { name: 'You pay in: £50 a month more' }).click(); await wait(400);
await check('16c the plus button is one step', async () => (await planOf()).partnerA.monthlyPension === 1550);
{ const before = (await planOf()).retireYear; await p.getByRole('button', { name: 'Stop work at: a year later' }).click(); await wait(400);
  await check('16d stop a year later moves the stop year by one', async () => (await planOf()).retireYear === before + 1); }
await waitAnswer();
await check('17 the home counts the futures, naming the amount and the age', async () => /^In \d+ of 100 futures, £[\d,]+ a month lasts to \d+\./.test(await futuresText()));
// The home leads with where the plan stands, in words, and the numbers behind
// it (audit §5B): what the plan can support a month, the gap to the ask, the
// age it is tested through.
await check('17a the home states where the plan stands in words, not a colour', async () => /^(On track under these assumptions|Enough in most futures, not all|Enough, with a trim to spending|Nearly enough|Not enough yet) In \d+ of 100 futures/.test(await answerText()));
await check('17a2 the home says what the plan can support, the age it is tested to and the gap to the ask', async () => { const t = await answerText(); const q = await planOf();
  return /£[\d,]+ a month after tax/.test(t) && t.includes(`lasts to ${q.horizonAge}`) && /£[\d,]+ (to spare|short)|Just what you ask/.test(t); });
await check('17a3 the caveat sits beside the headline figure', async () => /not a guarantee/.test(await futuresText()));
await check('17a4 the status never contradicts the central case', async () => {
  const q = await planOf(); const dd = E.drawdown({ ...q, growth: q.growthBase }); const key = await statusKey();
  // "On track" or "Enough on average" only when the central case pays in full; "Nearly" or "Not enough" only when it runs short.
  return dd.holds ? !['close', 'not'].includes(key) : ['close', 'not'].includes(key); });
// "What could go wrong": the layered risk panel (audit §5C), one tap from home.
await p.getByRole('button', { name: 'What could go wrong?' }).click(); await wait(600);
await p.waitForFunction(() => document.querySelectorAll('[role=dialog][aria-label="What could go wrong"] [data-risk]').length >= 6, null, { timeout: 20000 }).catch(() => {});
{
  const risk = p.locator('[role=dialog][aria-label="What could go wrong"]');
  await check('17b what could go wrong: central case, a poor run, three real histories and the futures', async () => (await risk.locator('[data-risk]').count()) === 6);
  await check('17b2 the hardest real history is named and explained in one sentence', async () => /Japan from 1990/.test(await risk.innerText()) && /Two lost decades/.test(await risk.innerText()));
  await check('17b3 each case is a limit in pounds a month, with what it would take to see it through', async () => /£[\d,]+/.test(await risk.locator('[data-risk="japan"]').innerText()) && /would see it through|would still be paid/.test(await risk.locator('[data-risk="japan"]').innerText()));
  await check('17b4 the unluckiest 1 in 10 is stated as an age', async () => /unluckiest 1 in 10/.test(await risk.locator('[data-risk="futures"]').innerText()));
  await check('17b5 scenarios, not predictions', async () => /Scenarios, not predictions/.test(await risk.innerText()));
  await check('17b6 the central case agrees with the engine to the nearest ten pounds', async () => {
    const q = await planOf(); const txt = await risk.locator('[data-risk="base"]').innerText(); const shown = Number((txt.match(/£([\d,]+)/) || [])[1]?.replace(/,/g, ''));
    // The most a year that still holds, by bisection, as the insight does.
    let lo = 2000, hi = Math.max(250000, q.targetNet * 3);
    for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; const Q = { ...q, spendingPlanOn: false, targetNet: mid, growth: q.growthBase }; const acc = E.accumulate(Q, Q.growth); if (E.drawdown(Q, { growth: Q.growth, startPots: acc.atRetirement }).holds) lo = mid; else hi = mid; }
    return Math.abs(shown - Math.round(Math.floor(lo / 100) * 100 / 12 / 10) * 10) <= 10; });
}
await p.getByRole('button', { name: 'Close' }).click(); await wait(400);
await p.getByRole('button', { name: 'What would help?' }).click();
await p.waitForFunction(() => /\+\d+ of 100|Nothing measured/.test(document.querySelector('[role=dialog][aria-label="What would help most"]')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
await check('17f what would help: each action measured', async () => /\+\d+ of 100|Nothing measured/.test(await p.locator('[role=dialog][aria-label="What would help most"]').innerText()));
await p.getByRole('button', { name: 'Close' }).click(); await wait(400);
await check('18 the figures are saved on the plan', async () => (await planOf()).partnerA.pension === 300000 && (await planOf()).partnerA.monthlyPension === 1550);
await check('19 bottom tab bar visible', () => has('Horizon'));
await check('20 setup completed without a separate form', () => true);

await loadEx();
await check('21 example loads Robin & Jo', async () => (await planOf()).partnerA?.name === 'Robin');
await waitAnswer();
await check('22 example shows an answer', async () => /£[\d,]+ a month after tax/.test(await answerText()));
await check('23 the count of futures shown', async () => /^In \d+ of 100 futures/.test(await futuresText()));

let k = 24;
for (const [t, m] of [['Details', 'Your details'], ['Explore', 'Explore'], ['Peace', 'Peace of mind']]) {
  await closeSheet(); await tap(t); await wait(600);
  await check(`${k++} ${t} tab opens sheet`, () => has(m));
  await closeSheet();
  await check(`${k++} ${t} sheet closes on Escape`, async () => !(await sheetOpen()));
}

// The deeper views live in Explore.
await closeSheet(); await tap('Explore'); await wait(900);
await p.waitForFunction(() => /Japan, 1990 on/.test(document.getElementById('explore-fall')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
await check('29d guardrails from real bad histories, in Explore', async () => /Japan, 1990 on/.test(await p.locator('#explore-fall').innerText()));
await check('29e the edge: every retirement, in Explore', () => has('Every retirement you could choose'));
await closeSheet();
// The time tunnel: at rest it says how short the bad futures are; tap a
// depth, swipe, or use the keys to travel to any age.
await p.waitForFunction(() => document.querySelector('[data-tunnel]')?.getAttribute('data-ready') === '1', null, { timeout: 20000 }).catch(() => {}); await wait(800);
{
  const st = await sunState(); const q = await planOf(); const m = E.runMonteCarlo(q, 2000, q.mcSeed || 42);
  const still = (i) => Math.round(m.perAgeHeld[i].full * 100), ask = gbp(q.targetNet / 12);
  const firstShort = m.perAgeHeld.find(h => Math.round(h.full * 100) < 100)?.age ?? null;
  await check('30 at rest the tunnel reads the first shortfall and how far the worst 10 of 100 dip, from the engine', () => st && st.age === null && st.firstShort === firstShort && st.label === restingLine(q, m, firstShort));
  const box = await p.locator('[data-tunnel] [role=slider]').boundingBox(); const i3 = Math.floor(st.n / 2);
  await p.mouse.click(box.x + box.width / 2, box.y + st.horizon + (box.height - st.horizon) * roadS((i3 + 0.5) / st.n)); await wait(300);
  const touched = await sunState();
  await check('31 tapping the tunnel floor halfway along travels to that age and reads it, from the engine', () => touched.age === st.first + i3 && touched.label === `At ${touched.age}: ${still(i3)} of 100 futures still pay ${ask} a month in full.`);
  await p.locator('[data-tunnel] [role=slider]').focus(); await p.keyboard.press('Home'); await wait(150);
  const home = await sunState(); await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowRight'); await wait(150);
  const two = await sunState();
  await check('31b the keys work it too: Home is the year work stops, each arrow is one year', () => home.age === home.first && two.age === home.first + 2 && two.valuetext === `Age ${two.age}: ${still(2)} of 100 futures still pay ${ask} a month in full`);
  await p.keyboard.press('Escape'); await wait(150);
  await check('31c Escape puts the reading back to rest', async () => { const b = await sunState(); return b.age === null && b.label === st.label; });
}
await check('32 exactly one visible h1', async () => (await visH1()) === 1);
const before = await answerText(); await homeType('Take home', 9000); await waitAnswer();
await check('33 take-home changes the answer', async () => (await answerText()) !== before && (await planOf()).targetNet === 108000);
{ const q = await planOf(); await homeType('Stop work at', q.startYear + 2 - q.partnerA.birthYear); } await wait(400);
await check('34 stop age, no crash', async () => pe.length === 0 && (await planOf()).retireYear === (await planOf()).startYear + 2);
await homeType('You pay in', 4000);
await check('35 paying in reads back in plain English', async () => (await p.getByRole('button', { name: /^You pay in: £4,000\. Tap to type/ }).count()) === 1);

await loadEx(); await tap('Details'); await wait(800);
// Editing is the same carousel: a rail of named pages, one idea on each.
await check('36 details opens the carousel on page one', async () => /^Who/.test(await pageTitle()) && /1 \/ \d/.test(await bodyT()));
await check('36b the rail names the pages', async () => (await has('Someday')) && (await has('Drawing')) && (await has('The lens')));
// Off-screen pages must be genuinely inert. They were not: React 19 reads
// inert="" as false, so it was silently dropped and Tab could land on a page
// you could not see. The production build does not log that warning.
await check('36c off-screen pages are genuinely inert', async () => {
  const total = await p.locator('[data-pane]').count();
  return total > 1 && (await p.locator('[data-pane][inert]').count()) === total - 1;
});
// Committing a figure must keep focus where it was. It did not: an edit
// re-rendered the app, the sheet's open/close effect re-ran on a fresh
// onClose, and its teardown threw focus out to the tab bar behind the sheet.
const surv = p.locator('[data-active] label:has-text("Survivor spends") input');
await surv.fill('80'); await p.keyboard.press('Tab'); await wait(700);
// (Merely "focus is somewhere in the sheet" is not enough: the broken sheet
// re-focused its own panel 30ms after throwing focus out, so that passed.)
await check('36d committing a figure, Tab lands on the next field', async () =>
  p.evaluate(() => /Your name/.test(document.activeElement?.closest('label')?.textContent || '')));
await surv.fill('75'); await surv.blur(); await wait(500);
await goPage('Someday');
await check('37 retire-in-year field', () => onPage('Retire in year'));
// Retirement Living Standards (Pensions UK) sit beside the income question as
// tappable reference points; one tap writes that standard into the plan.
await check('37b living standards shown beside the target', async () => (await onPage('Retirement Living Standards')) && (await onPage('living standard')));
{
  const was = (await planOf()).targetNet;
  const want = (await planOf()).household === 'single' ? 45400 : 62700;
  await p.locator('[data-active]').getByRole('button', { name: /^Comfortable/ }).first().click({ timeout: 4000 }).catch(() => {});
  await wait(500);
  await check('37c tapping Comfortable writes that standard into the plan', async () => (await planOf()).targetNet === want);
  await check('37d the chosen standard reads as pressed', async () => (await p.locator('[data-active] [aria-pressed="true"]:has-text("Comfortable")').count()) === 1);
  await setField('Income you want each year', was); await wait(300);
  await check('37e typing a figure restores the target', async () => (await planOf()).targetNet === was);
}
await goPage('Drawing');
await check('38 tax-free-cash options', () => onPage('Take none'));
await tapInSheet('A little each year'); await wait(400); await check('39 phased tax-free, no crash', () => pe.length === 0);
await tapInSheet('All at once'); await wait(400); await check('40 upfront tax-free, no crash', () => pe.length === 0);
await check('41 withdrawal-order options', async () => (await onPage('Pensions')) && (await onPage('Allowances')));
await tapInSheet('ISAs'); await wait(400); await check('42 strategy switch, no crash', () => pe.length === 0);
await goPage('Tax');
await check('38b income-tax region choice (Scotland)', () => onPage('Scotland'));
await goPage('Robin’s pots');
await check('43 partner names present', async () => /Robin|Jo/.test(await bodyT()));
await check('44 pension pot field', () => onPage('Workplace pension'));
await check('44b advanced-mode toggle present', () => onPage('Advanced'));
await goPage('Robin’s guaranteed income');
await check('45 State Pension fields present', () => onPage('State Pension age'));
await check('44c public-sector scheme pension can be added', () => onPage('Add an NHS'));
await goPage('Spending');
await check('46 spending step-down toggle', () => onPage('Ease spending from'));
// Prove the control both ways: on reveals its figures, off puts them away.
const easeSwitch = () => p.locator('[role=dialog] [role=switch]:has-text("Ease spending")').first();
if (!(await planOf()).phase1On) { await easeSwitch().click().catch(() => {}); await wait(600); }
await check('47 step-down on reveals its figures', async () => (await planOf()).phase1On === true && (await onPage('Spend less by')));
await easeSwitch().click().catch(() => {}); await wait(600);
await check('47b step-down off puts them away', async () => (await planOf()).phase1On === false);
await easeSwitch().click().catch(() => {}); await wait(600);
await goPage('The lens');
await check('48 lens inflation field', () => onPage('Inflation'));
await goPage('Life events');
await check('49 inheritance toggle', () => onPage('Expect an inheritance'));
await check('50 add-a-cost button', () => onPage('Add a cost'));
await tapInSheet('Add a cost'); await wait(500);
await check('51 adding a cost creates an event row', async () => (await p.locator('[data-active] input').evaluateAll(els => els.some(e => e.value === 'One-off cost'))));
await tapInSheet('Add a windfall'); await wait(500);
await check('52 adding a windfall creates a row', async () => (await p.locator('[data-active] input').evaluateAll(els => els.some(e => e.value === 'Windfall'))));
await check('53 events section stable', () => pe.length === 0);
await closeSheet();
await check('54 headline valid after edits', async () => (await h1()).length > 5);
await check('55 no £NaN after edits', async () => !/£NaN/.test(await bodyT()));

await tap('Explore'); await wait(800);
// The decision map: every (stop year × spending) retirement, and the dot is your plan.
await p.waitForSelector('#explore-map canvas', { timeout: 8000 }).catch(() => {});
await wait(1500);
await check('55a decision map shown first in Explore', () => has('Every retirement you could choose'));
await check('55b map states the edge for your stop year', async () => /the most you can spend for each year you might stop/.test(await bodyT()));
{
  const before = await p.evaluate(() => JSON.parse(localStorage.getItem('horizon-plan-v1')));
  const c = await p.locator('#explore-map canvas').boundingBox();
  await p.mouse.click(c.x + c.width * 0.75, c.y + c.height * 0.3); await wait(900);
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem('horizon-plan-v1')));
  await check('55c dragging the map changes the plan', () => after.retireYear !== before.retireYear || after.targetNet !== before.targetNet);
}
// The map as a table: words, not colour, operable without a mouse (audit F-05).
await tap('Show as a table'); await wait(500);
await check('55d map as a table: one row per stop year, the plan\'s row marked', async () => { const t = await p.$eval('[data-map-table]', e => e.innerText).catch(() => ''); return /\(you\)/.test(t) && /Stop in/.test(t); });
await check('55e map as a table: every cell is a sentence (lasts / short at)', async () => { const t = await p.$eval('[data-map-table]', e => e.innerText).catch(() => ''); return /lasts/.test(t) && (/short at \d+/.test(t) || /lasts/.test(t)); });
await check('55f map as a table: the table region takes keyboard focus', async () => (await p.$eval('[data-map-table]', e => e.tabIndex)) === 0);
await tap('Show as a map'); await wait(400);
await check('55g back to the map: the canvas is shown again', async () => (await p.$eval('#explore-map canvas', e => getComputedStyle(e.parentElement).display)) !== 'none');
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
// The bad tail in plain words, and what the sampling range does not cover (audit F-04).
await check('65b futures: the unluckiest 1 in 10 is stated in pounds-and-age terms', async () => /unluckiest 1 in 10 futures/.test(await p.$eval('[data-tail]', e => e.innerText).catch(() => '')));
await check('65c futures: the range is named as sampling error only, not assumption risk', async () => /sampling error on [\d,]+ paths only/.test(await p.$eval('[data-tail]', e => e.innerText).catch(() => '')));
await closeSheet();

await tap('Peace'); await wait(600);
await check('66 privacy card', () => has('Private by design'));
await check('67 one-possible-future card', () => has('One possible future'));
await check('68 not-advice card', () => has('Not financial advice'));
await check('69 UK-aware card', () => has('UK-aware'));
await check('69b assumptions list generated', async () => { await tap('Every assumption behind your numbers'); await wait(400); return (await has('Range of futures')) && (await has('Couples')); });
await check('69c assumptions: the four layers of uncertainty and the versions are stated', async () => (await has('What the confidence covers')) && /Engine \d{4}\.\d{2}\.\d{2} · plan schema \d+ · tax rules 20\d\d\/\d\d/.test(await bodyT()));
await check('69d how we checked: the engine checks itself live and reports the count', async () => { await tap('How we checked these numbers'); await wait(600); return /(\d+) of \1 engine checks pass on this device/.test(await p.$eval('[data-how-we-checked]', e => e.innerText).catch(() => '')); });
await check('69e how we checked: every rule names a source', async () => (await p.locator('[data-how-we-checked] a:has-text("Source")').count()) >= 10);
await check('69f how we checked: no link leaves except to the published sources and the repository', async () => (await p.$$eval('[data-how-we-checked] a', as => as.every(a => /^https:\/\/(www\.gov\.uk|www\.gov\.scot|www\.handbook\.fca\.org\.uk|www\.ons\.gov\.uk|www\.retirementlivingstandards\.org\.uk|github\.com\/stumacmar)\//.test(a.href)))));
await check('70 Save-report PDF button', () => has('Save the full report'));
await check('71 story link → story.html', async () => (await p.$eval('a[href="story.html"]', e => e.getAttribute('href'))) === 'story.html');
await check('72 no classic-planner link (one product, one app)', async () => (await p.$('a[href="app.html"]')) == null);
await closeSheet();

await homeType('Take home', 15000); await wait(700);
await check('73 extreme spend renders, no crash', async () => (await h1()).length > 1 && pe.length === 0);
await check('74 no NaN at extreme spend', async () => !/NaN|undefined/.test(await bodyT()));
await homeType('Take home', 900); await waitAnswer(); await check('75 minimal spend renders', async () => /£[\d,]+ a month/.test(await answerText()));
{ const q = await planOf(); await homeType('Stop work at', q.startYear + 1 - q.partnerA.birthYear); } await wait(600); await check('76 near-term retire, no crash', () => pe.length === 0);
{ const q = await planOf(); await homeType('Stop work at', q.startYear + 20 - q.partnerA.birthYear); } await wait(600); await check('77 far-out retire, no crash', () => pe.length === 0);
await tap('Details'); await wait(700); await goPage('Robin’s pots');
await p.$$eval('[role=dialog] input[inputmode=decimal]', e => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; e.forEach(el => { s.call(el, '0'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('blur', { bubbles: true })); }); }).catch(() => {}); await wait(700);
await check('78 all pots zero survives', () => pe.length === 0);
await check('79 no £NaN with zero pots', async () => !/£NaN/.test(await bodyT()));
await closeSheet();
await check('80 home renders after zero pots', async () => /£[\d,]+|take home/i.test(await h1()) && pe.length === 0);

await loadEx(); await p.reload({ waitUntil: 'networkidle' }); await wait(800);
await check('81 reload keeps plan (no onboarding)', async () => !/Begin/.test(await bodyT()));
await check('82 reload renders an answer', async () => (await h1()).length > 5);

await closeSheet();
for (let i = 0; i < 12; i++) await p.getByRole('button', { name: i % 3 ? 'Take home: £100 a month more' : 'Take home: £100 a month less' }).click();
await wait(700);
await check('83 rapid stepper taps, no crash', () => pe.length === 0);
// A tap re-renders the whole app; nothing slow may sit on that path. (The
// report once ran the engine's 134 self-checks on every render, a quarter of
// a second each: ten turns of the old dial took three seconds.)
{
  const ms = await p.evaluate(async () => {
    const btn = [...document.querySelectorAll('[data-simple-home] button')].find(b => b.getAttribute('aria-label') === 'Take home: £100 a month more');
    if (!btn) return 99999;
    const t0 = performance.now();
    for (let i = 0; i < 10; i++) { btn.click(); await new Promise(r => requestAnimationFrame(() => r())); }
    return performance.now() - t0;
  });
  await check(`83b ten taps of a stepper render in under 1.5 seconds (took ${Math.round(ms)} ms)`, () => ms < 1500);
}
for (let i = 0; i < 8; i++) await p.getByRole('button', { name: i % 2 ? 'Stop work at: a year earlier' : 'Stop work at: a year later' }).click();
await wait(900);
await check('84 rapid stop-age changes, no crash', () => pe.length === 0);
for (let i = 0; i < 5; i++) { await tap('Details'); await wait(200); await closeSheet(); }
await check('85 rapid sheet cycle, no crash', () => pe.length === 0);
await closeSheet(); await wait(700); // let the debounced compute settle before reading the headline
await check('86 headline valid after stress', async () => /£[\d,]+|take home/i.test(await h1()));

await loadEx();
await waitAnswer();
await check('87 the example shows its answer on the home', async () => /£[\d,]+ a month after tax/.test(await answerText()));
await check('88 the example is a couple, and the home says it counts both', async () => (await planOf()).household === 'couple' && /^Counts Robin and Jo:/.test(await p.$eval('[data-counts]', e => e.innerText)));
await check('89 the home points to Details for everything else', () => has('Check or change in Details'));
await check('90 exactly three things to change on the home', async () => (await p.locator('[data-simple-home] [data-driver]').count()) === 3);
await check('91 four tab destinations', async () => (await has('Horizon')) && (await has('Details')) && (await has('Explore')) && (await has('Peace')));
await tap('Details'); await wait(500);
await check('92 sheet opens (dialog role)', () => sheetOpen());
await check('93 £ prefix in fields', async () => /£/.test(await bodyT()));
await goPage('Drawing'); await check('94 drawing page reachable from the rail', () => onPage('Which pot first'));
await goPage('Spending'); await check('95 spending page reachable from the rail', () => onPage('Ease spending from'));
await goPage('Plan file'); await check('95b plan file: says where the plan is kept and when it was saved (audit F-06)', async () => /Saved on this device/.test(await p.$eval('[data-save-status]', e => e.innerText).catch(() => '')));
await closeSheet();
await tap('Peace'); await wait(500); await p.mouse.click(195, 25); await wait(500);
await check('96 sheet closes on backdrop tap', async () => !(await sheetOpen()));
await check('97 no NaN/undefined leaking to UI', async () => !/\bNaN\b|\bundefined\b/.test(await bodyT()));
await check('98 no £NaN anywhere', async () => !/£NaN/.test(await p.content()));
await check('99 zero console errors overall', () => ce.length === 0);
await check('100 zero uncaught page errors overall', () => pe.length === 0);

// ── Accessibility gate: axe-core (WCAG 2.2 AA) on the four surfaces ───────
// Zero critical or serious violations is the release gate; moderate and
// minor are printed so they are seen, never hidden.
const AXE = path.join(__dir, 'node_modules', 'axe-core', 'axe.min.js');
const axeScan = async (label) => {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ path: AXE });
  const r = await p.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return res.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length,
      nodes: v.nodes.slice(0, 3).map(n => `${n.target.join(' ')} «${n.html.slice(0, 90)}» ${[...n.any, ...n.all].map(x => x.message).join(' | ')}`) }));
  });
  const bad = r.filter(v => v.impact === 'critical' || v.impact === 'serious');
  const rest = r.filter(v => v.impact !== 'critical' && v.impact !== 'serious');
  if (rest.length) console.log(`  axe ${label}: ${rest.map(v => `${v.impact} ${v.id}×${v.n}`).join(', ')}`);
  return { bad, detail: bad.map(v => `${v.impact} ${v.id}×${v.n}: ${v.nodes.join(' ‖ ')}`).join('; ') };
};
{
  const home = await axeScan('Home');
  await check(`100a axe: Home has no critical or serious WCAG 2.2 AA violations${home.bad.length ? ' — ' + home.detail : ''}`, () => home.bad.length === 0);
  await tap('Details'); await wait(900);
  const det = await axeScan('Details');
  await check(`100b axe: Details has no critical or serious violations${det.bad.length ? ' — ' + det.detail : ''}`, () => det.bad.length === 0);
  await closeSheet();
  await tap('Explore'); await p.waitForSelector('#explore-map canvas', { timeout: 8000 }).catch(() => {}); await wait(1500);
  const exp = await axeScan('Explore');
  await check(`100c axe: Explore has no critical or serious violations${exp.bad.length ? ' — ' + exp.detail : ''}`, () => exp.bad.length === 0);
  await closeSheet();
  await tap('Peace'); await wait(600);
  await tap('Every assumption behind your numbers'); await tap('How we checked these numbers'); await wait(600);
  const pea = await axeScan('Peace');
  await check(`100d axe: Peace (with Assumptions and How we checked open) has no critical or serious violations${pea.bad.length ? ' — ' + pea.detail : ''}`, () => pea.bad.length === 0);
  await closeSheet();
  await check('100e the page can be zoomed (no maximum-scale on the viewport)', async () => !/maximum-scale/.test(await p.$eval('meta[name=viewport]', e => e.getAttribute('content'))));
}

// ── Free tier: the answer stays whole, depth is locked honestly ──────────
await p.evaluate(() => localStorage.removeItem('someday-licence-v1')).catch(() => {});
await p.reload({ waitUntil: 'networkidle' }); await wait(900);
await check('101 free: disclaimer not asked again', async () => !/calm place to think/i.test(await h1()));
await waitAnswer();
await check('102 free: the answer still renders', async () => /£[\d,]+ a month/.test(await answerText()));
await check('103 free: the count of futures still shown', async () => /^In \d+ of 100 futures/.test(await futuresText()));
// Plus can be switched off entirely (PRODUCT.plusOffered). Then nothing is
// locked, nothing sells, and the word "Plus" appears nowhere.
const plusOffered = !!(await $('button[aria-label="Get Someday Plus"]'));
if (!plusOffered) {
  await check('104 plus off: no pill in the header', async () => !(await $('button[aria-label="Get Someday Plus"]')) && !(await $('button[aria-label="Someday Plus — active"]')));
  await tap('Explore'); await wait(900);
  await check('105 plus off: Monte Carlo shown', () => has('Range of futures'));
  await check('106 plus off: lifetime-tax card shown', () => has('Lifetime income tax'));
  await check('107 plus off: nothing locked in Explore', async () => !(await has('See what Plus adds')));
  await check('108 plus off: withdrawal order unlocked', () => has('lowest lifetime tax'));
  await check('109 plus off: the word Plus appears nowhere in Explore', async () => !/\bPlus\b/.test(await bodyT()));
  await closeSheet();
  await tap('Details'); await wait(700); await goPage('Robin’s pots');
  await check('114 plus off: advanced detail unlocked', async () => (await p.locator('[role=switch]:has-text("Advanced")').count()) === 1);
  await goPage('Structure');
  await check('115 plus off: structure page unlocked', async () => !(await has('See what Plus adds')));
  await closeSheet();
  await tap('Peace'); await wait(500);
  await check('116 plus off: no Plus card, no "· Plus" on the report button', async () => !/· Plus|Someday Plus/.test(await bodyT()));
  await check('117 plus off: print report rendered without a licence', async () => (await p.$('#print-summary')) != null);
  await check('118 plus off: the word Plus appears nowhere on Peace', async () => !/\bPlus\b/.test(await bodyT()));
  await closeSheet();
  await check('119 plus off: no request ever left the device', () => requests.length === 0);
  await check('120 plus-off sweep: zero page errors', () => pe.length === 0);
} else {
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
await tap('Details'); await wait(700); await goPage('Robin’s pots');
await check('114 free: advanced detail locked', async () => (await onPage('Advanced detail')) && (await p.locator('[role=switch]:has-text("Advanced")').count()) === 0);
await goPage('Structure');
await check('115 free: structure page locked', async () => (await onPage('Plan structure')) && !(await onPage('Set up the standard architecture')));
await closeSheet();
await tap('Peace'); await wait(500);
await check('116 free: report button routes to Plus', async () => { await tap('Save the full report'); await wait(600); return has('Already have a licence key?'); });
await check('117 free: print report not rendered', async () => (await p.$('#print-summary')) == null);
await closeSheet();
await seedPlus(); await p.reload({ waitUntil: 'networkidle' }); await wait(900);
await check('118 plus: pill shows active', () => $('button[aria-label="Someday Plus — active"]'));
await check('119 plus: print report rendered', async () => (await p.$('#print-summary')) != null);
await check('120 free/plus sweep: zero page errors', () => pe.length === 0);
}

// The age the canvas's needle rests on: the first at which fewer than 100 of
// 100 futures are still paid in full, read from the engine for the same seed.
const firstShortAge = (q) => E.runMonteCarlo(q, 2000, q.mcSeed || 42).perAgeHeld.find(h => Math.round(h.full * 100) < 100)?.age;
const openMap = async () => { await closeSheet(); await tap('Explore'); await wait(900); await p.waitForSelector('#explore-map canvas', { timeout: 8000 }).catch(() => {}); await wait(2500); };

// ── Unpaid years read as "runs short" ────────────────────────────────────
// A 41-year-old who stops at 42 on £70,000 a year with the pension locked
// until 57 and £72,000 of ISA and cash. The pot never "exhausts" because it
// cannot be touched, so the home, the map and the floor must look at unpaid
// years, not only at empty pots. (Seen on the live site, 13 November 2026.)
{
  const F = E.freshStart();
  const Y = E.sanitisePlan({ ...F, retireYear: 2027, targetNet: 70000, cash: 24000, approach: 'traditional',
    partnerA: { ...F.partnerA, birthYear: 1985, spAmount: 12548, pension: 570000, monthlyPension: 3200, isa: 48000 },
    partnerB: { ...F.partnerB, birthYear: 1985 } });
  await fresh();
  await p.evaluate(v => localStorage.setItem('horizon-plan-v1', v), JSON.stringify(Y));
  await p.reload({ waitUntil: 'networkidle' }); await wait(900); await acceptDisclaimer(); await waitAnswer(); await wait(2400);
  // The central case runs short at 43; in a fifth of futures a bad first
  // year empties the ISA and cash at 42. No future reaches 90.
  await check('121 unpaid years: "not enough", the first shortfalls at 42, and no future still paying at 90', async () => { const st = await sunState(); const q = await planOf();
    return ['not', 'close'].includes(await statusKey()) && E.drawdown({ ...q, growth: q.growthBase }).runsShortAgeA === 43 && firstShortAge(q) === 42
      && st.firstShort === 42 && st.counts[st.counts.length - 1] === 0 && st.label.startsWith('From 42, some futures fall short.'); });
  await openMap();
  await check('122 unpaid years: the map says it runs short', () => has('it runs short'));
  await check('123 unpaid years: zero page errors', () => pe.length === 0);
}

// ── A 26-year-old: the stop age must reach 75, and 46 must read as short ──
{
  const F = E.freshStart();
  const Y = E.sanitisePlan({ ...F, retireYear: 2046, targetNet: 60000, cash: 24000, approach: 'traditional',
    partnerA: { ...F.partnerA, birthYear: 2000, spAmount: 12548, pension: 570000, monthlyPension: 3200, isa: 48000 },
    partnerB: { ...F.partnerB, birthYear: 2000 } });
  await fresh();
  await p.evaluate(v => localStorage.setItem('horizon-plan-v1', v), JSON.stringify(Y));
  await p.reload({ waitUntil: 'networkidle' }); await wait(900); await acceptDisclaimer(); await waitAnswer(); await wait(2400);
  await homeType('Stop work at', 90); await wait(600);
  await check('124 young planner: the stop age goes as far as 75, and no further', async () => (await planOf()).retireYear === 2075);
  await homeType('Stop work at', 46); await waitAnswer(); await wait(2400);
  await check('125 young planner: stopping at 46, the first shortfalls come at once, and almost nothing is left by 50', async () => { const q = await planOf(); const a = firstShortAge(q); const st = await sunState();
    return a === 46 && st.firstShort === 46 && st.counts[4] <= 2 && E.drawdown({ ...q, growth: q.growthBase }).runsShortAgeA <= 49; });
  await check('126 young planner: the futures agree (fewer than 5 in 100 hold)', async () => /^In [0-4] of 100 futures/.test(await futuresText()));
  await homeType('Stop work at', 60); await wait(1500);
  await check('128 young planner: typing 60 moves the stop age to 60', async () => (await planOf()).retireYear === 2060);
  await openMap();
  await check('130 young planner: the map runs to age 75 (2075)', () => has('2075'));
  await check('131 young planner: zero page errors', () => pe.length === 0);
  await closeSheet();

  // ── The age to plan for says what it means ───────────────────────────
  // A 26-year-old couple planning to 90: Details shows the odds under the
  // plan age, read from the same mortality curve that weights the futures.
  await tap('Details'); await wait(700); await goPage('Someday');
  await check('138 plan-to-age shows the odds (half of people … live past …)', () => onPage('live past'));
  await check('139 … and the chance one of the couple is here at the plan age', async () => /at least one of you is still here at 90 is about \d+%/.test(await p.locator('[data-active]').innerText()));
  await check('140 the odds agree with the engine', async () => { const o = E.lifeOdds(await planOf()); const t = await p.locator('[data-active]').innerText();
    return t.includes(`live past ${o.a.median}`) && t.includes(`about ${Math.round(o.either * 100)}%`); });
  await check('141 longevity: zero page errors', () => pe.length === 0);
  await closeSheet();
}

// ── The home: the canvas, the answer, three steppers, two questions ──
{
  const F = E.freshStart();
  const Y = E.sanitisePlan({ ...F, approach: 'traditional', retireYear: 2030, targetNet: 60000,
    partnerA: { ...F.partnerA, birthYear: 1970, spAmount: 12548, pension: 570000, monthlyPension: 3200, isa: 48000 },
    partnerB: { ...F.partnerB, birthYear: 1970 } });
  await fresh();
  await p.evaluate(v => localStorage.setItem('horizon-plan-v1', v), JSON.stringify(Y));
  await p.reload({ waitUntil: 'networkidle' }); await wait(900); await acceptDisclaimer();
  await p.waitForFunction(() => document.querySelector('[data-gap]') && /of 100/.test(document.querySelector('[data-futures]')?.textContent || ''), null, { timeout: 25000 }).catch(() => {});
  const answer = async () => (await p.$eval('[data-simple-home] [data-answer]', e => e.innerText).catch(() => '')).replace(/\s+/g, ' ');
  const cap = (q) => { let lo = 2000, hi = Math.max(250000, q.targetNet * 3);
    for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; const Q = { ...q, spendingPlanOn: false, targetNet: mid, growth: q.growthBase }; const acc = E.accumulate(Q, Q.growth); if (E.drawdown(Q, { growth: Q.growth, startPots: acc.atRetirement }).holds) lo = mid; else hi = mid; }
    return Math.round(Math.floor(lo / 100) * 100 / 12 / 10) * 10; };
  await check('142 the home is the simple one (no ring to learn)', async () => (await p.$('[data-simple-home]')) != null && (await p.$('[data-home]')) == null);
  await check('143 it leads with where the plan stands, in words', async () => /^(On track under these assumptions|Enough in most futures, not all|Enough, with a trim to spending|Nearly enough|Not enough yet) In \d+ of 100 futures/.test(await answer()));
  await check('144 the big figure is what the plan can support a month, and agrees with the engine', async () => {
    const shown = Number((await p.$eval('[data-supports]', e => e.textContent)).replace(/[£,]/g, '')); return Math.abs(shown - cap(await planOf())) <= 10; });
  await check('145 the gap sits under the figure, and the sentence names what you ask', async () => /^(£[\d,]+ (to spare|short)|Just what you ask)$/.test((await p.$eval('[data-gap]', e => e.textContent)).trim()) && /£5,000 a month lasts to/.test(await answer()));
  await check('146 the futures count carries its caveat', async () => /^In \d+ of 100 futures, £5,000 a month lasts to \d+\. An estimate, not a guarantee\.$/.test(await futuresText()));
  await check('147 exactly three things to change', async () => (await p.locator('[data-simple-home] [data-driver]').count()) === 3);
  // The answer says what it is counting, so nobody has to wonder whether a partner is in.
  await check('147b the answer says who and what it counts, straight from the plan', async () => {
    const q = await planOf(); const t = (await p.$eval('[data-counts]', e => e.innerText)).replace(/\s+/g, ' ');
    const k = v => v >= 1e6 ? '£' + (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'm' : '£' + Math.round(v / 1e3) + 'k';
    return t.startsWith('Counts you and your partner: ') && t.includes(`${k(q.partnerA.pension + q.partnerB.pension)} in pensions`)
      && t.includes(`${k(q.partnerA.isa + q.partnerB.isa + (q.cash || 0))} in ISAs and cash`)
      && t.includes(`${k(q.partnerA.spAmount + q.partnerB.spAmount + q.partnerA.db + q.partnerB.db)} a year guaranteed`); });
  // Whether "paying in" includes tax relief changes the answer by a fifth of
  // every payment, so the home says which (Scout 2026-11-15).
  await check('147c the counts line says what goes into pensions, and that tax relief is included', async () =>
    (await p.$eval('[data-counts]', e => e.innerText.replace(/\s+/g, ' '))).includes('£3,200 a month going into pensions, tax relief included.'));
  await p.getByRole('button', { name: 'Stop work at: a year later' }).click(); await wait(500);
  await check('148 one tap: stop a year later', async () => (await planOf()).retireYear === 2031);
  await p.getByRole('button', { name: 'Take home: £100 a month less' }).click(); await wait(500);
  await check('149 one tap: take home £100 a month less', async () => (await planOf()).targetNet === 4900 * 12);
  await p.getByRole('button', { name: /^Take home: £4,900\. Tap to type/ }).click(); await wait(300);
  await p.fill('input[aria-label="Take home, type a figure"]', '4500'); await p.keyboard.press('Enter'); await wait(500);
  await check('150 or type the figure', async () => (await planOf()).targetNet === 54000);
  await p.getByRole('button', { name: 'You pay in: £50 a month more' }).click(); await wait(500);
  await check('151 one tap: pay in £50 a month more', async () => (await planOf()).partnerA.monthlyPension === 3250);
  await p.waitForFunction(() => /of 100/.test(document.querySelector('[data-futures]')?.textContent || ''), null, { timeout: 20000 }).catch(() => {}); await wait(1500);
  await check('152 the answer follows the change (figure still agrees with the engine)', async () => {
    const shown = Number((await p.$eval('[data-supports]', e => e.textContent)).replace(/[£,]/g, '')); return Math.abs(shown - cap(await planOf())) <= 10; });
  await p.getByRole('button', { name: 'What could go wrong?' }).click(); await wait(700);
  await p.waitForFunction(() => document.querySelectorAll('[data-risk-panel] [data-risk]').length >= 6, null, { timeout: 20000 }).catch(() => {});
  await check('153 what could go wrong: six cases, one tap from home', async () => (await p.locator('[data-risk-panel] [data-risk]').count()) === 6);
  await check('154 the sheet covers the tab bar, not the other way round', async () => p.evaluate(() => {
    const nav = document.querySelector('nav').getBoundingClientRect(); const el = document.elementFromPoint(nav.left + nav.width / 2, nav.top + nav.height / 2);
    return !!el && !el.closest('nav'); }));
  await closeSheet();
  const beforeHelp = JSON.stringify(await planOf());
  await p.getByRole('button', { name: 'What would help?' }).click();
  await p.waitForFunction(() => /\+\d+ of 100|Nothing measured/.test(document.querySelector('[data-help-panel]')?.textContent || ''), null, { timeout: 25000 }).catch(() => {});
  await check('155 what would help: each action measured', async () => /\+\d+ of 100|Nothing measured/.test(await p.$eval('[data-help-panel]', e => e.innerText)));
  if (await p.locator('[data-help-panel] button').count()) { await p.locator('[data-help-panel] button').first().click(); await wait(800); }
  await check('156 tapping an action applies it and returns home', async () => !(await sheetOpen()) && JSON.stringify(await planOf()) !== beforeHelp);
  {
    const ax = await axeScan('Simple home');
    await check(`157 axe: the simple home has no critical or serious WCAG 2.2 AA violations${ax.bad.length ? ' — ' + ax.detail : ''}`, () => ax.bad.length === 0);
  }
  await check('158 the two questions sit above the tab bar without scrolling', async () => p.evaluate(() => {
    const nav = document.querySelector('nav').getBoundingClientRect(); const b = [...document.querySelectorAll('[data-simple-home] button')].find(x => /What could go wrong/.test(x.textContent)).getBoundingClientRect();
    return b.bottom <= nav.top; }));
  // The time tunnel: a corridor from the stop age to the plan age; across
  // each year's stretch of floor, the bright lane's share of the floor's width
  // is the share of futures still paying in full. It is drawn from the same run as the
  // count in the sentence, so they cannot differ.
  await p.waitForFunction(() => document.querySelector('[data-tunnel]')?.getAttribute('data-ready') === '1' && /of 100/.test(document.querySelector('[data-futures]')?.textContent || ''), null, { timeout: 20000 }).catch(() => {}); await wait(800);
  const ring = async () => p.evaluate(() => { const el = document.querySelector('[data-tunnel]'); const sl = el.querySelector('[role=slider]');
    const pts = (k) => (el.querySelector(`[data-lane=${k}]`)?.getAttribute('points') || '').trim().split(/\s+/).filter(Boolean).map(q => q.split(',').map(Number));
    return { first: +el.getAttribute('data-first'), last: +el.getAttribute('data-last'), n: +el.getAttribute('data-years'), counts: el.getAttribute('data-full-counts').split(',').map(Number),
      road: pts('road'), wallL: (el.querySelector('[data-wall=l]')?.getAttribute('points') || '').trim().split(/\s+/).filter(Boolean).map(q => q.split(',').map(Number)), wallR: (el.querySelector('[data-wall=r]')?.getAttribute('points') || '').trim().split(/\s+/).filter(Boolean).map(q => q.split(',').map(Number)), keys: [el.querySelector('[data-wall=l]')?.getAttribute('data-tranche'), el.querySelector('[data-wall=r]')?.getAttribute('data-tranche')], vy: +el.getAttribute('data-horizon'), h: +(el.querySelector('svg')?.getAttribute('height') || 0), label: sl.getAttribute('aria-label'), summary: document.getElementById('tunnel-summary')?.textContent || '', futures: document.querySelector('[data-futures]')?.textContent || '' }; });
  await check('158d the tunnel has a count for every year from the year work stops to the plan age', async () => { const q = await planOf(), st = await ring();
    return st.counts.length === st.n && st.first === q.retireYear - q.partnerA.birthYear && st.n === E.planEndYear(q) - q.retireYear + 1 && st.last === st.first + st.n - 1; });
  await check('158e the tunnel ends on the futures count in the sentence', async () => { const st = await ring(); const n = Number((st.futures.match(/^In (\d+) of 100/) || [])[1]); return st.counts[st.n - 1] === n; });
  await check('158f the count never rises from one year to the next', async () => { const st = await ring(); return st.counts.every((c, i) => c >= 0 && c <= 100 && (i === 0 || c <= st.counts[i - 1])); });
  // The walls are the money: two tranches (a structured plan's safe ladder and growth engine, else pensions
  // and ISAs with cash), each filled from the floor up to its value that year in today's money, on one scale.
  const trancheVals = (q, rows, key, first, last) => { const by = new Map(rows.map(r => [r.ageA, r])); const out = [];
    for (let a = first; a <= last; a++) { const r = by.get(a); const v = !r ? 0 : key === 'ladder' ? r.ladder : key === 'engine' ? r.engine : key === 'pensions' ? r.potA + r.potB : r.isaA + r.isaB + r.cash + r.gia;
      out.push(r ? Math.max(0, v / Math.pow(1 + q.inflation, r.year - q.startYear)) : 0); } return out; };
  await check('158g each wall is filled to its tranche\'s value each year (today\'s money, from the engine), as a share of the frame', async () => { const q = await planOf(), st = await ring();
    const keys = q.architecture?.on ? ['ladder', 'engine'] : ['pensions', 'isas']; if (st.keys.join() !== keys.join()) return false;
    const rows = E.drawdown(q).rows; const vals = keys.map(k => trancheVals(q, rows, k, st.first, st.last)); const scale = Math.max(1, ...vals[0], ...vals[1]) * 1.06;
    return [st.wallL, st.wallR].every((pts, k) => { if (pts.length !== 2 * (st.n + 2)) return false; const base = pts.slice(0, st.n + 2), top = pts.slice(st.n + 2).reverse();
      return vals[k].every((v, i) => { const b = base[i + 1], t = top[i + 1]; const sc = (b[1] - st.vy) / (st.h - st.vy); return Math.abs((b[1] - t[1]) / (sc * st.h) - Math.min(1, v / scale)) < 0.01; }); }); });
  await check('158h the tunnel agrees with the engine for the same seed, year by year', async () => { const q = await planOf(), st = await ring(); const m = E.runMonteCarlo(q, 2000, q.mcSeed || 42);
    return m.perAgeHeld.every((h, i) => Math.round(h.full * 100) === st.counts[i]); });
  await check('158i the tunnel says in words what it shows (screen readers)', async () => { const st = await ring(); const q = await planOf(); const f = st.counts[st.n - 1];
    const typical = f < 100 ? E.runMonteCarlo(q, 2000, q.mcSeed || 42).perAgeHeld.find(h => Math.round(h.full * 100) <= (100 + f) / 2)?.age : null;
    return st.label === 'Futures still paying, by age' && st.summary.startsWith(`Stop at ${st.first} and take ${gbp(q.targetNet / 12)} a month. In ${f} of 100 futures it lasts to ${st.last}.${f < 100 ? ` In the other ${100 - f}, money first runs short at about ${typical}.` : ''}`); });
  await check('158j life hangs where it changes: travel towards the year the State Pension starts and its sign is there, from the engine', async () => {
    const q = await planOf(), rows = E.drawdown(q).rows; const st = await ring();
    const at = rows.find((r, i) => i > 0 && !(rows[i - 1].spA > 1) && r.spA > 1)?.ageA;
    if (at == null || at <= st.first || at > st.last) return true;
    await p.locator('[data-tunnel] [role=slider]').focus(); await p.keyboard.press('Home');
    for (let k = st.first; k < at - 2; k++) await p.keyboard.press('ArrowRight');
    await wait(700);
    const ok = await p.evaluate(a => [...document.querySelectorAll(`[data-tunnel] [data-event-age="${a}"]`)].some(e => /State Pension starts/.test(e.textContent)), at);
    await p.keyboard.press('Escape'); await wait(600); return ok; });
  await p.locator('[data-tranche-open]').first().click(); await wait(1200);
  await check('158k touching a tranche opens it: what it is, what it earns, and four markets drawn, from the engine', async () => { const q = await planOf(), st = await ring();
    const key = q.architecture?.on ? 'ladder' : 'pensions'; const el = await p.$(`[data-tranche-sheet="${key}"]`); if (!el) return false;
    const lines = await el.$$eval('[data-scenario]', ls => ls.map(l => l.getAttribute('data-scenario')).join());
    const base = trancheVals(q, E.drawdown({ ...q, growth: q.growthBase }).rows, key, st.first, st.last)[0];
    const k = v => v >= 1e6 ? '£' + (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'm' : v >= 1e3 ? '£' + Math.round(v / 1e3) + 'k' : '£' + Math.round(v);
    const at = await el.$eval(`[data-tranche-at="${st.first}"]`, e => e.textContent);
    return lines === 'positive,base,poor,gfc' && at === k(base) && /a year/.test(await el.innerText()); });
  await closeSheet();
  await p.locator('[data-counts] button').click(); await wait(700);
  await check('158b "Check or change in Details" opens Details', () => sheetOpen());
  await goPage('Your guaranteed income');
  await check('158c the guaranteed-income field says annuity', async () => /Annuity, company or final-salary pension a year/.test(await bodyT()));
  await goPage('Your pots');
  const reliefSwitch = p.locator('[data-active] [role=switch]:has-text("Paid from my bank account")');
  await check('158c2 the tax-relief choice sits right under the payment, not in a closed section', async () => (await reliefSwitch.count()) === 1 && (await reliefSwitch.isVisible())
    && /The total going in, tax relief included/.test(await p.locator('[data-active]').innerText()));
  const potsBefore = E.accumulate({ ...(await planOf()), growth: (await planOf()).growthBase }, (await planOf()).growthBase).atRetirement.pensionA;
  await reliefSwitch.click(); await wait(600);
  await check('158c3 switching it on adds 25% basic-rate relief: the plan records it and the field says what goes in', async () => { const q = await planOf();
    return q.partnerA.contribGrossUp === true && (await p.locator('[data-active]').innerText()).includes(`with basic-rate tax relief added, ${gbp(q.partnerA.monthlyPension * 1.25)} a month goes in`); });
  await check('158c4 and the pot on the day work stops is larger', async () => { const q = await planOf(); return E.accumulate({ ...q, growth: q.growthBase }, q.growthBase).atRetirement.pensionA > potsBefore; });
  await closeSheet();
  await check('158c5 the counts line says what you pay and what relief adds', async () => { const m = (await planOf()).partnerA.monthlyPension;
    return (await p.$eval('[data-counts]', e => e.innerText.replace(/\s+/g, ' '))).includes(`${gbp(m * 1.25)} a month going into pensions: ${gbp(m)} paid plus 25% basic-rate tax relief.`); });
  await tap('Details'); await wait(600); await goPage('Your pots');
  await p.locator('[data-active] [role=switch]:has-text("Paid from my bank account")').click(); await wait(500);
  await closeSheet();
  await closeSheet();
  await check('162 simple home: zero page errors', () => pe.length === 0);
}

console.log(`\n═══ Horizon UAT: ${pass}/${pass + fail} passed ═══`);
if (fails.length) console.log('\nFAILURES:\n' + fails.map(f => '  ' + f).join('\n'));
if (ce.length) console.log('\nCONSOLE ERRORS:\n' + [...new Set(ce)].slice(0, 10).map(e => '  • ' + e).join('\n'));
if (pe.length) console.log('\nPAGE ERRORS:\n' + [...new Set(pe)].slice(0, 10).map(e => '  • ' + e).join('\n'));

await b.close();
if (server) server.close();
// Gate: fail the process on any runtime error, or more than 2 assertion misses.
process.exitCode = (ce.length > 0 || pe.length > 0 || fail > 2) ? 1 : 0;
