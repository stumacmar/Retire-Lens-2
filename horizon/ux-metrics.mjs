/**
 * Someday · how much is on each screen.
 *
 *   npm run build && npm run ux:metrics            # prints a table
 *   node ux-metrics.mjs --json                     # prints JSON only
 *   node ux-metrics.mjs --shots <folder>           # also saves a screenshot of every screen
 *
 * "Simpler" has to be a number, or every change can be argued to be simpler.
 * This counts what a person meets on each screen of the built app, for the
 * made-up example couple on a 390 × 660 phone (the owner's):
 *
 *   words        words of visible text
 *   numbers      distinct figures shown (anything with a digit in it)
 *   controls     things that can be tapped, typed in or dragged
 *   sizes        different text sizes in use, and the smallest in px
 *   small        words set smaller than 12 px
 *   grade        the reading grade of the text (Flesch-Kincaid; lower is plainer)
 *
 * For the home it counts twice: the first screenful (what is seen without
 * scrolling or tapping) and the whole page. For Details, Explore and Peace it
 * counts the whole sheet. Nothing here judges whether a screen is good. It
 * says how much there is to read, to weigh and to choose between.
 *
 * It reads the built app in dist/ (run `npm run build` first) and changes nothing.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createEngine } from './src/engine/engine.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dir, 'dist');
const args = process.argv.slice(2), JSON_ONLY = args.includes('--json');
const SHOTS = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('No dist/: run `npm run build` first.'); process.exit(1); }

function findChrome() {
  const cands = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  for (const c of cands) { try { if (fs.existsSync(c) && fs.statSync(c).isFile()) return c; } catch { /* next */ } }
  try { for (const d of fs.readdirSync('/opt/pw-browsers')) { const g = `/opt/pw-browsers/${d}/chrome-linux/chrome`; if (fs.existsSync(g)) return g; } } catch { /* none */ }
  return undefined;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent((req.url || '/').split('?')[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const URL = `http://127.0.0.1:${server.address().port}/`;

const E = createEngine();
const GATE = fs.readFileSync(path.join(__dir, 'public', 'gate.js'), 'utf8').match(/var HASH = '([0-9a-f]{64})'/)[1];
const PLAN = JSON.stringify(E.sanitisePlan(E.example()));

/** Runs in the page: count what is visible inside `root`, optionally only what is inside the viewport. */
function measure({ rootSel, viewportOnly }) {
  const root = rootSel ? document.querySelector(rootSel) : document.body;
  if (!root) return null;
  const vw = innerWidth, vh = innerHeight;
  const shown = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      if (e.classList && e.classList.contains('sr-only')) return false;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    return !viewportOnly || (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw);
  };
  const words = [], sizes = new Map(); let small = 0;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const t = n.nodeValue.trim(); if (!t) continue;
    const el = n.parentElement; if (!el || !shown(el) || el.closest('script,style,noscript')) continue;
    const w = t.split(/\s+/).filter(x => /[A-Za-z0-9£]/.test(x));
    if (!w.length) continue;
    const px = Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10;
    sizes.set(px, (sizes.get(px) || 0) + w.length);
    if (px < 12) small += w.length;
    words.push(...w);
  }
  const numbers = new Set(words.filter(w => /\d/.test(w)).map(w => w.replace(/[.,;:!?)]+$/, '')));
  const sel = 'button, a[href], input, select, textarea, [role="button"], [role="slider"], [role="switch"], [role="tab"], summary';
  const controls = [...root.querySelectorAll(sel)].filter(el => shown(el) && !el.disabled && !(el.parentElement && el.parentElement.closest(sel)));
  // Flesch-Kincaid grade on the visible text (a rough count of syllables is enough to compare one day with the next).
  const text = words.join(' '), sentences = Math.max(1, (text.match(/[.!?](\s|$)/g) || []).length);
  const alpha = words.filter(w => /[A-Za-z]/.test(w));
  const syll = alpha.reduce((a, w) => a + Math.max(1, (w.toLowerCase().replace(/[^a-z]/g, '').replace(/e$/, '').match(/[aeiouy]+/g) || []).length), 0);
  const grade = alpha.length ? 0.39 * (alpha.length / sentences) + 11.8 * (syll / alpha.length) - 15.59 : 0;
  const px = [...sizes.keys()].sort((a, b) => a - b);
  return { words: words.length, numbers: numbers.size, controls: controls.length, sizes: px.length, smallest: px[0] || 0, small, grade: Math.round(grade * 10) / 10,
    labels: controls.map(c => (c.getAttribute('aria-label') || c.textContent || c.getAttribute('name') || c.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)) };
}

const b = await chromium.launch({ executablePath: findChrome(), args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 660 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
const p = await ctx.newPage();
await p.goto(URL);
await p.evaluate(([g, pl]) => { localStorage.setItem('someday-gate-v1', g); localStorage.setItem('horizon-plan-v1', pl); localStorage.setItem('someday-disclaimer-v1', '2026-10'); }, [GATE, PLAN]);
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForSelector('[data-lantern][data-ready="1"], [data-island]', { timeout: 40000 }).catch(() => {});
await p.waitForFunction(() => document.querySelector('[data-answer]')?.getAttribute('data-ready') === '1', null, { timeout: 40000 }).catch(() => {});
await p.waitForTimeout(1200);
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const shot = async (name) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, name + '.png') }); };

const out = {};
out['Home, first screen'] = await p.evaluate(measure, { rootSel: 'body', viewportOnly: true });
await shot('home-first-screen');
out['Home, whole page'] = await p.evaluate(measure, { rootSel: 'body', viewportOnly: false });
if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'home-whole.png'), fullPage: true });

// The two sheets the home opens, and the three tabs.
const sheet = async (label, open) => {
  try {
    await open(); await p.waitForTimeout(1500);
    out[label] = await p.evaluate(measure, { rootSel: '[role="dialog"]', viewportOnly: false });
    await shot(label.toLowerCase().replace(/[^a-z]+/g, '-'));
    await p.keyboard.press('Escape'); await p.waitForTimeout(700);
    if (await p.$('[role="dialog"]')) { await p.keyboard.press('Escape'); await p.waitForTimeout(700); }
  } catch (e) { out[label] = null; if (!JSON_ONLY) console.error(`${label}: could not be opened (${String(e.message).split('\n')[0]})`); }
};
await sheet('What would help?', () => p.getByRole('button', { name: 'What would help?' }).click());
await sheet('What could go wrong?', async () => { await p.getByRole('button', { name: 'What could go wrong?' }).click(); await p.waitForFunction(() => document.querySelectorAll('[data-risk]').length >= 6, null, { timeout: 20000 }).catch(() => {}); });
for (const tab of ['Details', 'Explore', 'Peace']) await sheet(tab, () => p.locator('nav').getByRole('button', { name: tab }).click());

await b.close(); server.close();

const version = E.ENGINE_VERSION || '';
const total = Object.values(out).filter(Boolean).reduce((a, m) => ({ words: a.words + m.words, controls: a.controls + m.controls }), { words: 0, controls: 0 });
if (JSON_ONLY) { console.log(JSON.stringify({ date: new Date().toISOString().slice(0, 10), engine: version, viewport: '390x660', screens: Object.fromEntries(Object.entries(out).map(([k, m]) => [k, m && { ...m, labels: undefined }])) }, null, 2)); }
else {
  console.log(`\nSomeday · how much is on each screen (example couple, 390 × 660, engine ${version})\n`);
  const pad = (s, n) => String(s).padEnd(n), num = (s, n) => String(s).padStart(n);
  console.log(pad('Screen', 24) + num('words', 7) + num('numbers', 9) + num('controls', 10) + num('sizes', 7) + num('smallest', 10) + num('<12px', 7) + num('grade', 7));
  for (const [k, m] of Object.entries(out)) {
    if (!m) { console.log(pad(k, 24) + '  (not measured)'); continue; }
    console.log(pad(k, 24) + num(m.words, 7) + num(m.numbers, 9) + num(m.controls, 10) + num(m.sizes, 7) + num(m.smallest + 'px', 10) + num(m.small, 7) + num(m.grade, 7));
  }
  console.log(`\nAll screens together: ${total.words} words, ${total.controls} controls.`);
  const first = out['Home, first screen'];
  if (first) console.log(`\nThe first screen's controls: ${first.labels.join(' · ')}`);
}
