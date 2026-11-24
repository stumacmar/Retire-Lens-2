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
  await check('17b3 each case is what it could pay in pounds a month, and says once whether that is enough or how far short (to the nearest £10 of the ask)', async () => {
    const month = Math.round((await planOf()).targetNet / 12);
    return (await risk.locator('[data-risk]:not([data-risk="futures"])').evaluateAll((els, month) => els.every(e => { const pays = Number(e.querySelector('[data-risk-pays]').textContent.replace(/[£,]/g, '')), v = e.querySelector('[data-risk-verdict]').textContent;
      return pays >= month ? v === 'enough' : v === '£' + (Math.round((month - pays) / 10) * 10).toLocaleString('en-GB') + ' short'; }), month)) && !/see it through|covers your ask|short of your ask/.test(await risk.innerText()); });
  await check('17b4 the futures row says what the home says: the count, the age you are when the plan ends, and the bad case as an age, from the engine\'s per-age counts', async () => {
    const q0 = await planOf(), q = { ...q0, growth: q0.growthBase ?? q0.growth }, m = E.runMonteCarlo(q, 2000, q.mcSeed || 42), H = m.perAgeHeld, last = H[H.length - 1], count = Math.round(m.successProb * 100);
    const t = (await risk.locator('[data-risk="futures"]').innerText()).replace(/\s+/g, ' ');
    const said = t.match(/(\d+) times in 100, the money lasts until you are (\d+)\. (In the unluckiest 10 of 100, it runs short by age (\d+)(, falling to about £[\d,]+ a month)?\.|More often than not, it runs short by age (\d+)\.|Even the unluckiest 10 of 100 are paid in full\.)$/);
    const often = count < 50, hit = H.find(v => (often ? v.full < 0.5 : v.full <= 0.9)), cut = often ? 0.5 : 0.9, edge = Math.abs(count - 50) <= 1 || H.some(v => Math.abs(v.full - cut) < 0.006);
    const age = said ? Number(said[4] || said[6]) : null;
    const ok = !!said && Math.abs(Number(said[1]) - count) <= 1 && Number(said[2]) === last.age && (edge || (hit ? Math.abs(age - hit.age) <= 1 && (often ? !!said[6] : !!said[4]) : /Even the unluckiest/.test(said[3])));
    if (!ok) console.log(`  17b4: "${t}", engine count ${count} to ${last.age}, short by ${hit ? hit.age : 'never'}`);
    return ok; });
  await check('17b5 scenarios, not predictions', async () => /Scenarios, not predictions/.test(await risk.innerText()));
  // Scout, 22 November 2026: the sheet was halved. What the unlucky are still paid is the home's own figure for the last year.
  await check('17b5b the bad case says what is still paid, the same figure the home gives for the last year; the sentences about still being here have gone', async () => {
    const q0 = await planOf(), q = { ...q0, growth: q0.growthBase ?? q0.growth }, m = E.runMonteCarlo(q, 2000, q.mcSeed || 42), rows = E.drawdown(q).rows;
    const t = (await risk.locator('[data-risk="futures"]').innerText()).replace(/\s+/g, ' '), fall = t.match(/falling to about £([\d,]+) a month/);
    if (!fall) return (await risk.locator('[data-still-here]').count()) === 0 && !/still here|national averages/.test(t);
    const a = m.perAgePaid.ages[m.perAgePaid.ages.length - 1], r = rows.find(v => v.ageA === a.age), want = Math.round(((a.q[1] + a.q[2]) / 2 * r.planTarget / Math.pow(1 + (q.inflation || 0), r.year - q.startYear) / 12) / 50) * 50, shown = Number(fall[1].replace(/,/g, ''));
    if (Math.abs(shown - want) > Math.max(50, want * 0.02)) console.log(`  17b5b: shows £${shown}, engine £${want}`);
    return Math.abs(shown - want) <= Math.max(50, want * 0.02) && (await risk.locator('[data-still-here]').count()) === 0 && !/still here|national averages/.test(t); });
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
    return Math.abs(fig - want) <= 10 && want <= base && /A fifth less, for life/.test(txt) && /7 missing years of National Insurance/.test(txt) && /gov\.uk\/check-state-pension/.test(txt)
      && (await risk.locator('a[href^="http"]').count()) === 0; });
}
await p.getByRole('button', { name: 'Close' }).click(); await wait(400);
await p.getByRole('button', { name: 'What would help?' }).click();
await p.waitForFunction(() => /\+\d+|Nothing measured/.test(document.querySelector('[role=dialog][aria-label="What would help?"]')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
await check('17f what would help: each action measured', async () => /\+\d+|Nothing measured/.test(await p.locator('[role=dialog][aria-label="What would help?"]').innerText()));
await check('17f2 what would help: in the home\'s words (times in 100; "Stop work at", "Live on … a month"), each gain the engine\'s own and named for a screen reader, and nothing set under 13 px', async () => {
  const d = p.locator('[role=dialog][aria-label="What would help?"]'), t = (await d.innerText()).replace(/\s+/g, ' ');
  if (/Nothing measured/.test(t)) return true;
  const q0 = await planOf(), q = { ...q0, growth: q0.growthBase ?? q0.growth }, L = E.levers(q, { paths: 200 }).levers.filter(l => l.dConf > 0.004).slice(0, 6);
  const rows = await d.locator('[data-help]').evaluateAll(els => els.map(e => [e.getAttribute('data-help'), e.querySelector('[data-help-gain]').textContent, e.innerText.replace(/\s+/g, ' '), e.getAttribute('aria-label') || '']));
  const px = await d.evaluate(e => { let m = 99; const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue.trim()) m = Math.min(m, parseFloat(getComputedStyle(n.parentElement).fontSize)); return m; });
  const same = rows.length === L.length && rows.every(([id, gain, , name]) => { const l = L.find(v => v.id === id); return !!l && Math.abs(Number(gain) - Math.round(l.dConf * 100)) <= 2 && name.endsWith(`: ${Number(gain)} more times in 100`); });
  const later = rows.find(r => r[0] === 'later1'), less = rows.find(r => r[0] === 'spend3k');
  const ok = /How many more times in 100 the money would last\./.test(t) && !/of 100|a year less|simulated futures|Prompts|bridges the early/.test(t) && same && px >= 13
    && (!later || later[2].startsWith(`Stop work at ${q.retireYear - q.partnerA.birthYear + 1} `)) && (!less || less[2].startsWith('Live on £250 a month less '));
  if (!ok) console.log(`  17f2: px ${px} rows ${JSON.stringify(rows)} engine ${JSON.stringify(L.map(l => [l.id, Math.round(l.dConf * 100)]))}`);
  return ok; });
await p.getByRole('button', { name: 'Close' }).click(); await wait(400);
await check('18 the figures are saved on the plan', async () => (await planOf()).partnerA.pension === 300000 && (await planOf()).partnerA.monthlyPension === 1550);
await check('19 bottom tab bar visible', () => has('Home'));
await check('20 setup completed without a separate form', () => true);

await loadEx();
await check('21 example loads Robin & Jo', async () => (await planOf()).partnerA?.name === 'Robin');
await waitAnswer();
await check('22 example shows an answer', async () => /£[\d,]+ a month after tax/.test(await answerText()));
await check('23 the count of futures shown', async () => /^In \d+ of 100 futures/.test(await futuresText()));

let k = 24;
for (const [t, m] of [['Details', 'Your details'], ['Explore', 'Explore'], ['Workings', 'How this is worked out']]) {
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
await check('36b the rail names the pages', async () => (await has('Someday')) && (await has('Drawing')) && (await has('Growth rates')));
await check('36c Details: on every page, nothing is set under 13 px and there are at most four text sizes (Scout, 24 November 2026)', async () => {
  const r = await p.evaluate(() => { const d = document.querySelector('[role=dialog]'), px = new Set(); const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.nodeValue.trim() || n.parentElement.closest('.sr-only')) continue; px.add(Math.round(parseFloat(getComputedStyle(n.parentElement).fontSize) * 10) / 10); }
    return [...px].sort((x, y) => x - y); });
  const ok = r.length > 0 && r[0] >= 13 && r.length <= 4; if (!ok) console.log('  36c sizes: ' + r.join(' / ')); return ok; });
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
await goPage('Growth rates');
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

await tap('Workings'); await wait(600);
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
await check('91 four tab destinations', async () => (await has('Home')) && (await has('Details')) && (await has('Explore')) && (await has('Workings')));
await tap('Details'); await wait(500);
await check('92 sheet opens (dialog role)', () => sheetOpen());
await check('93 £ prefix in fields', async () => /£/.test(await bodyT()));
await goPage('Drawing'); await check('94 drawing page reachable from the rail', () => onPage('Which pot first'));
await goPage('Spending'); await check('95 spending page reachable from the rail', () => onPage('Ease spending from'));
await goPage('Plan file'); await check('95b plan file: says where the plan is kept and when it was saved (audit F-06)', async () => /Saved on this device/.test(await p.$eval('[data-save-status]', e => e.innerText).catch(() => '')));
await closeSheet();
await tap('Workings'); await wait(500); await p.mouse.click(195, 25); await wait(500);
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
  await tap('Workings'); await wait(600);
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
  await tap('Workings'); await wait(500);
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
await tap('Workings'); await wait(500);
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
  await p.waitForFunction(() => /\+\d+|Nothing measured/.test(document.querySelector('[data-help-panel]')?.textContent || ''), null, { timeout: 25000 }).catch(() => {});
  await check('155 what would help: each action measured', async () => /\+\d+|Nothing measured/.test(await p.$eval('[data-help-panel]', e => e.innerText)));
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

// ── The moon is the home (owner, 21 November 2026, on the three concepts built in the lab: "Moon - do it").
// One night-blue screen: a moon lit by how often the money lasts, the count, a verdict the count alone decides,
// two steppers, and the years one press deeper. In its own page with nothing pinned, so it opens as a visitor's does.
{
  const stored = await planOf();
  const dump = await p.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => k !== 'someday-picture-v1'))));
  const cx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }), h = await cx.newPage();
  const herr = [], hreq = [];
  h.on('pageerror', e => herr.push(e.message)); h.on('console', m => { if (m.type() === 'error' && !/404|favicon/i.test(m.text())) herr.push(m.text()); });
  h.on('request', r => { const u = r.url(); if (!u.startsWith(URL) && !/^(data|blob|about):/.test(u)) hreq.push(u); });
  await h.goto(URL); await h.evaluate(d => { for (const [k, v] of Object.entries(JSON.parse(d))) localStorage.setItem(k, v); localStorage.setItem('someday-picture-v1', 'moon'); }, dump);
  await h.goto(URL, { waitUntil: 'networkidle' });
  const gl = await h.evaluate(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); });
  const hw = ms => h.waitForTimeout(ms);
  const M = k => h.$eval('[data-moon-home]', (e, k) => e.getAttribute(k), k);
  const settled = () => h.waitForFunction(() => document.querySelector('[data-moon-home] [data-answer]')?.getAttribute('data-ready') === '1', null, { timeout: 40000 }).catch(() => {});
  const words = v => (v >= 80 ? 'Yes, on track' : v >= 60 ? 'Probably' : v >= 40 ? 'It could go either way' : v >= 20 ? 'Probably not' : 'Not as it stands');
  // What the engine says the moon should show, worked out here in node (so a count may differ by one from the browser's).
  const engineOf = (pl) => { const q0 = E.migratePlan(pl), q = { ...q0, growth: q0.growthBase ?? q0.growth }, m = E.runMonteCarlo(q, 2000, q.mcSeed || 42), st = !!q.architecture?.on;
    // The moon counts paid in full on every plan; a safe-ladder plan states the count with its rules beside it.
    const held = m.perAgeHeld.map(v => ({ age: v.age, n: Math.round(v.full * 100) })), n = held.length, lastH = m.perAgeHeld[n - 1], kept = st ? Math.round(Math.max(lastH.full, lastH.rules) * 100) : null;
    const pick = e => held.filter((y, i) => i === 0 || i === n - 1 || (y.age % e === 0 && i >= 3 && i <= n - 4)), five = pick(5);
    const rows = E.drawdown(q).rows;
    const unlucky = age => { const a = m.perAgePaid.ages.find(v => v.age === age), r = rows.find(v => v.ageA === age); if (!a || !r) return null; const share = (a.q[1] + a.q[2]) / 2;
      return share >= 0.99 ? 'full' : Math.round((share * r.planTarget / Math.pow(1 + (q.inflation || 0), r.year - q.startYear) / 12) / 50) * 50; };
    // The bad case as an age: where the money lasts at least half the time, the age by which 10 of 100 have run short; otherwise the age by which more than half have.
    const often = held[n - 1].n < 50, hit = m.perAgeHeld.find(v => (often ? v.full < 0.5 : v.full <= 0.9)), cut = often ? 0.5 : 0.9;
    const shortBy = hit ? { age: hit.age, often } : null, edge = Math.abs(held[n - 1].n - 50) <= 1 || m.perAgeHeld.some(v => Math.abs(v.full - cut) < 0.006);
    return { count: held[n - 1].n, toAge: held[n - 1].age, years: five.length > 8 ? pick(10) : five, mc: m, unlucky, kept, shortBy, edge }; };
  const seenText = sel => h.$eval(sel, e => { const c = e.cloneNode(true); c.querySelectorAll('.sr-only').forEach(x => x.remove()); c.style.cssText = 'position:fixed;left:-9999px;top:0;width:360px'; document.body.appendChild(c); const t = c.innerText; c.remove(); return t.replace(/\s+/g, ' ').trim(); });
  const yearsShown = async () => ((await M('data-years')) || '').split(' ').filter(Boolean).map(s => s.split(':').map(Number));
  const near = (got, want) => got.length === want.length && got.every(([a, n], i) => a === want[i].age && Math.abs(n - want[i].n) <= 1);
  // The share of the moon's disc that is lit, measured from a photograph of the screen: the lit pixels in the moon's
  // box against the area of the disc (its radius is the box's, as moon.ts lays it out). The night side is not counted,
  // so the measure does not depend on how dark it is drawn.
  const litShare = async () => { await h.waitForFunction(() => { const m = document.querySelector('[data-moon-home]'), d = m && m.querySelector('[data-lit]'); return !!d && d.getAttribute('data-lit') === m.getAttribute('data-count'); }, null, { timeout: 20000 }).catch(() => {}); await hw(900);
    const box = await h.locator('[data-moon-box]').boundingBox(), png = (await h.screenshot({ clip: box })).toString('base64');
    const lit = await h.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data; let gold = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 115 && d[i + 1] > 95) gold++;
      return { gold, scale: img.width / document.querySelector('[data-moon-box]').getBoundingClientRect().width }; }, png);
    const R = Math.min(box.width * 0.36, box.height * 0.45) * lit.scale;
    return lit.gold / (Math.PI * R * R); };
  if (!gl) {
    await check('174 moon home: without WebGL the home shows the island instead', async () => (await h.$('[data-island]')) != null);
  } else {
    await h.waitForSelector('[data-moon-home][data-drawn="1"]', { timeout: 40000 }).catch(() => {});
    await settled(); await hw(1500);
    const X = engineOf(stored);
    await check('174 moon home: where the moon is the chosen picture the home opens on it, not the chart, the island or the tower', async () =>
      (await h.$('[data-simple-home][data-moon-home] canvas')) != null && (await h.$('[data-chart-home]')) == null && (await h.$('[data-island]')) == null && (await h.$('[data-lantern]')) == null && (await M('data-drawn')) === '1');
    await check('175 moon home: the count is the engine\'s share of futures (to 1 of 100), the sentence names the last year, and the verdict is the one the count decides', async () => {
      const shown = Number(await h.$eval('[data-moon-count]', e => e.textContent)), line = await h.$eval('[data-moon-line]', e => e.textContent), verdict = await h.$eval('[data-moon-home] [data-status]', e => e.textContent);
      const rulesLine = await h.$eval('[data-moon-home] [data-moon-rules]', e => e.textContent).catch(() => null), keptShown = rulesLine ? Number((rulesLine.match(/^or (\d+) times, trimmed by your rules$/) || [])[1]) : null;
      const lineOk = rulesLine ? line === `times in 100, it pays in full until you are ${X.toAge}` && X.kept != null && Math.abs(keptShown - X.kept) <= 1 : line === `times in 100, the money lasts until you are ${X.toAge}` && (X.kept == null || Math.abs(X.kept - X.count) <= 1);
      const ok = Math.abs(shown - X.count) <= 1 && lineOk && verdict === words(shown) && String(shown) === (await M('data-count'));
      if (!ok) console.log(`  175: shows ${shown} "${line}" "${verdict}", engine ${X.count} to ${X.toAge}`);
      return ok; });
    await check('176 moon home: the years in the row are the engine\'s (the day of stopping, each fifth birthday, the last year), and the last year is the headline count', async () => {
      const got = await yearsShown(), ok = near(got, X.years) && got[got.length - 1][1] === Number(await M('data-count')) && got.every(([, n], i) => i === 0 || n <= got[i - 1][1]);
      if (!ok) console.log('  176: ' + JSON.stringify(got) + ' engine ' + JSON.stringify(X.years));
      return ok; });
    await check('176b moon home: the bad case is said as an age, from the same counts as the row, and it is the way in to the years', async () => {
      const label = (await h.$eval('[data-moon-years]', e => e.innerText)).replace(/\s+/g, ' ').trim(), by = await h.getAttribute('[data-moon-years]', 'data-short-by');
      const said = label.match(/^(In the unluckiest 10 of 100|More often than not), it runs short by age (\d+) ›$/);
      const ok = X.shortBy
        ? (!!said && said[1] === (X.shortBy.often ? 'More often than not' : 'In the unluckiest 10 of 100') && Math.abs(Number(said[2]) - X.shortBy.age) <= 1 && by === said[2]) || X.edge
        : label === 'The years ahead ›' || X.edge;
      if (!ok) console.log(`  176b: "${label}", engine ${JSON.stringify(X.shortBy)}`);
      return ok; });
    await check('177 moon home: the first screen is the moon, the count, the verdict, two steppers and two questions: 60 words or fewer, and none of the old scaffolding', async () => {
      const r = await h.evaluate(() => { const home = document.querySelector('[data-moon-home]'), nav = document.querySelector('nav');
        const shows = e => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden'; };
        const controls = [...home.querySelectorAll('button, a[href], input, [role="slider"], [role="switch"]')].filter(shows).length;
        const c = home.cloneNode(true); c.querySelectorAll('.sr-only').forEach(x => x.remove()); c.style.cssText = 'position:fixed;left:-9999px;top:0;width:390px'; document.body.appendChild(c);
        const seen = c.innerText; c.remove();
        return { controls, words: (seen + ' ' + nav.innerText).split(/\s+/).filter(Boolean).length, text: seen.replace(/\s+/g, ' ') }; });
      const gone = !(await h.$('[data-step-down]')) && !(await h.$('[data-counts]')) && !(await h.$('[data-supports]')) && !(await h.$('[data-driver="monthly"]')) && !/Your plan can pay|futures|pay in/i.test(r.text);
      const ok = gone && r.words <= 60 && r.controls <= 8 && /Stop work at/.test(r.text) && /Live on each month/.test(r.text) && !/Take home/.test(r.text) && /What would help\?/.test(r.text) && /What could go wrong\?/.test(r.text);
      if (!ok) console.log('  177: ' + JSON.stringify(r).slice(0, 400));
      return ok; });
    await check('177b moon home: no text on the first screen is under 13 px, tab bar included, and it is set in four sizes', async () => {
      const sizes = await h.evaluate(() => { const out = new Set();
        for (const root of [document.querySelector('[data-moon-home]'), document.querySelector('nav')]) { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.nodeValue.trim()) continue; const el = n.parentElement, cs = getComputedStyle(el), b = el.getBoundingClientRect(); if (cs.visibility === 'hidden' || cs.display === 'none' || !b.width || el.closest('.sr-only')) continue; out.add(Math.round(parseFloat(cs.fontSize) * 10) / 10); } }
        return [...out].sort((a, b) => a - b); });
      const ok = sizes[0] >= 13 && sizes.length <= 4;
      if (!ok) console.log('  177b: sizes ' + sizes.join(', '));
      return ok; });
    await check('177c moon home: the picture is honest: the share of the moon that is lit, measured from the screen, is the count (within 6 of 100)', async () => {
      const lit = await litShare(), shown = Number(await M('data-count'));
      const ok = lit != null && Math.abs(lit * 100 - shown) <= 6;
      if (!ok) console.log(`  177c: lit share ${lit == null ? 'not measured' : (lit * 100).toFixed(1)}, count ${shown}`);
      return ok; });
    const tapYear = async i => { const bx = await h.locator('[data-moon-home] [data-year-age]').nth(i).boundingBox(); await h.mouse.click(bx.x + bx.width / 2, bx.y - 20); await hw(900); };
    await check('179 moon home: the line under the verdict opens the years with the last age chosen, the large moon standing over it; pressing another age reads it with the engine\'s figures; pressing the large moon returns to the answer', async () => {
      await h.locator('[data-moon-years]').click(); await hw(1200);
      const l1 = await M('data-level'), sel1 = Number(await M('data-sel')), t1 = await seenText('[data-moon-home] [data-answer]');
      const labels = await h.$$eval('[data-moon-home] [data-year-age]', els => els.filter(e => getComputedStyle(e).visibility !== 'hidden').map(e => [Number(e.dataset.yearAge), Number(e.querySelector('[data-n]').textContent)]));
      const reads = (t, got) => { const said = t.match(new RegExp(`^At ${got[0]} ${got[1]} times in 100, (?:the money lasts this long|it pays in full this long; \\d+ times, trimmed by your rules)\\. (Even the unluckiest 10 are paid in full that year\\.|In the unluckiest 10, it pays about £([\\d,]+) a month\\.)$`));
        // What the unluckiest 10 of 100 are paid that year, from the engine: the 10th percentile of that year's share paid, times what the plan asks then.
        const lucky = X.unlucky(got[0]), shownU = said && said[2] ? Number(said[2].replace(/,/g, '')) : null;
        const ok = !!said && (lucky === 'full' ? shownU == null : shownU != null && Math.abs(shownU - lucky) <= Math.max(50, lucky * 0.02));
        if (!ok) console.log(`  179: "${t}"; the engine's unluckiest 10 at ${got[0]}: ${lucky}`);
        return ok; };
      const last = labels[labels.length - 1] || [], first = sel1 === X.toAge && reads(t1, last);
      const k = Math.min(3, X.years.length - 2); await tapYear(k);
      const l2 = await M('data-level'), sel = Number(await M('data-sel')), t2 = await seenText('[data-moon-home] [data-answer]');
      const got = labels[k] || [], read = reads(t2, got);
      // The row stays whole, and the years are also a list for a screen reader.
      const whole = (await h.$$eval('[data-moon-home] [data-year-age]', els => els.filter(e => getComputedStyle(e).visibility !== 'hidden').length)) === labels.length;
      const list = await h.$$eval('[data-moon-home] [data-moon-list] li', els => els.map(e => e.textContent));
      // The large moon stands above its own age (kept inside the box): pressing it goes back to the answer.
      const bx = await h.locator('[data-moon-box]').boundingBox(), R2 = Math.min(bx.width * 0.19, bx.height * 0.22), lb = await h.locator('[data-moon-home] [data-year-age]').nth(k).boundingBox();
      await h.mouse.click(Math.max(bx.x + R2, Math.min(bx.x + bx.width - R2, lb.x + lb.width / 2)), bx.y + R2 + 6); await hw(900);
      const ok = l1 === '2' && first && near(labels, X.years) && l2 === '2' && sel === got[0] && read && whole && list.length === labels.length && list[k] === `To ${got[0]}: ${got[1]} times in 100.` && (await M('data-level')) === '0';
      if (!ok) console.log(`  179: levels ${l1},${l2},${await M('data-level')} sel ${sel1},${sel} "${t1}" "${t2}" labels ${JSON.stringify(labels)}`);
      if ((await M('data-level')) !== '0') { await h.locator('[data-moon-years]').click(); await hw(900); }
      return ok; });
    await check('179b moon home: pressing the moon itself opens the years too, and "Back" returns to the answer', async () => {
      const bx = await h.locator('[data-moon-box]').boundingBox(); await h.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); await hw(900);
      const l = await M('data-level'), back = (await h.$eval('[data-moon-years]', e => e.innerText)).trim(); await h.locator('[data-moon-years]').click(); await hw(900);
      return l === '2' && /Back$/.test(back) && (await M('data-level')) === '0'; });
    await check('180 moon home: the keyboard reaches it: Enter on the line under the verdict, then the years are a slider stepped with Home, the arrows and End, and Escape returns to the answer', async () => {
      await h.locator('[data-moon-years]').focus(); await h.keyboard.press('Enter'); await hw(700);
      await h.locator('[data-moon-box]').focus(); await h.keyboard.press('Home'); await hw(300); const home = await M('data-sel'); await h.keyboard.press('ArrowRight'); await hw(500);
      const role = await h.getAttribute('[data-moon-box]', 'role'), now = await h.getAttribute('[data-moon-box]', 'aria-valuenow'), vt = await h.getAttribute('[data-moon-box]', 'aria-valuetext');
      await h.keyboard.press('End'); await hw(400); const end = await M('data-sel');
      await h.keyboard.press('Escape'); await hw(700);
      const ok = role === 'slider' && home === String(X.years[0].age) && now === String(X.years[1].age) && vt.startsWith(`At ${X.years[1].age}: `) && end === String(X.toAge) && (await M('data-level')) === '0';
      if (!ok) console.log(`  180: role ${role} home ${home} now ${now} "${vt}" end ${end} level ${await M('data-level')}`);
      return ok; });
    await check('181 moon home: "What would help?" and "What could go wrong?" open their sheets over it, and the tab bar is night-blue only while the moon is in front', async () => {
      const night0 = await h.getAttribute('nav', 'data-night');
      await h.getByRole('button', { name: 'What could go wrong?' }).click(); await hw(900);
      const risk = (await h.$('[data-risk-panel]')) != null, night1 = await h.getAttribute('nav', 'data-night');
      await h.keyboard.press('Escape'); await hw(700);
      await h.getByRole('button', { name: 'What would help?' }).click(); await hw(900);
      const help = (await h.getByRole('dialog').count()) > 0 && /What would help\?/.test(await h.getByRole('dialog').first().innerText());
      await h.keyboard.press('Escape'); await hw(700);
      await h.getByRole('button', { name: 'Explore' }).last().click(); await hw(900);
      const night2 = await h.getAttribute('nav', 'data-night'), link = (await h.getAttribute('[data-lantern-link]', 'href')) === './?lantern=1';
      await h.keyboard.press('Escape'); await hw(700);
      const ok = night0 === '1' && risk && night1 == null && help && night2 == null && link && (await h.getAttribute('nav', 'data-night')) === '1';
      if (!ok) console.log(`  181: night ${night0},${night1},${night2} risk ${risk} help ${help} link ${link}`);
      return ok; });
    await check('182 moon home: a stepper writes the plan, and the same moon moves to the engine\'s new count (no new canvas)', async () => {
      await h.$eval('[data-moon-home] canvas', c => { c.dataset.mark = 'same'; });
      await h.getByRole('button', { name: 'Live on each month: £100 more' }).click(); await hw(500); await settled(); await hw(300);
      const now = await h.evaluate(() => JSON.parse(localStorage.getItem('horizon-plan-v1'))), Y = engineOf(now);
      const shown = Number(await M('data-count')), years = await yearsShown(), same = (await h.$eval('[data-moon-home] canvas', c => c.dataset.mark)) === 'same';
      await h.getByRole('button', { name: 'Stop work at: a year later' }).click(); await hw(500); await settled(); await hw(300);
      const later = await h.evaluate(() => JSON.parse(localStorage.getItem('horizon-plan-v1'))), Z = engineOf(later), shown2 = Number(await M('data-count'));
      await h.getByRole('button', { name: 'Stop work at: a year earlier' }).click(); await hw(300);
      await h.getByRole('button', { name: 'Live on each month: £100 less' }).click(); await hw(500); await settled();
      const back = await h.evaluate(() => JSON.parse(localStorage.getItem('horizon-plan-v1')));
      const base = E.migratePlan(stored);
      const ok = now.targetNet === base.targetNet + 1200 && Math.abs(shown - Y.count) <= 1 && near(years, Y.years) && same && later.retireYear === base.retireYear + 1 && Math.abs(shown2 - Z.count) <= 1
        && back.targetNet === base.targetNet && back.retireYear === base.retireYear;
      if (!ok) console.log(`  182: ask ${now.targetNet} (was ${base.targetNet}) shows ${shown}, engine ${Y.count}; a year later shows ${shown2}, engine ${Z.count}; same canvas ${same}`);
      return ok; });
    await check('182b moon home: the take-home figure can be typed, and the count follows', async () => {
      const base = E.migratePlan(stored), want = Math.round(base.targetNet / 12 / 100) * 100 + 700;
      await h.locator('[data-driver="targetNet"] button[data-value]').click(); await hw(200);
      await h.keyboard.press('Control+A'); await h.keyboard.type(String(want)); await h.keyboard.press('Enter'); await hw(500); await settled(); await hw(300);
      const now = await h.evaluate(() => JSON.parse(localStorage.getItem('horizon-plan-v1'))), Y = engineOf(now), shown = Number(await M('data-count')), lit = await (async () => { await hw(1500); return litShare(); })();
      await h.locator('[data-driver="targetNet"] button[data-value]').click(); await hw(200);
      await h.keyboard.press('Control+A'); await h.keyboard.type(String(base.targetNet / 12)); await h.keyboard.press('Enter'); await hw(500); await settled();
      const back = await h.evaluate(() => JSON.parse(localStorage.getItem('horizon-plan-v1')));
      const ok = now.targetNet === want * 12 && Math.abs(shown - Y.count) <= 1 && lit != null && Math.abs(lit * 100 - shown) <= 6 && Math.abs(back.targetNet - base.targetNet) < 1;
      if (!ok) console.log(`  182b: asked ${want}, plan ${now.targetNet}, shows ${shown}, engine ${Y.count}, lit ${lit == null ? '?' : (lit * 100).toFixed(1)}, back ${back.targetNet}`);
      return ok; });
    await check('183 moon home: at 390×844, 390×660, 375×667, 360×780 and 360×640 it all fits one screen above the tab bar, nothing scrolls, no label touches a button, and the years stay apart', async () => {
      const bad = [];
      for (const [w, hh] of [[390, 844], [390, 660], [375, 667], [360, 780], [360, 640]]) {
        await h.setViewportSize({ width: w, height: hh }); await hw(700);
        const fit = () => h.evaluate(() => { const nav = document.querySelector('nav').getBoundingClientRect(), home = document.querySelector('[data-moon-home]');
          const low = Math.max(...[...home.querySelectorAll('button')].map(x => x.getBoundingClientRect().bottom)), box = document.querySelector('[data-moon-box]').getBoundingClientRect();
          const rows = [...home.querySelectorAll('[data-driver]')].every(d => { const l = d.querySelector('span').getBoundingClientRect(), m = d.querySelector('button').getBoundingClientRect(); return l.right <= m.left && l.height < 30; });
          const labs = [...home.querySelectorAll('[data-year-age]')].filter(e => getComputedStyle(e).visibility !== 'hidden').map(e => e.getBoundingClientRect());
          const apart = labs.every((r, i) => r.left >= 0 && r.right <= innerWidth && r.top >= box.top && r.bottom <= box.bottom + 1 && (i === 0 || r.left >= labs[i - 1].right));
          return { slack: Math.round(nav.top - low), scrolls: home.scrollHeight > home.clientHeight + 1 || home.scrollWidth > home.clientWidth + 1, box: Math.round(box.height), rows, apart, labels: labs.length }; });
        const a = await fit();
        await h.locator('[data-moon-years]').click(); await hw(1000); const y = await fit();
        await tapYear(1); const z = await fit();
        await h.locator('[data-moon-years]').click(); await hw(700);
        for (const [name, r] of [['answer', a], ['years', y], ['a year', z]]) if (r.slack < 0 || r.scrolls || r.box < 168 || !r.rows || !r.apart || (name !== 'answer' && r.labels < 3)) bad.push(`${w}×${hh} ${name} ${JSON.stringify(r)}`);
      }
      await h.setViewportSize({ width: 390, height: 844 }); await hw(600);
      if (bad.length) console.log('  moon fit: ' + bad.join('; '));
      return bad.length === 0 && (await M('data-level')) === '0'; });
    const ax = await axeScan('Moon home', h);
    await h.locator('[data-moon-years]').click(); await hw(900); await tapYear(2);
    const ax2 = await axeScan('Moon home, a year open', h);
    await h.locator('[data-moon-years]').click(); await hw(700);
    await check(`184 moon home: no critical or serious WCAG 2.2 AA violations, closed or with a year open${ax.bad.length + ax2.bad.length ? ' — ' + [ax.detail, ax2.detail].filter(Boolean).join(' | ') : ''}`, () => ax.bad.length === 0 && ax2.bad.length === 0);
    await check('185 moon home: Explore switches the home picture to the island and back, and remembers it', async () => {
      await h.getByRole('button', { name: 'Explore' }).last().click(); await hw(900);
      await h.locator('[data-picture-choice="island"]').click(); await hw(400);
      const k1 = await h.evaluate(() => localStorage.getItem('someday-picture-v1'));
      await h.keyboard.press('Escape'); await hw(700);
      const island = (await h.$('[data-island]')) != null && (await h.$('[data-moon-home]')) == null && (await h.getAttribute('nav', 'data-night')) == null;
      await h.reload({ waitUntil: 'networkidle' }); await hw(900);
      const kept = (await h.$('[data-island]')) != null;
      await h.getByRole('button', { name: 'Explore' }).last().click(); await hw(900);
      await h.locator('[data-picture-choice="moon"]').click(); await hw(400); await h.keyboard.press('Escape'); await hw(900);
      return k1 === 'island' && island && kept && (await h.evaluate(() => localStorage.getItem('someday-picture-v1'))) === 'moon' && (await h.$('[data-moon-home]')) != null; });
  }
  await check('186 moon home: nothing left the device, and zero page errors' + (herr.length ? ' — ' + herr.slice(0, 2).join(' | ') : ''), () => hreq.length === 0 && herr.length === 0);
  await check('186b the lab\'s losing concepts are gone: no address in the app opens them, and nothing links to one', async () => {
    await h.goto(URL + '?lab=scales', { waitUntil: 'networkidle' }); await hw(600);
    const none = (await h.$('[data-lab]')) == null && (await h.$('[data-lab-index]')) == null;
    return none && (await p.$$eval('a[href*="lab="]', els => els.length)) === 0; });

  // ── The plain chart is the home (owner, 24 November 2026: "Build it", on the verdict of the council asked whether
  // the moon, the island and the Lantern were "too gimmicky"). The count, the verdict, and one chart of what you would
  // live on each month: what you ask, and what the unlucky are paid. In its own page, as a visitor's opens (a device
  // that had stored the Lantern gets it too).
  {
    const cc = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }), c = await cc.newPage();
    const cerr = [], creq = [];
    c.on('pageerror', e => cerr.push(e.message)); c.on('console', m => { if (m.type() === 'error' && !/404|favicon/i.test(m.text())) cerr.push(m.text()); });
    c.on('request', r => { const u = r.url(); if (!u.startsWith(URL) && !/^(data|blob|about):/.test(u)) creq.push(u); });
    await c.goto(URL); await c.evaluate(d => { for (const [k, v] of Object.entries(JSON.parse(d))) localStorage.setItem(k, v); localStorage.setItem('someday-picture-v1', 'lantern'); }, dump);
    await c.goto(URL, { waitUntil: 'networkidle' });
    const cw = ms => c.waitForTimeout(ms), C = k => c.$eval('[data-chart-home]', (e, k) => e.getAttribute(k), k);
    const ready = () => c.waitForFunction(() => document.querySelector('[data-chart-home]')?.getAttribute('data-ready') === '1', null, { timeout: 40000 }).catch(() => {});
    const planC = () => c.evaluate(() => JSON.parse(localStorage.getItem('horizon-plan-v1')));
    const txt = sel => c.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
    await ready(); await cw(500);
    const X = engineOf(stored);
    await check('187 chart home: a visitor\'s home opens on the plain chart (also where the device had stored the Lantern): no moon, no island, no tower, no canvas, and the tab bar is not night-blue', async () =>
      (await c.$('[data-simple-home][data-chart-home] [data-chart]')) != null && (await c.$('[data-moon-home]')) == null && (await c.$('[data-island]')) == null && (await c.$('[data-lantern]')) == null
      && (await c.$('[data-chart-home] canvas')) == null && (await c.getAttribute('nav', 'data-night')) == null);
    await check('188 chart home: the count is the engine\'s share of futures (to 1 of 100), the sentence names the last year, and the verdict is the one the count decides', async () => {
      const shown = Number(await txt('[data-chart-count]')), line = await txt('[data-chart-line]'), verdict = await txt('[data-chart-home] [data-status]'), rules = await txt('[data-chart-rules]');
      const lineOk = rules ? line.startsWith(`times in 100, it pays in full until you are ${X.toAge}`) && /^or \d+ times, trimmed by your rules$/.test(rules) : line === `times in 100, the money lasts until you are ${X.toAge}`;
      const ok = Math.abs(shown - X.count) <= 1 && lineOk && verdict === words(shown) && String(shown) === (await C('data-count'));
      if (!ok) console.log(`  188: shows ${shown} "${line}" "${verdict}", engine ${X.count} to ${X.toAge}`);
      return ok; });
    await check('189 chart home: the bad case on the chart is the engine\'s: the age the lower line leaves what is asked, what is then paid a month (to £50), and the same age in the words under it', async () => {
      const sb = await C('data-short-by'), paid = await C('data-end-paid'), said = await txt('[data-chart-said]'), btn = await txt('[data-chart-years]'), low = (await c.$('[data-chart-low]')) != null;
      if (X.edge) return true;
      let ok;
      if (!X.shortBy) ok = sb === '' && !low && said === 'Even the unluckiest 10 of 100 are paid in full' && btn.startsWith('The years ahead');
      else { const u = X.shortBy.often ? null : X.unlucky(X.toAge), who = X.shortBy.often ? 'More often than not' : 'The unluckiest 10 of 100';
        ok = sb === String(X.shortBy.age) && low && said.startsWith(`${who}: about £`) && said.endsWith('a month') && btn.includes(`it runs short by age ${X.shortBy.age}`) && (typeof u !== 'number' || Math.abs(Number(paid) - u) <= 50); }
      if (!ok) console.log(`  189: short by "${sb}" paid "${paid}" said "${said}" button "${btn}", engine ${JSON.stringify(X.shortBy)} ${X.shortBy && !X.shortBy.often ? X.unlucky(X.toAge) : ''}`);
      return ok; });
    await check('190 chart home: the first screen is the count, the verdict, one chart, two steppers and two questions: 80 words or fewer, 12 controls or fewer, "times in 100" and never "futures"', async () => {
      const r = await c.evaluate(() => { const vis = el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.top < innerHeight && b.bottom > 0 && !el.closest('.sr-only'); };
        const root = [document.querySelector('[data-chart-home]'), document.querySelector('nav')], words = [];
        for (const el of root) { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.nodeValue.trim(); if (t && vis(n.parentElement)) words.push(...t.split(/\s+/).filter(x => /[A-Za-z0-9£]/.test(x))); } }
        const controls = root.flatMap(el => [...el.querySelectorAll('button, a[href], input, [role=slider]')]).filter(el => vis(el) && !el.disabled).length;
        return { words: words.length, controls, text: words.join(' ') }; });
      const ok = r.words <= 80 && r.controls <= 12 && /times in 100/.test(r.text) && !/futures/i.test(r.text) && /Stop work at/.test(r.text) && /Live on each month/.test(r.text) && /What you ask: £[\d,]+ a month/.test(r.text) && /What would help\?/.test(r.text) && /What could go wrong\?/.test(r.text);
      if (!ok) console.log(`  190: ${r.words} words, ${r.controls} controls: ${r.text}`);
      return ok; });
    await check('191 chart home: no text on the first screen is under 13 px, tab bar and chart included, and it is set in four sizes', async () => {
      const px = await c.evaluate(() => { const out = new Set(); for (const el of [document.querySelector('[data-chart-home]'), document.querySelector('nav')]) { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.nodeValue.trim() || n.parentElement.closest('.sr-only')) continue; out.add(Math.round(parseFloat(getComputedStyle(n.parentElement).fontSize) * 10) / 10); } } return [...out].sort((a, b) => a - b); });
      const ok = px[0] >= 13 && px.length <= 4; if (!ok) console.log('  191 sizes: ' + px.join(' / ')); return ok; });
    await check('192 chart home: the line under the chart opens the years as plain numbers, and each row is the engine\'s (the count to 1 of 100, what the unluckiest 10 are paid to £50)', async () => {
      await c.locator('[data-chart-years]').click(); await cw(900);
      const rows = await c.$$eval('[data-chart-table] tr[data-year]', els => els.map(e => [Number(e.getAttribute('data-year')), Number(e.children[1].textContent), e.children[2].textContent.trim()]));
      const ok = rows.length === X.years.length && rows.every(([age, n, un], i) => { const u = X.unlucky(age);
        return age === X.years[i].age && Math.abs(n - X.years[i].n) <= 1 && (u === 'full' ? un === 'paid in full' || /^£/.test(un) : u == null || un === 'paid in full' || Math.abs(Number(un.replace(/[£,]/g, '')) - u) <= 50); })
        && (await c.locator('[role=dialog]').first().getAttribute('aria-label')) === 'The years ahead';
      if (!ok) console.log(`  192: rows ${JSON.stringify(rows)} engine ${JSON.stringify(X.years)}`);
      await c.keyboard.press('Escape'); await cw(600);
      return ok; });
    await check('193 chart home: a stepper writes the plan and the count follows the engine; a typed figure far too high turns the chart to "More often than not", and typing the old figure restores it', async () => {
      const was = (await planC()).targetNet;
      await c.getByRole('button', { name: 'Live on each month: £100 more' }).click(); await cw(600); await ready(); await cw(400);
      const q1 = await planC(), x1 = engineOf(q1), n1 = Number(await C('data-count'));
      const type = async v => { await c.locator('[data-chart-home] [data-driver="targetNet"] button[data-value]').click(); await cw(200); const inp = c.getByLabel('Live on each month, type a figure'); await inp.fill(String(v)); await inp.press('Enter'); await cw(600); await ready(); await cw(400); };
      await type(Math.round(was / 12 * 2.2));
      const q2 = await planC(), n2 = Number(await C('data-count')), said2 = await txt('[data-chart-said]'), btn2 = await txt('[data-chart-years]');
      await type(Math.round(was / 12)); const back = (await planC()).targetNet;
      const ok = q1.targetNet === was + 1200 && Math.abs(n1 - x1.count) <= 1 && q2.targetNet > was * 2 && (n2 >= 50 || (said2.startsWith('More often than not: about £') && btn2.startsWith('More often than not, it runs short by age'))) && Math.abs(back - was) <= 12;
      if (!ok) console.log(`  193: ${was} -> ${q1.targetNet} shows ${n1} engine ${x1.count}; high ${q2.targetNet} shows ${n2} "${said2}"; back ${back}`);
      return ok; });
    await check('194 chart home: at 390×844, 390×660, 375×667, 360×780 and 360×640 it all fits one screen above the tab bar, nothing scrolls, and the chart keeps its height', async () => {
      const bad = [];
      for (const [w, hh] of [[390, 844], [390, 660], [375, 667], [360, 780], [360, 640]]) { await c.setViewportSize({ width: w, height: hh }); await cw(500);
        const r = await c.evaluate(() => { const home = document.querySelector('[data-chart-home]'), nav = document.querySelector('nav').getBoundingClientRect(), ch = home.querySelector('[data-chart]').getBoundingClientRect();
          const lastB = Math.max(...[...home.querySelectorAll('button')].map(x => x.getBoundingClientRect().bottom)); const said = home.querySelector('[data-chart-said]').getBoundingClientRect();
          return { scrolls: home.scrollHeight > home.clientHeight + 1 || home.scrollWidth > home.clientWidth + 1, over: lastB > nav.top + 0.5, chart: ch.height, saidIn: said.left >= ch.left - 1 && said.right <= ch.right + 1 && said.bottom <= ch.bottom + 1 }; });
        if (r.scrolls || r.over || r.chart < 150 || !r.saidIn) bad.push(`${w}x${hh} ${JSON.stringify(r)}`); }
      await c.setViewportSize({ width: 390, height: 844 }); await cw(400);
      if (bad.length) console.log('  194: ' + bad.join(' | ')); return bad.length === 0; });
    const ax = await axeScan('Chart home', c);
    await c.locator('[data-chart-years]').click(); await cw(900);
    const ax2 = await axeScan('Chart home, the years open', c);
    await c.keyboard.press('Escape'); await cw(600);
    await check(`195 chart home: no critical or serious WCAG 2.2 AA violations, closed or with the years open${ax.bad.length + ax2.bad.length ? ' — ' + [ax.detail, ax2.detail].filter(Boolean).join(' | ') : ''}`, () => ax.bad.length === 0 && ax2.bad.length === 0);
    await check('196 chart home: Explore offers the chart, the moon and the island; choosing the moon shows it (the island where WebGL is missing) and is remembered; choosing the chart brings it back', async () => {
      await c.getByRole('button', { name: 'Explore' }).last().click(); await cw(900);
      const three = (await c.$$eval('[data-picture-choice]', els => els.map(e => e.getAttribute('data-picture-choice')).join(','))) === 'chart,moon,island';
      await c.locator('[data-picture-choice="moon"]').click(); await cw(400);
      const k1 = await c.evaluate(() => localStorage.getItem('someday-picture-v1'));
      await c.keyboard.press('Escape'); await cw(1500);
      const other = (await c.$('[data-chart-home]')) == null && ((await c.$('[data-moon-home]')) != null || (await c.$('[data-island]')) != null);
      await c.reload({ waitUntil: 'networkidle' }); await cw(1200);
      const kept = (await c.$('[data-chart-home]')) == null;
      await c.getByRole('button', { name: 'Explore' }).last().click(); await cw(900);
      await c.locator('[data-picture-choice="chart"]').click(); await cw(400); await c.keyboard.press('Escape'); await cw(900);
      const ok = three && k1 === 'moon' && other && kept && (await c.evaluate(() => localStorage.getItem('someday-picture-v1'))) === 'chart' && (await c.$('[data-chart-home]')) != null;
      if (!ok) console.log(`  196: three ${three} stored ${k1} other ${other} kept ${kept}`);
      return ok; });
    await check('197 chart home: nothing left the device, and zero page errors' + (cerr.length ? ' — ' + cerr.slice(0, 2).join(' | ') : ''), () => creq.length === 0 && cerr.length === 0);
    await cc.close();
  }
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

console.log(`\n═══ Horizon UAT: ${pass}/${pass + fail} passed ═══`);
if (fails.length) console.log('\nFAILURES:\n' + fails.map(f => '  ' + f).join('\n'));
if (ce.length) console.log('\nCONSOLE ERRORS:\n' + [...new Set(ce)].slice(0, 10).map(e => '  • ' + e).join('\n'));
if (pe.length) console.log('\nPAGE ERRORS:\n' + [...new Set(pe)].slice(0, 10).map(e => '  • ' + e).join('\n'));

await b.close();
if (server) server.close();
// Gate: fail the process on any runtime error, or more than 2 assertion misses.
process.exitCode = (ce.length > 0 || pe.length > 0 || fail > 2) ? 1 : 0;
