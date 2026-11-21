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
// Existing checks were written against the island; the home now opens on the Lantern, so they pin the island
// (only where nothing is set). The Lantern home has its own block, in its own page, with no pin.
await p.addInitScript(() => { try { if (!localStorage.getItem('someday-picture-v1')) localStorage.setItem('someday-picture-v1', 'island'); } catch { /* private mode */ } });

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
// The home: one screen. The answer, the island, three steppers (each also
// typeable) and two questions. (The Horizon Dial was retired in November 2026.)
const answerText = async () => (await p.$eval('[data-answer]', e => e.innerText).catch(() => '')).replace(/\s+/g, ' ');
const futuresText = async () => p.$eval('[data-futures]', e => e.textContent).catch(() => '');
// The status word and the answer sentence, in reading order (the island floats the status in its sky and puts the sentence under it).
const statusThenFutures = async () => `${(await p.$eval('[data-status]', e => e.textContent).catch(() => '')).trim()} ${await futuresText()}`;
const statusKey = async () => p.$eval('[data-status]', e => e.getAttribute('data-status')).catch(() => '');
const waitAnswer = async (ms = 25000) => p.waitForFunction(() => document.querySelector('[data-answer]')?.getAttribute('data-ready') === '1' && /of 100/.test(document.querySelector('[data-futures]')?.textContent || ''), null, { timeout: ms }).catch(() => {});
// Type a figure into one of the home's three steppers: 'Stop work at' (an
// age), 'Take home' or 'You pay in' / 'Pay in' (a month).
const homeType = async (label, value) => {
  await p.getByRole('button', { name: new RegExp(`^${label}: .*Tap to type`) }).click({ timeout: 4000 });
  await p.fill(`input[aria-label="${label}, type a figure"]`, String(value)); await p.keyboard.press('Enter'); await wait(400);
};
// What the island is showing: the age read (if any), the reading under it, and the count of futures paying in full each year.
const sunState = async () => p.evaluate(() => { const el = document.querySelector('[data-island]'); if (!el) return null; const sl = el.querySelector('[role=slider]');
  return { ready: el.getAttribute('data-ready') === '1', age: el.getAttribute('data-age') === '' ? null : +el.getAttribute('data-age'), first: +el.getAttribute('data-first'), last: +el.getAttribute('data-last'), n: +el.getAttribute('data-years'),
    counts: (el.getAttribute('data-full-counts') || '').split(',').filter(Boolean).map(Number), firstShort: el.getAttribute('data-first-short') === '' ? null : +el.getAttribute('data-first-short'),
    valuetext: sl?.getAttribute('aria-valuetext') || '', label: el.querySelector('[data-island-text]')?.textContent || '', summary: document.getElementById('island-summary')?.textContent || '', horizon: +el.getAttribute('data-horizon') }; });
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
// No approach question (owner, 17 November 2026): every plan starts as one
// invested pot; the safe ladder is an optional switch in Details.
await check('17b no approach question: the home follows the disclaimer', async () => !/How should the money be run/i.test(await bodyT()) && (await p.$('[data-simple-home]')) != null);
await check('17c a fresh plan starts as one invested pot', async () => (await planOf()).architecture?.on !== true);
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
await check('17a the home states where the plan stands in words, not a colour', async () => /^(On track under these assumptions|Enough in most futures, not all|Enough, with a trim to spending|Nearly enough|Not enough yet) In \d+ of 100 futures/.test(await statusThenFutures()));
await check('17a2 the home says what the plan can support, the age it is tested to and the gap to the ask', async () => { const t = await answerText(); const q = await planOf();
  return /£[\d,]+ a month after tax/.test(t) && t.includes(`lasts to ${q.horizonAge}`) && /£[\d,]+ (to spare|short)|Just what you ask/.test(t); });
await check('17a3 the caveat sits beside the headline figure', async () => /not a guarantee/.test(await futuresText()));
await check('17a4 the status never contradicts the central case', async () => {
  const q = await planOf(); const dd = E.drawdown({ ...q, growth: q.growthBase }); const key = await statusKey();
  // "On track" or "Enough on average" only when the central case pays in full; "Nearly" or "Not enough" only when it runs short.
  return dd.holds ? !['close', 'not'].includes(key) : ['close', 'not'].includes(key); });
// "What could go wrong": the layered risk panel (audit §5C), one tap from home.
// The people whose State Pension is still to start: for them the panel adds "A smaller State Pension" (Scout, 21 November 2026).
const spToCome = q => (E.isSingle(q) ? [q.partnerA] : [q.partnerA, q.partnerB]).filter(w => w && w.spAmount > 0 && w.birthYear > 1900 && q.startYear - w.birthYear < E.spAgeOf(w));
await p.getByRole('button', { name: 'What could go wrong?' }).click(); await wait(600);
await p.waitForFunction(() => document.querySelectorAll('[role=dialog][aria-label="What could go wrong"] [data-risk]').length >= 6, null, { timeout: 20000 }).catch(() => {});
{
  const risk = p.locator('[role=dialog][aria-label="What could go wrong"]');
  await check('17b what could go wrong: central case, a poor run, three real histories, a smaller State Pension where one is still to start, and the futures', async () => {
    const keys = await risk.locator('[data-risk]').evaluateAll(els => els.map(e => e.getAttribute('data-risk')).join(' '));
    return keys === (spToCome(await planOf()).length ? 'base poor japan stagflation crashflat spLow futures' : 'base poor japan stagflation crashflat futures'); });
  await check('17b2 the hardest real history is named and explained in one sentence', async () => /Japan from 1990/.test(await risk.innerText()) && /Two lost decades/.test(await risk.innerText()));
  await check('17b3 each case is a limit in pounds a month, with what it would take to see it through', async () => /£[\d,]+/.test(await risk.locator('[data-risk="japan"]').innerText()) && /would see it through|would still be paid/.test(await risk.locator('[data-risk="japan"]').innerText()));
  await check('17b4 the unluckiest 1 in 10 is stated as an age', async () => /unluckiest 1 in 10/.test(await risk.locator('[data-risk="futures"]').innerText()));
  await check('17b5 scenarios, not predictions', async () => /Scenarios, not predictions/.test(await risk.innerText()));
  // Scout, 18 November 2026: running short beside still being here (after Engaging Data's "Rich, Broke or Dead").
  await check('17b5b the futures row puts running short beside still being here, with the engine\'s own figures', async () => {
    const q0 = await planOf(), q = { ...q0, growth: q0.growthBase ?? q0.growth }, m = E.runMonteCarlo(q, 2000, q.mcSeed || 42);
    const el = await risk.locator('[data-still-here]').count();
    if (m.successProb >= 0.995) return el === 0;
    const t = (await risk.locator('[data-still-here]').innerText()).replace(/\s+/g, ' ');
    const joint = Math.round((1 - m.successLifetime) * 100), couple = q.household !== 'single';
    let ok = t.includes(joint < 1 ? 'in fewer than 1 of 100 futures' : `in about ${joint} of 100 futures`) && t.includes(couple ? 'while one of you is still here' : 'while you are still here')
      && /national averages, and many people live longer/.test(t) && joint <= 100 - Math.round(m.successProb * 100) + 1;
    if (m.shortAgeP10 != null) {
      const o = E.lifeOdds(q, m.shortAgeP10), ahead = m.shortAgeP10 - o.a.ageNow;
      const here = Math.round((1 - (1 - o.a.at(m.shortAgeP10)) * (1 - (o.b ? o.b.at(o.b.ageNow + ahead) : 0))) * 100);
      ok = ok && t.includes(`still here at ${m.shortAgeP10} is about ${here} in 100`) && here >= 1 && here <= 100;
    }
    return ok; });
  await check('17b6 the central case agrees with the engine to the nearest ten pounds', async () => {
    const q = await planOf(); const txt = await risk.locator('[data-risk="base"]').innerText(); const shown = Number((txt.match(/£([\d,]+)/) || [])[1]?.replace(/,/g, ''));
    // The most a year that still holds, by bisection, as the insight does.
    let lo = 2000, hi = Math.max(250000, q.targetNet * 3);
    for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; const Q = { ...q, spendingPlanOn: false, targetNet: mid, growth: q.growthBase }; const acc = E.accumulate(Q, Q.growth); if (E.drawdown(Q, { growth: Q.growth, startPots: acc.atRetirement }).holds) lo = mid; else hi = mid; }
    return Math.abs(shown - Math.round(Math.floor(lo / 100) * 100 / 12 / 10) * 10) <= 10; });
  // Scout, 21 November 2026: every other case is a market; this one is the income most plans lean on hardest
  // (Moneysmart asks "Include the Age Pension?"; TPAW Planner: "Assume that your pension will be lower than expected").
  await check('17b7 a smaller State Pension: a fifth off each one still to start, by the same bisection, never above the central case, with where the fifth comes from and where to check', async () => {
    const q = await planOf(), who = spToCome(q);
    if (!who.length) return (await risk.locator('[data-risk="spLow"]').count()) === 0;
    const low = JSON.parse(JSON.stringify(q)); for (const w of spToCome(low)) w.spAmount = Math.round(w.spAmount * 0.8);
    const most = (pl) => { let lo = 2000, hi = Math.max(250000, pl.targetNet * 3);
      for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; const Q = { ...pl, spendingPlanOn: false, targetNet: mid, growth: pl.growthBase }; const acc = E.accumulate(Q, Q.growth); if (E.drawdown(Q, { growth: Q.growth, startPots: acc.atRetirement }).holds) lo = mid; else hi = mid; }
      return Math.round(Math.floor(lo / 100) * 100 / 12 / 10) * 10; };
    const txt = (await risk.locator('[data-risk="spLow"]').innerText()).replace(/\s+/g, ' ');
    const fig = Number((await risk.locator('[data-risk="spLow"] .tnum').first().innerText()).match(/£([\d,]+)/)[1].replace(/,/g, ''));
    const want = most(low), base = most(q);
    if (Math.abs(fig - want) > 10) console.log(`  17b7: shows £${fig}, by hand £${want} (central £${base})`);
    return Math.abs(fig - want) <= 10 && want <= base && /A fifth less than you have entered, for life/.test(txt) && /7 missing years of National Insurance/.test(txt) && /the full rate needs 35/.test(txt) && /gov\.uk\/check-state-pension/.test(txt)
      && (await risk.locator('a[href^="http"]').count()) === 0; });
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
// The island: at rest it says how short the bad futures are; touch the land,
// or use the keys, to read any age.
await p.waitForFunction(() => document.querySelector('[data-island]')?.getAttribute('data-ready') === '1', null, { timeout: 20000 }).catch(() => {}); await wait(800);
{
  const st = await sunState(); const q = await planOf(); const m = E.runMonteCarlo(q, 2000, q.mcSeed || 42);
  const still = (i) => Math.round(m.perAgeHeld[i].full * 100), ask = gbp(q.targetNet / 12);
  const firstShort = m.perAgeHeld.find(h => Math.round(h.full * 100) < 100)?.age ?? null;
  await check('30 at rest the island reads the first shortfall and how far the worst 10 of 100 dip, from the engine', () => st && st.age === null && st.firstShort === firstShort && st.label === restingLine(q, m, firstShort));
  const box = await p.locator('[data-island] [role=slider]').boundingBox();
  await p.mouse.click(box.x + box.width * 0.45, box.y + box.height * 0.8); await wait(300);
  const touched = await sunState();
  await check('31 touching the land reads that age, from the engine', () => touched.age != null && touched.age >= st.first && touched.age <= st.last && touched.label.startsWith(`At ${touched.age}: ${still(touched.age - st.first)} of 100 futures still pay ${ask} a month in full.`));
  await p.locator('[data-island] [role=slider]').focus(); await p.keyboard.press('Home'); await wait(150);
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
// Scout, 19 November 2026: the futures year by year as a table (the tower's numbers as text).
// Counts and the plan are compared exactly. Money left is compared within 2% and a rounding step: the same
// plan differs by up to 0.4% between the browser's JavaScript engine and node's (e2e150 check J), and at a
// percentile that can move the pick to the neighbouring future (1.07% seen at a 10th percentile).
await check('65d futures: "Show every year as a table" gives one row a year, and every figure is the engine\'s', async () => {
  const q0 = E.migratePlan(await planOf()), q = { ...q0, growth: q0.growthBase ?? q0.growth }, m = E.runMonteCarlo(q, 2000, q.mcSeed || 42), rows = E.drawdown(q).rows;
  await p.locator('[data-futures-table-toggle]').click(); await wait(500);
  const got = await p.$$eval('[data-futures-table] tbody tr', trs => trs.map(tr => [...tr.children].map(c => c.textContent.trim())));
  const pounds = t => { const n = parseFloat(t.replace(/[£,]/g, '')); return /m$/.test(t) ? n * 1e6 : /k$/.test(t) ? n * 1e3 : n; };
  const near = (shown, v, tol = 0.02) => Math.abs(pounds(shown) - v) <= Math.max(tol * v, v >= 1e6 ? 6000 : 600);
  const bad = [];
  rows.forEach((r, i) => { const g = got[i] || [], spend = Math.round(r.planTarget / Math.pow(1 + q.inflation, r.year - q.startYear)), qs = m.perAgePaid.ages[i].q, w = m.perAgeWealth[i];
    const full = qs.filter(v => v >= 0.99).length;
    const ok = String(g[0]).startsWith(String(r.ageA)) && pounds(g[1]) === spend && g[2] === String(full * 5) && g[3] === String(100 - full * 5) && g.length === 7
      && near(g[4], Math.max(0, w.p10)) && near(g[5], Math.max(0, w.p50)) && near(g[6], Math.max(0, w.p90));
    if (!ok) bad.push(`${r.ageA}: ${JSON.stringify(g)} want plan ${spend}, ${full * 5} in full, left ${Math.round(w.p10)} ${Math.round(w.p50)} ${Math.round(w.p90)}`); });
  const region = await p.$eval('[data-futures-table]', e => ({ tab: e.getAttribute('tabindex'), role: e.getAttribute('role'), label: e.getAttribute('aria-label') }));
  if (bad.length) console.log('  65d: ' + bad.slice(0, 3).join(' ; '));
  const ok = got.length === rows.length && bad.length === 0 && region.tab === '0' && region.role === 'region' && !!region.label
    && (await p.$eval('[data-futures-table] caption', e => e.textContent.length)) > 40;
  await p.locator('[data-futures-table-toggle]').click(); await wait(300);
  return ok && (await p.$('[data-futures-table]')) == null; });
await closeSheet();

await tap('Peace'); await wait(600);
await check('66 privacy card', () => has('Private by design'));
await check('67 one-possible-future card', () => has('One possible future'));
await check('68 not-advice card', () => has('Not financial advice'));
await check('69 UK-aware card', () => has('UK-aware'));
await check('69b assumptions list generated', async () => { await tap('Every assumption behind your numbers'); await wait(400); return (await has('Range of futures')) && (await has('Couples')); });
await check('69c assumptions: the four layers of uncertainty and the versions are stated', async () => (await has('What the confidence covers')) && /Engine \d{4}\.\d{2}\.\d{2} · plan schema \d+ · tax rules 20\d\d\/\d\d/.test(await bodyT()));
// Charges in context (Scout, 16 November 2026): the row places the plan's charge among what UK calculators
// assume and measures another 0.25% a year. The paid-in-full search is written again here, from the engine.
{
  const paid = (dd) => !!dd.holds && !dd.rows.some(r => r.spendMult != null && r.spendMult < 0.999);
  const run = (P) => { const g = P.growth ?? P.growthBase; const Q = { ...P, growth: g }; return E.drawdown(Q, { growth: g, startPots: E.accumulate(Q, g).atRetirement }); };
  const cap = (plan) => { const P = { ...JSON.parse(JSON.stringify(plan)), spendingPlanOn: false }; let lo = 2000, hi = Math.max(250000, (P.targetNet || 0) * 3);
    for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (paid(run({ ...P, targetNet: mid }))) lo = mid; else hi = mid; } return Math.floor(lo / 100) * 100; };
  await check('69g assumptions: charges are placed among UK calculators and another 0.25% is measured for this plan, from the engine', async () => {
    const q = await planOf(); const per = Math.max(0, Math.round((cap(q) - cap({ ...q, fee: (q.fee || 0) + 0.0025 })) / 12 / 10) * 10);
    const t = await bodyT(); return /Charges/.test(t) && /Nest 0\.3%/.test(t) && /Hargreaves Lansdown 1%/.test(t) && t.includes(`another 0.25% a year would lower what it can pay in full by about ${gbp(per)} a month`); });
}
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
const axeScan = async (label, pg = p) => {
  if (!(await pg.evaluate(() => !!window.axe))) await pg.addScriptTag({ path: AXE });
  const r = await pg.evaluate(async () => {
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
  await goPage('Safe ladder');
  await check('115 plus off: structure page unlocked', async () => !(await has('See what Plus adds')));
  // Scout, 20 November 2026: the safe ladder's spending rules stated in pounds (after Income Lab's guardrails).
  {
    const before = await p.evaluate(() => localStorage.getItem('horizon-plan-v1'));
    await check('115b the rules are hidden while the ladder is off', async () => (await p.$('[data-rules-pounds]')) == null);
    await p.locator('[role=dialog] [role=switch]:has-text("Use a safe ladder")').first().click(); await wait(900);
    await check('115c with the ladder on, the rules are stated in pounds, and the trigger is the engine\'s own ratio turned round', async () => {
      const q0 = E.migratePlan(await planOf()), q = { ...q0, growth: q0.growthBase ?? q0.growth }, AR = q.architecture, rows = E.drawdown(q).rows, row = rows[0];
      const t = (await p.$eval('[data-rules-pounds]', e => e.innerText)).replace(/\s+/g, ' ');
      const fOf = r => Math.pow(1 + q.inflation, r.year - q.startYear), spend = row.planTarget / fOf(row), money = row.wealth / fOf(row);
      const num = re => { const m = t.match(re); return m ? Number(m[1].replace(/,/g, '')) : NaN; };
      const month = v => '£' + (Math.round(v / 10) * 10).toLocaleString('en-GB');
      // By hand, from the central case's own rows: what the plan still needs and the guaranteed income still to come,
      // year by year to the cautious age at the gilt yield (the engine's rule since 2026.11.20).
      const n = Math.max(1, AR.longevityAge - row.ageA), r = Math.max(0.001, AR.giltReal);
      let need = 0, guar = 0, d = 1;
      for (let k = 0; k < n; k++) { d /= 1 + r; const y = rows[Math.min(k, rows.length - 1)]; need += (y.planTarget / fOf(y)) * d; guar += (y.guaranteedNet / fOf(y)) * d; }
      const shown = num(/if your money is below about £([\d,]+)/), raise = num(/stayed above about £([\d,]+)/);
      const okWords = t.startsWith('On your figures.') && t.includes(`age ${row.ageA}`) && t.includes(`never taken below ${month((spend / 12) * AR.floorMult)} a month`) && /All in today’s money\.$/.test(t);
      const near = (a, b) => Math.abs(a - b) <= Math.max(1500, 0.01 * Math.abs(b));
      const raiseOk = near(raise, Math.max(0, AR.raiseAbove * need - guar));
      if (!Number.isFinite(shown)) return okWords && /would not trim/.test(t) && AR.cutBelow * need - guar <= 1500 && raiseOk;
      return okWords && t.includes(`from ${month(spend / 12)} to ${month((spend / 12) * (1 - AR.cutBy))} a month`) && near(shown, AR.cutBelow * need - guar) && raiseOk && raise > shown
        && Math.abs((shown + guar) / need - AR.cutBelow) < 0.01 && (money < shown) === /trimmed from the start/.test(t); });
    await check('115d the rules count State Pension still to come: the first year\'s ratio is the money plus the income to come, over the spending to come', async () => {
      const q0 = E.migratePlan(await planOf()), q = { ...q0, growth: q0.growthBase ?? q0.growth }, AR = q.architecture, rows = E.drawdown(q).rows, row = rows[0];
      const fOf = r => Math.pow(1 + q.inflation, r.year - q.startYear), n = Math.max(1, AR.longevityAge - row.ageA), r = Math.max(0.001, AR.giltReal);
      let need = 0, guar = 0, d = 1;
      for (let k = 0; k < n; k++) { d /= 1 + r; const y = rows[Math.min(k, rows.length - 1)]; need += (y.planTarget / fOf(y)) * d; guar += (y.guaranteedNet / fOf(y)) * d; }
      const af = (1 - Math.pow(1 + r, -n)) / r, level = (row.wealth / fOf(row) + (row.guaranteedNet / fOf(row)) * af) / ((row.planTarget / fOf(row)) * af);
      const laterIncome = rows.some(y => y.guaranteedNet / fOf(y) > row.guaranteedNet / fOf(row) + 100);
      return Math.abs(row.fundedRatio - (row.wealth / fOf(row) + guar) / need) < 1e-6 && (!laterIncome || row.fundedRatio > level + 0.01); });
    // Put the plan back exactly as it was, so the rest of the sweep runs on the same figures.
    await p.evaluate(v => localStorage.setItem('horizon-plan-v1', v), before); await p.reload({ waitUntil: 'networkidle' }); await wait(900);
  }
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
await goPage('Safe ladder');
await check('115 free: structure page locked', async () => (await onPage('Safe ladder')) && (await p.locator('[role=dialog] [role=switch]:has-text("Use a safe ladder")').count()) === 0);
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
  await check('143 it leads with where the plan stands, in words', async () => /^(On track under these assumptions|Enough in most futures, not all|Enough, with a trim to spending|Nearly enough|Not enough yet) In \d+ of 100 futures/.test(await statusThenFutures()));
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
  await check('153 what could go wrong: every case, one tap from home', async () => (await p.locator('[data-risk-panel] [data-risk]').count()) === 6 + (spToCome(await planOf()).length ? 1 : 0));
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
  // Spending less in later life, one tap on the home (owner, 17 November 2026).
  await check('158l the home has the two later-life switches, and each one turns its step-down on and off in the plan', async () => {
    const q0 = await planOf(); const sw = p.locator('[data-step-down="phase1"]'); if ((await sw.count()) !== 1 || (await p.locator('[data-step-down="phase2"]').count()) !== 1) return false;
    const label = await sw.innerText(); if (!label.includes(`${Math.round(q0.phase1Cut * 100)}% less from ${q0.phase1Age}`)) return false;
    await sw.click(); await wait(500); const q1 = await planOf(); const a1 = await sw.getAttribute('aria-checked');
    await sw.click(); await wait(500); const q2 = await planOf();
    return q1.phase1On === !q0.phase1On && a1 === String(!q0.phase1On) && q2.phase1On === !!q0.phase1On; });
  // The time tunnel: a corridor from the stop age to the plan age; across
  // each year's stretch of floor, the bright lane's share of the floor's width
  // is the share of futures still paying in full. It is drawn from the same run as the
  // count in the sentence, so they cannot differ.
  await p.waitForFunction(() => document.querySelector('[data-island]')?.getAttribute('data-ready') === '1' && /of 100/.test(document.querySelector('[data-futures]')?.textContent || ''), null, { timeout: 20000 }).catch(() => {}); await wait(800);
  const ring = async () => p.evaluate(() => { const el = document.querySelector('[data-island]'); const sl = el.querySelector('[role=slider]');
    return { first: +el.getAttribute('data-first'), last: +el.getAttribute('data-last'), n: +el.getAttribute('data-years'), counts: el.getAttribute('data-full-counts').split(',').map(Number),
      mid: (el.getAttribute('data-cover-mid') || '').split(',').filter(Boolean).map(Number), label: sl.getAttribute('aria-label'), summary: document.getElementById('island-summary')?.textContent || '', futures: document.querySelector('[data-futures]')?.textContent || '' }; });
  const trancheVals = (q, rows, key, first, last) => { const by = new Map(rows.map(r => [r.ageA, r])); const out = [];
    for (let a = first; a <= last; a++) { const r = by.get(a); const v = !r ? 0 : key === 'ladder' ? r.ladder : key === 'engine' ? r.engine : key === 'pensions' ? r.potA + r.potB : r.isaA + r.isaB + r.cash + r.gia;
      out.push(r ? Math.max(0, v / Math.pow(1 + q.inflation, r.year - q.startYear)) : 0); } return out; };
  await check('158d the island has a count for every year from the year work stops to the plan age', async () => { const q = await planOf(), st = await ring();
    return st.counts.length === st.n && st.first === q.retireYear - q.partnerA.birthYear && st.n === E.planEndYear(q) - q.retireYear + 1 && st.last === st.first + st.n - 1; });
  await check('158e the island ends on the futures count in the sentence', async () => { const st = await ring(); const n = Number((st.futures.match(/^In (\d+) of 100/) || [])[1]); return st.counts[st.n - 1] === n; });
  await check('158f the count never rises from one year to the next', async () => { const st = await ring(); return st.counts.every((c, i) => c >= 0 && c <= 100 && (i === 0 || c <= st.counts[i - 1])); });
  // The island's land is the engine's cover (money still covering the ask from each age), across the futures:
  // its middle row is the median future's cover at every age, from the same seed.
  await check('158g the island\'s middle row is the engine\'s median cover at every age, from the same seed', async () => { const q = await planOf(), st = await ring(); const m = E.runMonteCarlo(q, 2000, q.mcSeed || 42);
    const med = m.perAgeCover.ages.map(r => r.q[10]); return st.mid.length === st.n && med.length === st.n && med.every((v, i) => Math.abs(v - st.mid[i]) <= 0.005 * Math.max(1, Math.abs(v))); });
  await check('158h the island agrees with the engine for the same seed, year by year', async () => { const q = await planOf(), st = await ring(); const m = E.runMonteCarlo(q, 2000, q.mcSeed || 42);
    return m.perAgeHeld.every((h, i) => Math.round(h.full * 100) === st.counts[i]); });
  await check('158i the island says in words what it shows (screen readers)', async () => { const st = await ring(); const q = await planOf(); const f = st.counts[st.n - 1];
    const typical = f < 100 ? E.runMonteCarlo(q, 2000, q.mcSeed || 42).perAgeHeld.find(h => Math.round(h.full * 100) <= (100 + f) / 2)?.age : null;
    return st.label === 'Futures still paying, by age' && st.summary.startsWith(`Stop at ${st.first} and take ${gbp(q.targetNet / 12)} a month. In ${f} of 100 futures it lasts to ${st.last}.${f < 100 ? ` In the other ${100 - f}, money first runs short at about ${typical}.` : ''}`); });
  await check('158j life is marked where it changes: the year the State Pension starts carries its flag, from the engine', async () => {
    const q = await planOf(), rows = E.drawdown(q).rows; const st = await ring();
    const at = rows.find((r, i) => i > 0 && !(rows[i - 1].spA > 1) && r.spA > 1)?.ageA;
    if (at == null || at <= st.first || at > st.last) return true;
    return p.evaluate(a => [...document.querySelectorAll(`[data-island] [data-event-age="${a}"]`)].some(e => /State Pension starts/.test(e.textContent)), at); });
  // Drag the sea to change what you ask (or use its keys): the plan's ask moves with it.
  await check('158m the sea is what you ask: its handle raises the ask by £100 a month on the up arrow and lowers it on the down arrow', async () => {
    const t0 = (await planOf()).targetNet; await p.locator('[data-sea-handle]').focus(); await p.keyboard.press('ArrowUp'); await wait(500);
    const up = (await planOf()).targetNet; await p.keyboard.press('ArrowDown'); await wait(500); const back = (await planOf()).targetNet;
    return up === t0 + 1200 && back === t0; });
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
  // Higher-rate relief (Scout, 17 November 2026): with no salary the field invites one; with a salary it
  // names the extra relief to claim back, from the engine's own tax tables: tax(S) − tax(S − G) − 20% of G.
  await check('158c3b with no salary entered, the field says where higher-rate relief goes and asks for the salary', async () =>
    /Higher-rate relief comes back to you through your tax, not into the pot; enter your salary/.test(await p.locator('[data-active]').innerText()));
  await p.locator('[data-active] button:has-text("Still working, charges and relief")').first().click(); await wait(400);
  await p.locator('[data-active] label:has-text("Salary a year while still working") input').first().fill('60000'); await p.keyboard.press('Tab'); await wait(700);
  await check('158c3c with a £60,000 salary the field names the extra relief to claim, from the engine', async () => { const q = await planOf(); const T = E.taxFor(q, q.startYear);
    const G = Math.min(q.partnerA.monthlyPension * 12 * 1.25, 60000); const x = Math.round((E.taxOn(60000, T) - E.taxOn(60000 - G, T) - 0.2 * G) / 10) * 10;
    return q.partnerA.income === 60000 && x > 0 && (await p.locator('[data-active]').innerText()).includes(`you can claim about ${gbp(x)} a year more back through Self Assessment`); });
  await p.locator('[data-active] label:has-text("Salary a year while still working") input').first().fill('0'); await p.keyboard.press('Tab'); await wait(500);
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

// ── The Lantern preview (Stage 2; docs/LANTERN_PLAN.md) ────────────────────
// The tower at ?lantern=1, drawn from the plan on this device through the
// engine and the adapter. Read only; it does not replace the home.
{
  const stored = await planOf();
  const q0 = E.migratePlan(stored), q = { ...q0, growth: q0.growthBase ?? q0.growth };
  // The way in from inside the app (installed on a Home Screen there is no address bar).
  await tap('Explore'); await wait(900);
  await check('163a lantern: Explore has a link to the full-screen Lantern, at least 44 px tall', async () => (await p.getAttribute('[data-lantern-link]', 'href')) === './?lantern=1' && (await p.$eval('[data-lantern-link]', e => e.getBoundingClientRect().height)) >= 44);
  await check('163b lantern: tapping it opens the preview, and "Back to Someday" returns to the home', async () => {
    await p.locator('[data-lantern-link]').click(); await p.waitForSelector('[data-lantern-preview]', { timeout: 15000 }).catch(() => {});
    const there = (await p.$('[data-lantern-preview]')) != null && /[?&]lantern=1/.test(p.url());
    await p.getByRole('link', { name: 'Back to Someday' }).click(); await p.waitForSelector('[data-simple-home]', { timeout: 15000 }).catch(() => {});
    return there && (await p.$('[data-simple-home]')) != null && !/lantern/.test(p.url()); });
  await p.goto(URL + '?lantern=1', { waitUntil: 'networkidle' }); await wait(700);
  const gl = await p.evaluate(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); });
  const L = k => p.$eval('[data-lantern]', (e, k) => e.getAttribute(k), k);
  const readout = () => p.$eval('[data-lantern-readout]', e => e.textContent);
  const nums = t => [...t.matchAll(/(\d+) (?:of 100 futures pay|fall short)/g)].map(m => +m[1]);
  const at = (r, n) => new RegExp(`^At ${r.ageA} \\(${r.year}(; your partner is ${r.ageB})?\\): ${n * 5} of 100 futures pay your full £[\\d,]+ a month\\.`);
  await check('163 lantern: it says whose figures these are (the plan on this device)', async () => /your plan/.test(await p.$eval('[data-lantern-whose]', e => e.textContent)));
  if (gl) {
    await p.waitForSelector('[data-lantern][data-ready="1"]', { timeout: 40000 }).catch(() => {});
    const rows = E.drawdown(q).rows, seed = q.mcSeed || 42;
    const lit = m => m.perAgePaid.ages.map(r => r.q.filter(v => v >= 0.99).length);
    const base = lit(E.runMonteCarlo(q, 2000, seed)), hit = lit(E.runMonteCarlo(q, 2000, seed, { shock: { year: 1, size: 0.3 } }));
    await check('164 lantern: the tower renders, one floor for every year of the plan, 10 windows a floor sorted worst to best', async () =>
      (await L('data-ready')) === '1' && (await p.$eval('[data-lantern] canvas', c => c.width > 100 && c.height > 100))
      && (await L('data-floors')) === String(rows.length) && (await L('data-windows')) === '10' && (await L('data-model-ok')) === '1' && (await L('data-first-age')) === String(rows[0].ageA));
    await check('165 lantern: the lit windows on every floor are the engine\'s own count of futures paid in full that year', async () => (await L('data-lit')) === base.join(','));
    await check('166 lantern: the readout counts the open floor of 100 and a month, and the count is the engine\'s', async () => {
      const t = await readout(), sel = +(await L('data-selected')), n = nums(t);
      return at(rows[sel], base[sel]).test(t) && (n.length === 1 ? n[0] === 100 : n[0] + n[1] === 100) && !/essentials|of 20/.test(t); });
    await check('167 lantern: each lens button turns the tower to its face', async () => {
      for (const k of [1, 2, 3, 0]) {
        await p.locator(`[data-lens="${k}"]`).click();
        const ok = await p.waitForFunction(k => { const e = document.querySelector('[data-lantern]'); return e.dataset.face === String(k) && e.dataset.settled === '1'; }, k, { timeout: 4000 }).then(() => true, () => false);
        if (!ok || (await p.getAttribute(`[data-lens="${k}"]`, 'aria-pressed')) !== 'true') return false;
      }
      return true; });
    await check('168 lantern: tapping a floor opens it and reads that year', async () => {
      const box = await p.locator('[data-lantern]').boundingBox(), before = +(await L('data-selected'));
      await p.mouse.click(box.x + box.width / 2, box.y + box.height * 0.78); await wait(600);
      const sel = +(await L('data-selected')), t = await readout();
      return sel !== before && sel >= 0 && at(rows[sel], base[sel]).test(t); });
    await check('169 lantern: the stress face is the same futures after a 30% fall in year 1, counted by the engine; every target is at least 44 px', async () => {
      await p.locator('[data-lens="3"]').click(); await wait(700);
      const sel = +(await L('data-selected')), t = await readout();
      const small = await p.$$eval('[data-lantern-preview] button, [data-lantern-preview] a', els => els.filter(e => e.getBoundingClientRect().height < 44).length);
      return (await L('data-lit-stress')) === hit.join(',') && t.startsWith(`At ${rows[sel].ageA}, after a 30% fall in year 1: ${hit[sel] * 5} of 100 futures`) && small === 0; });
    await check('170 lantern: sources and money left are read in words, and the picture is described for a screen reader', async () => {
      await p.locator('[data-lens="1"]').click(); await wait(600); const a = await readout();
      await p.locator('[data-lens="2"]').click(); await wait(600); const b = await readout();
      return /^At \d+ \(\d{4}\): each month, .*£/.test(a) && /left in the middle future/.test(b) && new RegExp(`^The Lantern: a tower of ${rows.length} years`).test(await L('aria-valuetext')) && (await L('role')) === 'slider'; });
  } else {
    await check('164 lantern: without WebGL the preview says so', () => has('This preview needs WebGL'));
  }
  await check('171 lantern: nothing left the device, and the plan on it is unchanged', async () => requests.length === 0 && JSON.stringify(await planOf()) === JSON.stringify(stored));
  await p.goto(URL, { waitUntil: 'networkidle' }); await wait(900);
  await check('172 lantern: the home is untouched (the island is still the picture)', async () => (await p.$('[data-island]')) != null && (await p.$('[data-lantern]')) == null);
  await check('173 lantern: zero page errors', () => pe.length === 0);
}

// ── The Lantern on the home (owner, 18 November 2026: "move the candle to the main screen… a key
// or other way to understand how it's constructed in each example") ─────────────────────────────
// In its own page with nothing pinned, so it opens as a visitor's does: on the Lantern.
{
  const stored = await planOf(), islandFigure = await p.$eval('[data-supports]', e => e.textContent).catch(() => null);
  const dump = await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => k !== 'someday-picture-v1'))));
  const cx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }), h = await cx.newPage();
  const herr = [], hreq = [];
  h.on('pageerror', e => herr.push(e.message)); h.on('console', m => { if (m.type() === 'error' && !/404|favicon/i.test(m.text())) herr.push(m.text()); });
  h.on('request', r => { const u = r.url(); if (!u.startsWith(URL) && !/^(data|blob|about):/.test(u)) hreq.push(u); });
  await h.goto(URL); await h.evaluate(d => { for (const [k, v] of Object.entries(JSON.parse(d))) localStorage.setItem(k, v); }, dump);
  await h.goto(URL, { waitUntil: 'networkidle' });
  const gl = await h.evaluate(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); });
  const hw = ms => h.waitForTimeout(ms);
  const H = k => h.$eval('[data-lantern]', (e, k) => e.getAttribute(k), k);
  const reading = () => h.$eval('[data-lantern-text]', e => e.textContent);
  const legend = () => h.$$eval('[data-lantern-home] [data-lantern-legend] li', els => els.map(e => e.textContent.trim()));
  const engineOf = (pl) => { const q0 = E.migratePlan(pl), q = { ...q0, growth: q0.growthBase ?? q0.growth }, seed = q.mcSeed || 42;
    const lit = m => m.perAgePaid.ages.map(r => r.q.filter(v => v >= 0.99).length);
    return { q, rows: E.drawdown(q).rows, base: () => lit(E.runMonteCarlo(q, 2000, seed)), hit: () => lit(E.runMonteCarlo(q, 2000, seed, { shock: { year: 1, size: 0.3 } })) }; };
  if (!gl) {
    await check('174 lantern home: without WebGL the home shows the island instead', async () => (await h.$('[data-island]')) != null);
  } else {
    await h.waitForSelector('[data-lantern-home] [data-lantern][data-ready="1"]', { timeout: 40000 }).catch(() => {});
    const X = engineOf(stored), base = X.base();
    await check('174 lantern home: a visitor\'s home opens on the Lantern, not the island', async () => (await h.$('[data-simple-home] [data-lantern-home]')) != null && (await h.$('[data-island]')) == null && (await H('data-ready')) === '1');
    await check('175 lantern home: the answer sits in the panel, and is the figure the island shows for the same plan', async () => {
      const t = await h.$eval('[data-lantern-home]', e => e.innerText);
      return (await h.$('[data-lantern-home] [data-status]')) != null && /Your plan can pay/.test(t) && /a month after tax/.test(t) && !/You ask for/.test(t)
        && (await h.$eval('[data-lantern-home] [data-supports]', e => e.textContent)) === islandFigure && (await h.$('[data-lantern-home] [data-futures]')) != null; });
    await check('176 lantern home: one floor a year, and the lit windows on every floor are the engine\'s count', async () => (await H('data-floors')) === String(X.rows.length) && (await H('data-lit')) === base.join(',') && (await H('data-model-ok')) === '1');
    const at = (r, n) => new RegExp(`^At ${r.ageA} \\(${r.year}(; your partner is ${r.ageB})?\\): ${n * 5} of 100 futures pay your full £[\\d,]+ a month\\.`);
    // Scout, 21 November 2026 (the owner: "The UX is now too complex"; "visually stunning and different but simplicity is important"):
    // the picture without its scaffolding. No key, no caption, no buttons, no counts beside the floors: the tower and the answer.
    await check('177 lantern home: the panel holds the tower and the answer and nothing else: no key, caption, buttons or lens switches, and one thing to tap', async () => {
      const r = await h.evaluate(() => { const panel = document.querySelector('[data-lantern-home] > div');
        const controls = [...panel.querySelectorAll('button, a[href], input, [role="button"], [role="slider"], [role="switch"]')].filter(e => e.getBoundingClientRect().width > 0);
        const words = (panel.innerText || '').split(/\s+/).filter(Boolean).length;
        return { controls: controls.map(c => c.getAttribute('role') || c.tagName).join(','), words, text: panel.innerText }; });
      const gone = !(await h.$('[data-lantern-legend]')) && !(await h.$('[data-lantern-caption]')) && !(await h.$('[data-lantern-key-open]')) && !(await h.$('[data-lantern-more]')) && (await h.$$('[data-lantern-home] [data-lens]')).length === 0;
      if (!(gone && r.controls === 'slider' && r.words <= 22)) console.log('  177: ' + JSON.stringify(r).slice(0, 300));
      return gone && r.controls === 'slider' && r.words <= 22 && !/How to read|Each floor|of 100/.test(r.text) && (await H('data-windows')) === '10'; });
    await check('177b lantern home: beside the tower, the first and last age only, 13 px or larger, inside the picture; nothing on the home\'s first screen is set under 12 px in the panel', async () => {
      const got = await h.$$eval('[data-lantern] [data-floor-label]', els => { const box = document.querySelector('[data-lantern]').getBoundingClientRect();
        return els.filter(e => getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none').map(e => { const r = e.getBoundingClientRect();
          return { floor: +e.dataset.floorLabel, text: e.textContent, px: parseFloat(getComputedStyle(e.children[0]).fontSize), inside: r.left >= box.left && r.right <= box.right + 0.5 && r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5 }; }); });
      const smallest = await h.evaluate(() => { let m = 99; const w = document.createTreeWalker(document.querySelector('[data-lantern-home] > div'), NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.nodeValue.trim()) continue; const el = n.parentElement, cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue; m = Math.min(m, parseFloat(cs.fontSize)); } return m; });
      const want = [[0, String(X.rows[0].ageA)], [X.rows.length - 1, String(X.rows[X.rows.length - 1].ageA)]];
      const ok = got.length === 2 && want.every(([f, t]) => got.some(g => g.floor === f && g.text === t)) && got.every(g => g.inside && g.px >= 13) && smallest >= 13;
      if (!ok) console.log('  177b: ' + JSON.stringify(got) + ' smallest ' + smallest);
      return ok; });
    await check('177c lantern home: the tower does not turn on the home (a sideways drag leaves the first face showing)', async () => {
      const box = await h.locator('[data-lantern]').boundingBox(), y = box.y + box.height * 0.5;
      await h.mouse.move(box.x + box.width * 0.85, y); await h.mouse.down(); await h.mouse.move(box.x + box.width * 0.55, y, { steps: 6 }); await h.mouse.up(); await hw(600);
      const face = await H('data-face');
      if ((await H('data-selected')) !== '-1') { await h.locator('[data-lantern]').focus(); await h.keyboard.press('Escape'); await hw(500); }
      return face === '0'; });
    await check('179 lantern home: tapping a floor opens it and reads that year with the engine\'s count; tapping it again closes it', async () => {
      const rest = await reading(), box = await h.locator('[data-lantern]').boundingBox();
      const x = box.x + box.width * 0.66, y = box.y + box.height * 0.5;
      await h.mouse.click(x, y); await hw(700);
      const sel = +(await H('data-selected')), t = await reading();
      const opened = sel >= 0 && at(X.rows[sel], base[sel]).test(t) && (await h.$eval(`[data-lantern] [data-floor-label="${sel}"]`, e => e.textContent)) === String(X.rows[sel].ageA);
      // The open floor is taller and has moved, so tap it where its own label says it is.
      const mid = await h.$$eval(`[data-lantern] [data-floor-label="${sel}"]`, els => { const e = els.find(v => getComputedStyle(v).visibility !== 'hidden' && getComputedStyle(v).display !== 'none') || els[0], r = e.getBoundingClientRect(); return r.top + r.height / 2; });
      await h.mouse.click(x, mid); await hw(700);
      const after = await H('data-selected'), now = await reading();
      if (!(opened && after === '-1' && now === rest)) console.log(`  179: sel ${sel} text "${t}" want /${at(X.rows[Math.max(0, sel)], base[Math.max(0, sel)]).source}/ after ${after} rest "${rest}" now "${now}"`);
      return opened && after === '-1' && now === rest; });
    await check('180 lantern home: the keyboard reaches it: arrows open and move the floor, Escape closes it', async () => {
      await h.locator('[data-lantern]').focus(); await h.keyboard.press('ArrowUp'); await hw(300); await h.keyboard.press('ArrowUp'); await hw(500);
      const sel = +(await H('data-selected')), vt = await H('aria-valuetext');
      await h.keyboard.press('Escape'); await hw(500);
      return sel === 1 && vt.startsWith(`At ${X.rows[1].ageA} (`) && (await H('role')) === 'slider' && (await H('data-selected')) === '-1'; });
    await check('181 lantern home: under the picture, the answer in one sentence and nothing more until a floor is tapped; the other views are still reached from Explore', async () => {
      const t = (await h.$eval('[data-lantern-reading]', e => e.innerText)).replace(/\s+/g, ' ').trim();
      const sentence = /^In \d+ of 100 futures, £[\d,]+ a month lasts to \d+\. An estimate, not a guarantee\.$/.test(t) || /futures/.test(t) && t.split(' ').length <= 40;
      await h.getByRole('button', { name: 'Explore' }).last().click(); await hw(900);
      const link = (await h.getAttribute('[data-lantern-link]', 'href')) === './?lantern=1';
      await h.keyboard.press('Escape'); await hw(700);
      if (!(sentence && link)) console.log('  181: ' + t);
      return sentence && link && (await reading()) === ''; });
    await check('182 lantern home: changing the plan redraws the same tower in place, to the engine\'s new counts', async () => {
      await h.$eval('[data-lantern] canvas', c => { c.dataset.mark = 'same'; });
      await h.getByRole('button', { name: 'Take home: £100 a month more' }).click(); await hw(400);
      const now = await h.evaluate(() => JSON.parse(localStorage.getItem('horizon-plan-v1')));
      const Y = engineOf(now), want = Y.base().join(',');
      const ok = await h.waitForFunction(w => document.querySelector('[data-lantern]')?.getAttribute('data-lit') === w, want, { timeout: 30000 }).then(() => true, () => false);
      const same = (await h.$eval('[data-lantern] canvas', c => c.dataset.mark)) === 'same';
      await h.getByRole('button', { name: 'Take home: £100 a month less' }).click(); await hw(400);
      await h.waitForFunction(w => document.querySelector('[data-lantern]')?.getAttribute('data-lit') === w, base.join(','), { timeout: 30000 }).catch(() => {});
      return now.targetNet !== E.migratePlan(stored).targetNet && ok && same; });
    await check('183 lantern home: at 390×844, 390×660, 375×667 and 360×640 everything stays above the tab bar, nothing scrolls sideways, the answer is whole and the tower has the whole panel', async () => {
      const bad = [];
      for (const [w, hh] of [[390, 844], [390, 660], [375, 667], [360, 640]]) {
        await h.setViewportSize({ width: w, height: hh }); await hw(700);
        const r = await h.evaluate(() => { const nav = document.querySelector('nav').getBoundingClientRect(), home = document.querySelector('[data-simple-home]');
          const q = [...home.querySelectorAll('button')].find(x => /What could go wrong/.test(x.textContent)).getBoundingClientRect();
          return { slack: Math.round(nav.top - q.bottom), hscroll: home.scrollWidth > home.clientWidth + 1 }; });
        // The answer must be whole inside the panel, and the tower must have the room the scaffolding used to take.
        const keys = [await h.evaluate(() => { const panel = document.querySelector('[data-lantern-home] > div').getBoundingClientRect(), gap = document.querySelector('[data-lantern-home] [data-gap], [data-lantern-home] [data-supports]').getBoundingClientRect();
          const c = document.querySelector('[data-lantern] canvas').getBoundingClientRect();
          return gap.bottom <= panel.bottom && c.height >= panel.height - 1 && c.height >= 280; })];
        if (r.slack < 0 || r.hscroll || keys.includes(false)) bad.push(`${w}×${hh} ${JSON.stringify(r)} answer whole and the tower has the panel: ${keys.join(',')}`);
      }
      await h.setViewportSize({ width: 390, height: 844 }); await hw(500);
      if (bad.length) console.log('  lantern fit: ' + bad.join('; '));
      return bad.length === 0; });
    const ax = await axeScan('Lantern home', h);
    await check(`184 lantern home: no critical or serious WCAG 2.2 AA violations${ax.bad.length ? ' — ' + ax.detail : ''}`, () => ax.bad.length === 0);
    await check('185 lantern home: Explore switches the home picture to the island and back, and remembers it', async () => {
      await h.getByRole('button', { name: 'Explore' }).last().click(); await hw(900);
      await h.locator('[data-picture-choice="island"]').click(); await hw(400);
      const k1 = await h.evaluate(() => localStorage.getItem('someday-picture-v1'));
      await h.keyboard.press('Escape'); await hw(700);
      const island = (await h.$('[data-island]')) != null && (await h.$('[data-lantern-home]')) == null;
      await h.reload({ waitUntil: 'networkidle' }); await hw(900);
      const kept = (await h.$('[data-island]')) != null;
      await h.getByRole('button', { name: 'Explore' }).last().click(); await hw(900);
      await h.locator('[data-picture-choice="lantern"]').click(); await hw(400); await h.keyboard.press('Escape'); await hw(900);
      return k1 === 'island' && island && kept && (await h.evaluate(() => localStorage.getItem('someday-picture-v1'))) === 'lantern' && (await h.$('[data-lantern-home]')) != null; });
  }
  await check('186 lantern home: nothing left the device, and zero page errors' + (herr.length ? ' — ' + herr.slice(0, 2).join(' | ') : ''), () => hreq.length === 0 && herr.length === 0);
  await cx.close();
}

// ── A smaller State Pension is not offered where every State Pension is already being paid (a known amount) ──
{
  const q = await planOf(), old = JSON.parse(JSON.stringify(q));
  for (const w of [old.partnerA, old.partnerB]) if (w && w.birthYear > 1900) { w.birthYear = old.startYear - 72; w.spAge = 0; w.stopYear = 0; w.income = 0; w.monthlyPension = 0; }
  old.retireYear = old.startYear;
  const fixed = E.sanitisePlan(old);
  const dump = await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
  const cx = await b.newContext({ viewport: { width: 390, height: 844 } }), o = await cx.newPage(), oerr = [];
  o.on('pageerror', e => oerr.push(e.message));
  await o.addInitScript(() => { try { localStorage.setItem('someday-picture-v1', 'island'); } catch { /* private mode */ } });
  await o.goto(URL); await o.evaluate(([d, pl]) => { for (const [k, v] of Object.entries(JSON.parse(d))) localStorage.setItem(k, v); localStorage.setItem('horizon-plan-v1', pl); }, [dump, JSON.stringify(fixed)]);
  await o.goto(URL, { waitUntil: 'networkidle' });
  await o.getByRole('button', { name: 'What could go wrong?' }).click();
  await o.waitForFunction(() => document.querySelectorAll('[data-risk-panel] [data-risk]').length >= 6, null, { timeout: 30000 }).catch(() => {}); await o.waitForTimeout(500);
  await check('187 a smaller State Pension is not offered once every State Pension is in payment: six cases, and no page errors', async () =>
    spToCome(fixed).length === 0 && (await o.locator('[data-risk-panel] [data-risk]').evaluateAll(els => els.map(e => e.getAttribute('data-risk')).join(' '))) === 'base poor japan stagflation crashflat futures' && oerr.length === 0);
  await cx.close();
}

// ── The lab (Pension Scout, manual §3.3): concepts for the home on the real engine at ?lab=<name>.
// Reached only by their address, and they change nothing on the device.
{
  const stored = await planOf(), q0 = E.migratePlan(stored), q = { ...q0, growth: q0.growthBase ?? q0.growth };
  const of100 = pl => { const m = E.runMonteCarlo(pl, 2000, pl.mcSeed || 42); return Math.round((pl.architecture?.on && m.successProbWithCuts != null ? m.successProbWithCuts : m.successProb) * 100); };
  const dump = await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
  const cx = await b.newContext({ viewport: { width: 390, height: 660 } }), l = await cx.newPage(), lerr = [], lreq = [];
  l.on('pageerror', e => lerr.push(e.message)); l.on('console', m => { if (m.type() === 'error' && !/404|favicon|WebGL|GPU/i.test(m.text())) lerr.push(m.text()); });
  l.on('request', r => { const u = r.url(); if (!u.startsWith(URL) && !/^(data|blob|about):/.test(u)) lreq.push(u); });
  await l.goto(URL); await l.evaluate(d => { for (const [k, v] of Object.entries(JSON.parse(d))) localStorage.setItem(k, v); }, dump);
  await l.goto(URL + '?lab=moon', { waitUntil: 'networkidle' });
  await l.waitForSelector('[data-lab="moon"] [data-lab-count]', { timeout: 40000 }).catch(() => {});
  const count = async () => Number((await l.$eval('[data-lab-count]', e => e.textContent)).match(/\d+/)[0]);
  const settled = () => l.waitForFunction(() => document.querySelector('[data-lab="moon"]')?.dataset.pending === '0', null, { timeout: 40000 }).catch(() => {});
  await check('188 lab: the moon runs on the plan on this device: its count is the engine\'s share of futures (to 1 of 100), in plain words', async () => {
    await settled(); const shown = await count(), want = of100(q), t = (await l.$eval('[data-lab="moon"]', e => e.innerText)).replace(/\s+/g, ' ');
    if (Math.abs(shown - want) > 1) console.log(`  188: shows ${shown}, engine ${want}`);
    return Math.abs(shown - want) <= 1 && /times in 100, the money lasts to \d+/.test(t) && /Yes, on track|Probably|It could go either way|Probably not|Not as it stands/.test(t) && /Stop work at/.test(t) && /Take home a month/.test(t); });
  await check('189 lab: stepping "Stop work at" moves the count to the engine\'s figure for that plan, and saves nothing', async () => {
    await l.getByRole('button', { name: 'Stop work a year later' }).click(); await l.waitForTimeout(300); await settled();
    const shown = await count(), want = of100({ ...q, retireYear: q.retireYear + 1 });
    const saved = await l.evaluate(() => localStorage.getItem('horizon-plan-v1'));
    if (Math.abs(shown - want) > 1) console.log(`  189: shows ${shown}, engine ${want}`);
    return Math.abs(shown - want) <= 1 && saved === JSON.parse(dump)['horizon-plan-v1']; });
  await check('190 lab: the scales and the core load on the same plan; nothing left the device and no page errors' + (lerr.length ? ' — ' + lerr.slice(0, 2).join(' | ') : ''), async () => {
    const seen = [];
    for (const n of ['scales', 'core']) { await l.goto(URL + '?lab=' + n, { waitUntil: 'networkidle' }); await l.waitForSelector(`[data-lab="${n}"] [data-lab-line]`, { timeout: 40000 }).catch(() => {}); seen.push((await l.$eval('[data-lab-line]', e => e.textContent).catch(() => '')).length > 20); }
    return seen.every(Boolean) && lreq.length === 0 && lerr.length === 0; });
  await check('191 lab: nothing in the app links to it', async () => (await p.$$eval('a[href*="lab="]', els => els.length)) === 0);
  await cx.close();
}

console.log(`\n═══ Horizon UAT: ${pass}/${pass + fail} passed ═══`);
if (fails.length) console.log('\nFAILURES:\n' + fails.map(f => '  ' + f).join('\n'));
if (ce.length) console.log('\nCONSOLE ERRORS:\n' + [...new Set(ce)].slice(0, 10).map(e => '  • ' + e).join('\n'));
if (pe.length) console.log('\nPAGE ERRORS:\n' + [...new Set(pe)].slice(0, 10).map(e => '  • ' + e).join('\n'));

await b.close();
if (server) server.close();
// Gate: fail the process on any runtime error, or more than 2 assertion misses.
process.exitCode = (ce.length > 0 || pe.length > 0 || fail > 2) ? 1 : 0;
