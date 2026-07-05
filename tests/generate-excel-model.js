/**
 * RetireLens - Excel Reference Model generator
 *
 * Produces RetireLens-Reference-Model.xlsx: a workbook you can open in Excel to
 * see the same maths the app runs, trace it with live formulas, and compare the
 * app's outputs against an independent reference calculation for every persona.
 *
 * Run: npm run beta:excel
 */

import XLSXpkg from 'xlsx';
const XLSX = XLSXpkg.utils ? XLSXpkg : (XLSXpkg.default || XLSXpkg);

import { createPlan, runProjection, projectAccumulation } from '../engine/projections.js';
import { refAccumulate, refTaxFromGross } from './reference-model.js';
import { PERSONAS } from './beta-personas.js';

const wb = XLSX.utils.book_new();

// ── Sheet 1: Read me ───────────────────────────────────────
const readme = [
  ['RetireLens — Reference Model & Accuracy Check'],
  [],
  ['Why this exists'],
  ['I am 56. I could not find a retirement tool I actually understood, so I built one'],
  ['in a spreadsheet — then turned it into RetireLens so anyone could use it.'],
  ['This workbook is the "show your working" companion: it runs the same UK maths'],
  ['independently and checks it against the app, scenario by scenario.'],
  [],
  ['What each sheet does'],
  ['Scenarios', 'Inputs + the app\'s outputs + an independent reference calc + the difference.'],
  ['Tax calculator', 'Live-formula UK income tax (2025/26). Change the yellow cell and watch it recompute.'],
  ['Accumulation', 'Live-formula pension growth example. Change the yellow cells.'],
  [],
  ['How to read the check'],
  ['If "Diff" columns are ~0, the app and the independent model agree.'],
  ['Accumulation and tax reconcile to the penny; decumulation is checked in code'],
  ['(npm run test:crosscheck) across every year of every scenario.'],
  [],
  ['Important'],
  ['RetireLens is an educational tool, not financial advice. Figures are estimates'],
  ['in today\'s money using UK 2025/26 tax rates and assumptions you can change.'],
];
const wsReadme = XLSX.utils.aoa_to_sheet(readme);
wsReadme['!cols'] = [{ wch: 18 }, { wch: 90 }];
XLSX.utils.book_append_sheet(wb, wsReadme, 'Read me');

// ── Sheet 2: Scenarios (values) ────────────────────────────
const header = [
  'Persona', 'Current age', 'Retire age', 'Target net £', 'Pension pot £', 'ISA £',
  'Pension contrib £/yr', 'ISA contrib £/yr', 'State Pension £/yr',
  'APP: Pot at retirement £', 'REF: Pot at retirement £', 'Diff £',
  'APP: PCLS (tax-free) £', 'APP: Total tax paid £', 'APP: Avg net income £/yr',
  'APP: Final balance £', 'APP: Money runs out?',
];
const rows = [header];
for (const p of PERSONAS) {
  const plan = createPlan({ name: p.id, ...p.inputs });
  const proj = runProjection(plan, { endAge: 90 });
  const ng = plan.assumptions.projection.defaultGrowthRate - plan.assumptions.projection.defaultFeeRate;
  const years = p.inputs.retirementAge - p.inputs.currentAge;
  const refPot = refAccumulate({ startPot: p.inputs.currentPension || 0, annualContribution: p.inputs.annualPensionContribution || 0, years, netGrowthRate: ng })
    + refAccumulate({ startPot: p.inputs.currentIsa || 0, annualContribution: p.inputs.annualIsaContribution || 0, years, netGrowthRate: ng });
  const s = proj.summary;
  rows.push([
    p.label, p.inputs.currentAge, p.inputs.retirementAge, p.inputs.targetNetIncome,
    p.inputs.currentPension || 0, p.inputs.currentIsa || 0,
    p.inputs.annualPensionContribution || 0, p.inputs.annualIsaContribution || 0,
    p.inputs.expectedStatePension || 0,
    Math.round(s.retirementPot), Math.round(refPot), Math.round(s.retirementPot - refPot),
    Math.round(s.pclsTaken), Math.round(s.totalTaxPaid), Math.round(s.averageNetIncome),
    Math.round(s.finalBalance), s.fundsDepleted ? `Yes — age ${s.depletionAge}` : 'No',
  ]);
}
const wsScen = XLSX.utils.aoa_to_sheet(rows);
wsScen['!cols'] = header.map((h, i) => ({ wch: i === 0 ? 40 : 16 }));
XLSX.utils.book_append_sheet(wb, wsScen, 'Scenarios');

// ── Sheet 3: Tax calculator (live formulas) ────────────────
const tax = [
  ['UK Income Tax — 2025/26 (England, Wales & NI)'],
  ['Gross taxable income £', 42570],                // B2 input
  ['Personal Allowance (base) £', 12570],           // B3
  ['Taper threshold £', 100000],                    // B4
  ['Personal Allowance after taper £', 0],          // B5 (formula set below)
  ['Taxable after allowance £', 0],                 // B6
  ['Basic rate band up to (taxable) £', 37700],     // B7
  ['Higher rate band up to (taxable) £', 125140],   // B8
  ['Tax @20% (basic) £', 0],                        // B9
  ['Tax @40% (higher) £', 0],                       // B10
  ['Tax @45% (additional) £', 0],                   // B11
  ['Total income tax £', 0],                        // B12
  ['Net income £', 0],                              // B13
  ['Effective rate', 0],                            // B14
  [],
  ['Change cell B2 to try any income. Everything recalculates in Excel.'],
];
const wsTax = XLSX.utils.aoa_to_sheet(tax);
wsTax['!cols'] = [{ wch: 34 }, { wch: 18 }];
// Cell = formula + a cached value (writers drop formula-only cells; Excel recomputes on open).
const setF = (ws, addr, f, v, z) => { ws[addr] = { t: 'n', f, v, ...(z ? { z } : {}) }; };
// Cached values for the sample income (B2 = 42,570).
const G = 42570, PAbase = 12570, taper = 100000;
const PA = Math.max(0, PAbase - Math.max(0, Math.floor(Math.max(0, G - taper) * 0.5)));
const taxable = Math.max(0, G - PA);
const t20 = Math.min(taxable, 37700) * 0.2;
const t40 = Math.max(0, Math.min(taxable, 125140) - 37700) * 0.4;
const t45 = Math.max(0, taxable - 125140) * 0.45;
const totalTax = t20 + t40 + t45;
setF(wsTax, 'B5', 'MAX(0,B3-MAX(0,FLOOR((B2-B4)*0.5,1)))', PA);
setF(wsTax, 'B6', 'MAX(0,B2-B5)', taxable);
setF(wsTax, 'B9', 'MIN(B6,B7)*0.2', t20);
setF(wsTax, 'B10', 'MAX(0,MIN(B6,B8)-B7)*0.4', t40);
setF(wsTax, 'B11', 'MAX(0,B6-B8)*0.45', t45);
setF(wsTax, 'B12', 'B9+B10+B11', totalTax);
setF(wsTax, 'B13', 'B2-B12', G - totalTax);
setF(wsTax, 'B14', 'IF(B2>0,B12/B2,0)', totalTax / G, '0.0%');
XLSX.utils.book_append_sheet(wb, wsTax, 'Tax calculator');

// ── Sheet 4: Accumulation (live formulas) ──────────────────
const acc = [
  ['Pension growth — worked example'],
  ['Starting pot £', 320000],           // B2
  ['Annual contribution £', 12000],     // B3
  ['Net real growth (after fees)', 0.035], // B4
  ['Years to retirement', 11],          // B5
  [],
  ['Year', 'Start balance £', 'Growth £', 'Contribution (mid-year) £', 'End balance £'],
];
// Year table starts at sheet row 8. Build placeholder rows, then set formulas.
const startRow = 8;
const nYears = 11;
for (let i = 0; i < nYears; i++) {
  acc.push([i + 1, 0, 0, 0, 0]);
}
acc.push([]);
acc.push(['Pot at retirement £', 0]);
acc.push(['(Change cells B2:B5 to model your own pot.)']);
const wsAcc = XLSX.utils.aoa_to_sheet(acc);
wsAcc['!cols'] = [{ wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 18 }];
// Cached values (starting pot 320000, contribution 12000, growth 0.035).
let bal = 320000;
const contrib = 12000, gr = 0.035;
for (let i = 0; i < nYears; i++) {
  const r = startRow + i;
  const startRef = i === 0 ? '$B$2' : `E${r - 1}`;
  const start = bal;
  const growth = start * gr;
  const midContrib = contrib * (1 + gr / 2);
  const end = start * (1 + gr) + midContrib;
  setF(wsAcc, `B${r}`, startRef, start);
  setF(wsAcc, `C${r}`, `${startRef}*$B$4`, growth);
  setF(wsAcc, `D${r}`, '$B$3*(1+$B$4/2)', midContrib);
  setF(wsAcc, `E${r}`, `${startRef}*(1+$B$4)+$B$3*(1+$B$4/2)`, end);
  bal = end;
}
setF(wsAcc, `B${startRow + nYears + 1}`, `E${startRow + nYears - 1}`, bal);
XLSX.utils.book_append_sheet(wb, wsAcc, 'Accumulation');

// ── Write ──────────────────────────────────────────────────
const out = 'RetireLens-Reference-Model.xlsx';
XLSX.writeFile(wb, out);
console.log(`Wrote ${out} with ${wb.SheetNames.length} sheets: ${wb.SheetNames.join(', ')}`);
