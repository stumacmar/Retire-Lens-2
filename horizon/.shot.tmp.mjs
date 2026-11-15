import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core'; import { createEngine } from './src/engine/engine.js';
const __dir = path.dirname(fileURLToPath(import.meta.url)); const DIST = path.join(__dir, 'dist'); const E = createEngine();
const GATE_HASH = fs.readFileSync(path.join(__dir, 'public', 'gate.js'), 'utf8').match(/var HASH = '([0-9a-f]{64})'/)[1];
const F = E.freshStart(), D = E.defaults();
const STRUCT = { on: true, ladderYears: 7, refill: 'whenUp', refillMin: 0, equityReal: 0.05, equitySd: 0.16, goldReal: 0.01, goldSd: 0.14, goldPct: 0.15, giltReal: 0.015, rulesOn: true, longevityAge: 95, cutBelow: 0.90, cutBy: 0.10, raiseAbove: 1.25, raiseBy: 0.05, raiseLagYears: 2, floorMult: 0.75, capMult: 1.25, parachuteOn: true, parachuteBelow: 0.75, parachuteFrom: 80, parachuteFraction: 0.5 };
const stuart = { ...F.partnerA, birthYear: 1970, pension: 570000, monthlyPension: 3200, isa: 48000, spAmount: 12548 };
const carol = { ...F.partnerB, ...D.partnerB, name: 'Partner', isa: 72000 };
const owner = (over = {}) => E.sanitisePlan({ ...F, approach: 'traditional', retireYear: 2030, targetNet: 60000, partnerA: stuart, partnerB: carol, ...over });
const plans = { owner: owner(), short: owner({ targetNet: 78000 }), comfy: owner({ targetNet: 48000 }), single: owner({ household: 'single' }),
  struct: owner({ approach: 'derisking', architecture: { ...F.architecture, ...STRUCT } }), stop75: owner({ retireYear: 2045 }),
  young: E.sanitisePlan({ ...F, approach: 'traditional', household: 'single', retireYear: 2028, targetNet: 30000, partnerA: { ...F.partnerA, birthYear: 1986, pension: 300000, isa: 200000, monthlyPension: 800 } }) };
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => { let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html'); res.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, r)); const URL = `http://127.0.0.1:${server.address().port}/`;
const out = process.argv[2], tag = process.argv[3] || 'x', want = (process.argv[4] || 'owner').split(','), sizes = (process.argv[5] || '390x844').split(',').map(s => s.split('x').map(Number)), schemes = (process.argv[6] || 'light').split(','), dsf = Number(process.argv[7] || 2), drag = process.argv[8];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
let bad = 0;
for (const scheme of schemes) for (const [w, h] of sizes) for (const name of want) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, colorScheme: scheme, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.evaluate(([hh, pl]) => { localStorage.clear(); localStorage.setItem('someday-gate-v1', hh); localStorage.setItem('someday-disclaimer-v1', '2026-10'); localStorage.setItem('horizon-plan-v1', pl); }, [GATE_HASH, JSON.stringify(plans[name])]);
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForSelector('[data-answer][data-ready="1"]', { timeout: 40000 }).catch(() => console.log('not ready', name));
  await p.waitForTimeout(1200);
  if (drag === 'windows') { await p.locator('[data-see-futures]').click(); await p.waitForTimeout(900); }
  else if (drag) { const box = await p.locator('[data-ring] [role=slider]').boundingBox(); await p.mouse.click(box.x + box.width * 0.93, box.y + box.height * 0.6); await p.waitForTimeout(300); }
  const r = await p.evaluate(() => { const nav = document.querySelector('nav').getBoundingClientRect(); const q = [...document.querySelectorAll('[data-simple-home] button')].find(x => /What could go wrong/.test(x.textContent)).getBoundingClientRect(); const home = document.querySelector('[data-simple-home]'); const o = document.querySelector('[data-ring]'); const sq = o.querySelector('[role=slider]').getBoundingClientRect();
    return { slack: Math.round(nav.top - q.bottom), hscroll: home.scrollWidth > home.clientWidth + 1, paint: `ring ${Math.round(sq.width)}`, age: o.getAttribute('data-age'), drop: document.querySelector('[data-ring-reading]').textContent, end: document.querySelector('[data-futures]').textContent.slice(0, 70), status: document.querySelector('[data-status]').textContent }; });
  const flag = r.slack < 0 || r.hscroll || errs.length; if (flag) bad++;
  console.log(`${flag ? '✗' : ' '} ${w}x${h} ${scheme} ${name.padEnd(7)} slack ${String(r.slack).padStart(4)} paint ${r.paint} · ${r.drop} · ${r.end} · ${r.status} ${errs.join(';')}`);
  if (out) await p.screenshot({ path: path.join(out, `${tag}-${name}-${w}x${h}-${scheme}.png`) });
  await ctx.close();
}
console.log(bad ? `${bad} problems` : 'all fit'); await b.close(); server.close();
