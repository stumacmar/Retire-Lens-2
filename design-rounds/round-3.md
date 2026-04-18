# Round 3: OUTPUT MODEL

What the user sees: charts, numbers, probability bands, narrative.

## Faction A (IFAs) -- Top 3 Demands

### A1: Show income in real AND nominal terms
All figures are in today's money (real terms, after 2% inflation). This is correct for planning but confusing for consumers who will actually receive larger nominal amounts. At age 80 the model shows 45,000 but the actual pounds received will be ~73,000 in nominal terms. The user should be able to toggle between real and nominal views. At minimum, add a clear label: "All figures in today's money. Actual amounts received will be higher due to inflation."

### A2: The income chart should show the spending reduction visually
The target net income line is flat at 60,000 across all years. But spending drops to 45,000 at 80 and 39,000 at 90. The target line should step down at these ages to show the user visually that their required income decreases. Currently the chart makes it look like income falls short after 80 when in fact it matches the reduced target.

### A3: Show withdrawal rate per year, not just at retirement
The headline withdrawal rate is calculated at retirement (60,000 / retirement pot). But the actual rate changes every year as the pot grows/shrinks and guaranteed income kicks in. Show this on the data table: a column showing the effective withdrawal rate each year. This is the number IFAs use to assess sustainability.

## Faction B (Consumers) -- Top 3 Demands

### B1: The narrative summary is too generic
"Your money lasts to age 90 with X remaining" is good but doesn't tell me the key events. I want to see: "At 60, Carol's pensions start covering 16,000/year. At 67, your State Pension adds another 12,000. After that, you only need 30,000/year from your pension pot." A timeline of events, not just an outcome.

### B2: The data table needs fewer columns on mobile
I can't read 10 columns on my phone. Show me: Age, Start, In/Out, End. Let me tap a row to see the detail. Or collapse to 4 columns on mobile and show a "tap for detail" hint.

### B3: What's the minimum I need in my pension to make this work?
The tool tells me if my plan works but not the minimum pot I'd need. "You need at least 400,000 at retirement to sustain 60,000/year." This is the number that answers "how much more do I need to save?"

## Faction C (UX) -- Top 3 Demands

### C1: The income chart needs better colours and a legend that fits mobile
State Pension and PCLS Spending use very similar greens. On a small screen the legend wraps to 3 lines. Use more distinct colours and a single-line legend with abbreviated labels.

### C2: The wealth chart should mark key events
The pension/ISA balance chart is a bare line. Mark retirement age, state pension start, and spending reduction ages with vertical annotations. "You retire here", "State Pension starts", "Spending reduces". These markers turn a chart into a story.

### C3: The fan chart Y-axis needs human-readable labels
The MC fan chart shows Portfolio Value in raw pounds (e.g., 3,000,000). Use compact format: 3M, 1.5M, 500k. The current labels overflow on mobile.

---

## Cross-Faction Attacks

### On A1 (real/nominal):
- **B attacks**: "Don't confuse me with two views. Just tell me what I need to know. Keep real terms and explain clearly."
- **C attacks**: "A toggle adds cognitive load. The current approach (real terms with a footnote) is standard. Improve the footnote, don't add a toggle."

### On A2 (stepped target line):
- **B attacks**: "This would help me understand what's happening at 80. Currently I see the bars drop and think I'm running out of money."
- **C attacks**: "Agreed. Simple CSS change to make the target line step down. High impact, low effort."

### On A3 (withdrawal rate per year):
- **B attacks**: "I don't know what a withdrawal rate is. Don't add another column I can't understand."
- **C attacks**: "Not as a visible column for everyone. Add it as a tooltip or detail view for advanced users."

### On B1 (timeline narrative):
- **A attacks**: "Good idea but the narrative must be factually accurate and not oversimplify. Show the timeline of events with correct amounts."
- **C attacks**: "Agreed. Replace the generic narrative with a timeline of key events: age, what happens, impact on income."

### On B2 (mobile table):
- **A attacks**: "The data must remain accessible. Don't remove columns, make them available on tap."
- **C attacks**: "On mobile (<600px), show 4 columns: Age, Start, Net Change, End. Row tap expands to full detail. On desktop, show all columns."

### On B3 (minimum pot):
- **A attacks**: "This is a reverse calculation -- find the pot that makes success rate >= 100%. It's computationally simple: binary search on pot size. Useful output."
- **C attacks**: "Great feature but not a Round 3 output change. It's a new calculation mode. Defer to roadmap."

### On C1 (chart colours):
- **A attacks**: "Not a calculation issue. Improve as needed."
- **B attacks**: "Yes, the greens look the same on my phone."

### On C2 (wealth chart markers):
- **A attacks**: "Good idea. Mark retirement, SP start, partner SP start, and spending reduction ages."
- **B attacks**: "This would make the chart actually useful to me."

### On C3 (fan chart labels):
- **A attacks**: "Not a calculation issue."
- **B attacks**: "Yes, 3,000,000 means nothing to me. Show 3M."

---

## Defences and Concessions

### A1: IFAs concede. Keep real terms only, improve the footnote.
### A2: All factions agree. Step the target line down at 80 and 90.
### A3: IFAs concede. Withdrawal rate as tooltip on data table, not a column.
### B1: All factions agree. Event-based timeline narrative.
### B2: All factions agree. Responsive table: 4 columns on mobile.
### B3: Deferred to roadmap (reverse calculation mode).
### C1: All agree. Better chart colours.
### C2: All agree. Markers on wealth chart.
### C3: All agree. Compact Y-axis labels.

---

## Synthesis: Round 3 Changes

### Change 3.1: Step the target income line at spending reduction ages
The dashed target line on the income chart should step down from 60,000 to 45,000 at age 80, and to 39,000 at age 90. Currently it's flat, making it look like income falls short after 80.
- Files: js/app.js (renderCashflowChart)
- Priority: HIGH (prevents misinterpretation)

### Change 3.2: Event-based narrative replacing generic summary
Replace "Your money lasts to age 90" with a timeline:
"Age 60: You retire. Carol's State Pension (11,973) and DB pension (4,500) start immediately.
Age 67: Your State Pension starts (11,973). Pension withdrawal drops from 52k to 30k.
Age 80: Spending reduces to 45,000. Pension withdrawal drops further.
Age 90: Final balance 1.3M (pension 900k + ISA 400k)."
- Files: js/app.js (renderNarrativeSummary)
- Priority: HIGH (consumer comprehension)

### Change 3.3: Compact Y-axis labels on all charts
Use k/M format: 500k, 1.0M, 1.5M instead of 500,000, 1,000,000. Apply to capital chart, income chart, and fan chart.
- Files: js/app.js (all chart render functions)
- Priority: MEDIUM (mobile readability)

---

## Ranked Code Changes

1. **Stepped target line** -- prevents misinterpretation of spending reduction
2. **Event-based narrative** -- biggest consumer comprehension improvement
3. **Compact chart labels** -- mobile readability
