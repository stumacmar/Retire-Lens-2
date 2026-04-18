# Round 1: CALCULATION CORE

## Faction A (IFAs) -- Top 3 Demands

### A1: Couples tax model is dangerously wrong
The engine doubles PA and all tax band thresholds for couples (projections.js line 404-410). This assumes income can be split perfectly between partners. In reality, pension income is taxed on the person who owns the pension. A household with one partner earning 80k and the other earning 0 pays far more tax than two partners each earning 40k. The current model understates tax for asymmetric couples by thousands per year.

### A2: No LSA/LSDBA cap enforcement
PCLS is uncapped at 25% of pot. Post-LTA, the Lump Sum Allowance is 268,275 and the LSDBA is 1,073,100. A user with a 1.5M pot would get 375k PCLS in the model but only 268,275 is actually tax-free. The excess would be taxed at marginal rate. This is a material compliance error.

### A3: No MPAA enforcement
A user who has already flexibly accessed their pension (which the "PCLS already taken" checkbox implies) triggers the Money Purchase Annual Allowance of 10,000. The model allows unlimited future contributions. For a user contributing 36k/year who has triggered MPAA, this overstates accumulation by 26k/year.

## Faction B (Consumers) -- Top 3 Demands

### B1: I don't understand if 7% growth is realistic
The model offers Conservative (3%), Moderate (4%), Optimistic (7%) but gives no context for what's historically realistic. 7% real with 0% fees is aggressive. The consumer picks the one that makes them feel best and gets a dangerously optimistic projection.

### B2: What happens if I die before my partner?
There's no survivor modelling. If I die at 70, Carol loses my pension drawdown income but keeps her own SP, DB, and ISA. What's her position? This is the single biggest fear for couples and the model ignores it.

### B3: The numbers change every time I reload
Auto-save restores a previous session which may have stale data from before new inputs were added. The user sees numbers from a previous run and thinks they're current. Confusing and erosion of trust.

## Faction C (UX) -- Top 3 Demands

### C1: Monte Carlo results are not actionable
"40 out of 100 scenarios support your plan" tells the user they might fail but not what to do about it. The MC should show: "If you reduce spending by 5k/year, success rises to 78 out of 100." Without a lever to pull, the MC just creates anxiety.

### C2: The data table is too wide for mobile
10 columns on a 375px screen. The user scrolls horizontally and loses context. Most columns show dashes during accumulation. The table should be responsive: fewer columns on mobile, expandable rows for detail.

### C3: No loading state during Monte Carlo
1000 MC iterations can take 2-5 seconds. The UI freezes with no feedback. The user thinks the app crashed and clicks Calculate again.

---

## Cross-Faction Attacks

### On A1 (couples tax):
- **B attacks**: "You're making the tool worse for me. The doubled-PA model gives me a reasonable estimate. If you make it show higher tax, I'll panic and the projection will look worse than reality because my IFA can help me split income."
- **C attacks**: "Proper per-person tax requires asking which pension belongs to which person. That's 4 more inputs. The cognitive load increase isn't justified for the accuracy gain in most cases."

### On A2 (LSA/LSDBA):
- **B attacks**: "I don't know what LSA means. Don't make me learn another acronym. Just cap the PCLS if it hits the limit."
- **C attacks**: "Agreed this should be enforced but it should be invisible. Cap the PCLS at 268,275 and show a note explaining why it's less than 25%."

### On A3 (MPAA):
- **B attacks**: "I don't know if I've triggered MPAA. How would I know?"
- **C attacks**: "The PCLS already taken checkbox doesn't necessarily mean MPAA is triggered. Taking PCLS alone doesn't trigger MPAA. Only flexi-access drawdown triggers it. We need a separate, clearly worded question."

### On B1 (growth realism):
- **A attacks**: "Correct concern but the answer isn't to remove optimistic. It's to show historical context: UK equities returned ~5% real over 100 years. 7% with 0% fees is unrealistic. We should set optimistic to 5-6% with realistic fees."
- **C attacks**: "The scenario names are the problem. 'Optimistic' implies it's achievable. Better labels: 'Below average markets', 'Average markets', 'Above average markets' with historical footnotes."

### On B2 (survivor):
- **A attacks**: "Essential for couples advice. The survivor needs to know: do they keep the ISA (yes, spouse exemption), do they keep the pension (yes, beneficiary drawdown), does their own SP/DB continue (yes). The model should show a survivor scenario."
- **C attacks**: "This is a whole new projection mode. For Round 1 (calculation core), we should note it as a gap and address it in Round 4 (decision support)."

### On B3 (stale data):
- **A attacks**: "Agreed. Stale auto-save is dangerous. Show a 'data restored from [date]' banner and let the user confirm or clear."
- **C attacks**: "Agreed. Add a visible timestamp to restored sessions. The Reset button exists but users don't scroll to the footer to find it."

### On C1 (MC actionability):
- **A attacks**: "This is not a calculation core issue. The MC is mathematically correct. Actionability belongs in Round 4."
- **B attacks**: "I agree but I also want to know: is 40 out of 100 good or bad? What's normal? Give me a benchmark."

### On C2 (table width):
- **A attacks**: "Not a calculation issue. The table data is correct."
- **B attacks**: "Agreed. I can't use the table on my phone."

### On C3 (loading state):
- **A attacks**: "Not a calculation issue."
- **B attacks**: "Agreed. The app looks broken during calculation."

---

## Defences and Concessions

### A1 Defence: IFAs concede that per-person tax requires knowing which pensions belong to which person. However, the current model should at minimum track each person's taxable income separately since we already have separate DC/DB/SP for each person. The data IS there; the engine just doesn't use it.

### A2 Defence: IFAs accept invisible enforcement. Cap PCLS at min(25% of pot, 268,275). Show a note only when the cap bites.

### A3 Defence: IFAs concede PCLS alone doesn't trigger MPAA. But "PCLS already taken" likely means the user HAS accessed flexibly. Add a clear question: "Have you taken any income from your pension (not just tax-free cash)?" If yes, cap future contributions at 10,000/year in the model.

### B1 Defence: Consumers accept better labelling but want to keep a high scenario "to see what's possible."

### B2 Deferred: Survivor modelling deferred to Round 4.

### B3 Defence: All factions agree. Add timestamp to restored sessions.

### C1 Deferred: MC actionability deferred to Round 4.

### C2 Deferred: Table responsiveness deferred to Round 3.

### C3 Defence: All factions agree this is a quick win.

---

## Synthesis: Round 1 Changes

### Change 1.1: Enforce LSA cap on PCLS (268,275)
Cap tax-free PCLS at the lesser of 25% of uncrystallised pot and 268,275. If cap bites, show a note in the narrative: "Your tax-free cash is capped at 268,275 (the Lump Sum Allowance)."
- Files: engine/projections.js, engine/withdrawals.js
- Priority: HIGH (compliance)

### Change 1.2: Scenario labels and realistic growth rates
Rename scenarios: "Below Average" (3%), "Average" (4%), "Above Average" (6%). Remove 7%/0% fee optimistic as unrealistic. Add historical footnote: "UK equities have returned approximately 5% real over the long term."
- Files: engine/assumptions.js, config/defaults.js, index.html
- Priority: HIGH (consumer trust)

### Change 1.3: Add loading spinner during Monte Carlo
Show "Running 1,000 market scenarios..." with a spinner overlay during MC calculation. Use requestAnimationFrame to keep the UI responsive.
- Files: js/app.js, css/main.css
- Priority: MEDIUM (UX polish)

---

## Ranked Code Changes

1. **LSA cap enforcement** -- compliance risk if uncapped
2. **Scenario relabelling** -- consumer trust risk if 7%/0% fee is default-available
3. **MC loading state** -- UX polish, quick win
