# RetireLens 2 Design Competition: Final Report

## The 15 Surviving Changes

### Round 1: Calculation Core
1. **LSA cap enforcement** -- PCLS capped at min(25% of uncrystallised, 268,275 minus prior PCLS). Prevents non-compliant tax-free cash above statutory limits.
2. **Scenario relabelling** -- "Conservative/Moderate/Optimistic" renamed to "Below Average/Average/Above Average markets" with 6% top growth rate (was 7%/0% fees). Historically grounded.
3. **MC loading state** -- Implemented in Round 5 as spinner overlay.

### Round 2: Input Model
4. **PCLS on pension screen** -- "Have you already taken your 25% tax-free cash?" moved from review to pension pot screen in plain English.
5. **Combined age screen** -- Age + retirement age on one screen. Wizard reduced from 8 to 7 screens.
6. **Advanced options collapsed** -- Review screen decluttered. Scenario selector visible, advanced options hidden by default.

### Round 3: Output Model
7. **Stepped target line** -- Income chart target steps down at 80 (-25%) and 90 (-35%) to match spending reductions. Prevents misinterpretation.
8. **Event-based narrative timeline** -- "60: You retire. 67: State Pension starts. 80: Spending reduces. 90: Plan succeeds." Replaces generic paragraph.
9. **Compact chart labels** -- All Y-axes use 500k/1.0m format instead of raw numbers.

### Round 4: Decision Support
10. **Tail risk in narrative** -- "In the worst 10% of scenarios, funds run out by age X." One sentence from MC data.
11. **Calculated best action** -- Tests +500/month, retire 1yr later, reduce target 5k. Shows highest-impact action with specific numbers.
12. **Disclaimer** -- "Not regulated financial advice" on results page.

### Round 5: Trust and Compliance
13. **Assumptions summary** -- Collapsible section showing all parameters: growth rate, fees, tax year, PA, withdrawal order, MC iterations, LSA cap.
14. **Disclaimer repositioned** -- Moved from page bottom to directly below hero answer.
15. **Loading spinner** -- "Running 1,000 market scenarios..." during MC calculation.

## Before/After User Journey

### Before (pre-competition)
User enters data across 8 screens. Results show a YES/NO badge with a flat target line, generic paragraph summary, 10+ scrollable sections (many broken), contradictory confidence metrics (100% vs 64.8% vs 54%), and no actionable advice. PCLS is buried in an accordion. No disclaimer. No assumptions visibility. App freezes during MC.

### After (post-competition)
User enters data across 7 screens (age + retirement combined). PCLS asked in plain English on the pension screen. Results show a clear confidence metric ("93 out of 100"), event-based timeline narrative, stepped target line, and one calculated best action. Assumptions are expandable for IFA review. Disclaimer visible below the answer. Spinner during MC. All chart labels compact for mobile. LSA cap enforced on PCLS.

## Residual Disagreements

### 1. Couples tax model (IFAs vs UX)
IFAs wanted per-person tax calculation in the main projection loop. UX argued this requires knowing which pension belongs to which person, adding input complexity. The doubled-threshold shortcut remains. The proper `calculateCouplesTax()` function exists in tax.js but is unused in projections.js.

**Ruling:** The shortcut is adequate for planning estimates. Per-person tax is more accurate but the input burden isn't justified until the tool serves IFAs directly. Noted for roadmap.

### 2. Progressive disclosure / instant estimate (Consumers vs IFAs)
Consumers wanted 3-input instant answer before detailed entry. IFAs warned a 3-input estimate is misleading without partner income, SP, or tax modelling.

**Ruling:** Deferred. A rough estimate clearly labelled as "incomplete" could work but requires UI architecture changes. The current 7-screen wizard is acceptable.

### 3. Survivor modelling (All factions agree it's important)
What happens to the surviving partner if one person dies at 70? All factions agreed this is a critical gap for couples. Not implemented due to scope.

**Ruling:** Priority #1 for the next round. The data model already has separate person objects. The engine needs a "survivor projection" mode.

### 4. Salary sacrifice mechanics (IFAs wanted it, others didn't)
Employer NI savings from salary sacrifice can add 13.8% to contributions. Material for high earners. Consumer and UX factions considered it niche.

**Ruling:** Deferred. Nice-to-have, not must-have. Could be a checkbox: "Are your contributions via salary sacrifice?" with automatic NI saving calculation.

### 5. MPAA enforcement (IFAs demanded, UX cautioned)
Taking flexible income triggers MPAA (10,000 annual allowance). The tool doesn't distinguish between PCLS-only (no MPAA) and flexi-access (MPAA triggered).

**Ruling:** Deferred. Needs a clearly worded question about flexible access that consumers can understand. Not just "Have you triggered MPAA?" (jargon).

## Proposed Roadmap: Next 5 Rounds

### Round 6: Survivor Modelling
What happens to Carol if you die at 70, 75, 80? Survivor projection showing her income from: her own SP, her own DB, beneficiary drawdown from your pension, ISA inheritance (spouse exempt from IHT). IHT implications from April 2027 pension inclusion.

### Round 7: Input Consolidation
Reduce wizard to 4-5 screens. Combine pensions (DC + DB + PCLS) into one screen. Combine ISA + SP into one screen. Progressive disclosure: show instant estimate from 3 inputs, then "improve your estimate" with optional extras.

### Round 8: What-If Scenarios
Live sliders: retirement age +/- 2 years, contributions +/- 500/month, target income +/- 5k. Deterministic update in under 200ms. Save and compare up to 3 scenarios.

### Round 9: PDF Export and Sharing
Generate PDF report with: inputs summary, narrative timeline, income chart, data table, assumptions, disclaimer. "Share with partner" button. "Take to your IFA" button.

### Round 10: Annuity Comparison
Model annuity vs drawdown for part or all of the pension. Show: guaranteed annuity income at current rates, vs drawdown with market risk. Partial annuity (secure the essential spending, draw down the discretionary). Inflation-linked vs level annuity comparison.
