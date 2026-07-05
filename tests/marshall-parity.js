/**
 * RetireLens 4 ↔ Marshall workbook parity check.
 *
 * Runs the RetireLens 4 engine with the Marshall defaults and compares its
 * headline outputs to the values cached in the owner's Excel model (Base 7%).
 * This is the yardstick: any engine change must keep these agreeing. Figures
 * that drift more than the tolerance are flagged NEEDS FIXING.
 *
 * Run: npm run test:parity
 */

import { Engine } from '../v4/engine.js';

// Values read straight from the Marshall workbook's cached results (Base 7%).
const EXCEL = {
  pensionTotalAtRetire: 969125,   // Accumulation D21
  isaTotalAtRetire: 122873,       // Accumulation D28
  year1NetIncome: 60000,          // Drawdown M10
  survives: true,                 // Drawdown M50 = "Pot survives to 2055"
  pension2050: 1714162,           // Drawdown O30 (Stuart SIPP EOY 2050)
};

const P = Engine.defaults();
const acc = Engine.accumulate(P).atRetirement;
const dd = Engine.drawdown(P);
const row2050 = dd.rows.find(r => r.year === 2050) || {};

const f = n => '£' + Math.round(n).toLocaleString();
const pct = (a, b) => b === 0 ? 0 : ((a - b) / b) * 100;

const checks = [
  ['Total pension at retirement', acc.pensionA + acc.pensionB, EXCEL.pensionTotalAtRetire, 2],
  ['Total ISA at retirement',     acc.isaA + acc.isaB,          EXCEL.isaTotalAtRetire,     2],
  ['Year-1 net income',           dd.rows[0].netIncome,         EXCEL.year1NetIncome,       2],
  ['Pension pot in 2050',         (row2050.potA || 0) + (row2050.potB || 0), EXCEL.pension2050, 3],
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('  RETIRELENS 4  ↔  MARSHALL EXCEL  — parity (Base 7%)');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log('  Item                          RetireLens 4      Your Excel     Diff');
console.log('  ────────────────────────────  ────────────  ────────────  ───────');

let flagged = 0;
for (const [name, got, want, tol] of checks) {
  const d = pct(got, want);
  const ok = Math.abs(d) <= tol;
  if (!ok) flagged++;
  console.log(
    '  ' + name.padEnd(28) +
    '  ' + f(got).padStart(12) +
    '  ' + f(want).padStart(12) +
    '  ' + (d >= 0 ? '+' : '') + d.toFixed(1) + '%  ' + (ok ? '✓' : '⚠ NEEDS FIXING')
  );
}

const survives = dd.exhaustedYear == null;
const survOk = survives === EXCEL.survives;
if (!survOk) flagged++;
console.log('  ' + 'Money lasts the plan'.padEnd(28) +
  '  ' + (survives ? 'survives' : `runs out ${dd.exhaustedYear}`).padStart(12) +
  '  ' + 'survives'.padStart(12) + '        ' + (survOk ? '✓' : '⚠'));

console.log('\n───────────────────────────────────────────────────────────────');
console.log(flagged === 0
  ? '  ✓ All headline figures agree with the Marshall workbook.'
  : `  ⚠ ${flagged} figure(s) disagree with the workbook — to fix during the redo.`);
console.log('  Note: small pot differences reflect contribution-timing (Excel uses');
console.log('  46 months from Jul-26 + transfers; TODAY()-based year fraction).');
console.log('═══════════════════════════════════════════════════════════════');
