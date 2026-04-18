# Round 5: TRUST AND COMPLIANCE

Disclaimers, assumptions log, exportable report for IFA review.

## Faction A (IFAs) -- Top 3 Demands

### A1: Assumptions log -- show every assumption used in the calculation
The results page shows outcomes but not the inputs and assumptions that produced them. An IFA reviewing this needs to see: growth rate used, fee rate, inflation, tax bands, SP amount, DB escalation rate, withdrawal strategy, spending reduction ages. All on one page.

### A2: Exportable report for IFA review
The consumer should be able to generate a PDF or printable summary that they can take to their IFA. This should include: inputs, assumptions, projections, charts, risk analysis, and the disclaimer. The jspdf dependency is already installed.

### A3: Tax year and regulatory date stamp
The tool uses 2025/26 tax bands. It should state this clearly: "Based on HMRC rules for tax year 2025/26. Tax rules may change." If the tool is used in 2027/28, the user should see a warning that the tax data may be outdated.

## Faction B (Consumers) -- Top 3 Demands

### B1: Tell me what numbers I entered -- a summary I can check
Before I trust the results, I want to see my inputs clearly: "You entered: Age 56, retiring at 60, target 60,000, pension 595,000, partner age 63, partner DB 4,500." If any of these are wrong, I can go back and fix them.

### B2: A version I can print or email to my spouse
Carol needs to see this too. A print-friendly view or PDF that shows the narrative, key numbers, and charts.

### B3: Tell me when to come back and check again
"Review your plan in April 2027 after your pension statement arrives" is more useful than "review annually."

## Faction C (UX) -- Top 3 Demands

### C1: Show assumptions inline, not on a separate page
The assumptions should be visible as footnotes or an expandable section at the bottom of results, not a separate page the user has to navigate to.

### C2: The disclaimer should be above the fold, not at the bottom
Currently the disclaimer is at the very bottom of the results page. It should be visible without scrolling. A subtle banner at the top of results or immediately below the hero answer.

### C3: Loading spinner during Monte Carlo
1000 iterations with couples logic takes 3-5 seconds. Show a spinner with "Running 1,000 market scenarios..." This was agreed in Round 1 but not implemented.

---

## Cross-Faction Attacks

### On A1 (assumptions log):
- **B attacks**: "I don't want to read a table of assumptions. Just tell me what matters."
- **C attacks**: "Collapsible section at bottom of results. Expanded for IFA review, collapsed for consumers."

### On A2 (PDF export):
- **B attacks**: "Yes! I want to print this for Carol."
- **C attacks**: "jspdf is installed. Wire it to a button. The print should include the narrative + data table + disclaimer."

### On A3 (tax year stamp):
- **B attacks**: "Good. I want to know the numbers are current."
- **C attacks**: "Add to the disclaimer: 'Tax year 2025/26 rates. Check gov.uk for current rates.'"

### On B1 (input summary):
- **A attacks**: "The review screen already shows this."
- **C attacks**: "Add a collapsible 'Your inputs' section at the bottom of results. Same data as review screen."

### On C2 (disclaimer position):
- **A attacks**: "Correct. The disclaimer is a trust signal. It should be visible."
- **B attacks**: "Don't scare me before I see the results. Put it after the hero answer, before the narrative."

### On C3 (loading spinner):
- **A attacks**: "Agreed. Quick win."
- **B attacks**: "Yes, I thought the app crashed."

---

## Synthesis: Round 5 Changes

### Change 5.1: Assumptions summary as collapsible section on results
Show all key assumptions used: growth rate, fee rate, inflation, tax year, SP amount, withdrawal strategy, spending reductions. Collapsed by default. Expandable for IFA review.
- Files: js/app.js, index.html
- Priority: HIGH (transparency)

### Change 5.2: Move disclaimer to below hero answer
Move the disclaimer from bottom of page to directly below the confidence metric, before the narrative timeline. Subtle but visible.
- Files: index.html, js/app.js
- Priority: HIGH (trust)

### Change 5.3: Loading spinner during Monte Carlo
"Running 1,000 market scenarios..." with a spinner overlay during calculation.
- Files: js/app.js, index.html
- Priority: MEDIUM (UX polish)

---

## Ranked Code Changes

1. **Assumptions summary** -- transparency for both consumers and IFAs
2. **Disclaimer repositioned** -- trust signal above the fold
3. **Loading spinner** -- prevents "app is broken" perception
