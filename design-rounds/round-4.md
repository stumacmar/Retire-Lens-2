# Round 4: DECISION SUPPORT

What the user is supposed to DO with the output.

## Faction A (IFAs) -- Top 3 Demands

### A1: Show the cost of waiting vs acting now
The single most powerful IFA tool: "If you increase contributions by 500/month starting now, your pot at retirement grows by X and your success rate rises from Y to Z." The user needs to see the impact of a specific action, not just the current state. Show a "What if?" panel with one slider: extra monthly contribution. Live-update the outcome.

### A2: Sequence-of-returns risk warning in the first 3 years
The biggest risk in drawdown is poor returns in the first 3 years of retirement. The model runs MC but doesn't explain this risk. Add a specific callout: "If markets fall 20% in your first year of retirement, your plan changes from X to Y." The illustrateSequenceOfReturns function already exists in the engine but is not wired to the UI.

### A3: Show when the plan breaks
The MC depletion histogram shows when money runs out but the narrative doesn't quantify the downside. Add: "In the worst 10% of market scenarios, your money runs out at age X." This is the tail risk the user needs to understand.

## Faction B (Consumers) -- Top 3 Demands

### B1: Tell me one thing I should do right now
The "Consider" section has 3-4 generic bullets. I want ONE specific action: "The single most impactful thing you can do: increase your monthly contribution from 3,000 to 3,500. This adds 42,000 to your retirement pot." Or: "Your plan is already strong. No action needed. Review in 12 months."

### B2: Can I take a year off contributions?
I might get made redundant. I might want to take a sabbatical. What happens to my plan if I stop contributing for a year? Two years? This is the question that keeps me up at night.

### B3: What if I retire a year earlier or later?
Retiring at 59 vs 61 makes a huge difference. Show me the impact of +/- 1-2 years without re-entering everything.

## Faction C (UX) -- Top 3 Demands

### C1: The "Consider" section needs priority ordering
Currently all bullets have equal weight. The most impactful action should be first, visually highlighted, with a specific number. Others can be secondary.

### C2: Add a "Share with my partner" button
The results are personal. But retirement decisions are household decisions. A "Share" button that copies a summary link or generates a screenshot/PDF for Carol to review.

### C3: The results should be saveable and comparable
Users want to run multiple scenarios (retire at 58, 60, 62) and compare them. Currently each run overwrites the previous. Add scenario naming and side-by-side comparison.

---

## Cross-Faction Attacks

### On A1 (cost of waiting):
- **B attacks**: "I love this. But don't make me guess the number. Show me the slider and let me play."
- **C attacks**: "A live-updating slider is the best UX intervention in this entire tool. But it needs to update in under 200ms to feel responsive. The full MC takes 2-5 seconds. Use deterministic for the slider, MC for the final result."

### On A2 (sequence risk):
- **B attacks**: "A 20% market crash scenario scares me. But I need to know. Show it as 'what if' not as a warning."
- **C attacks**: "Add it as a callout in the narrative timeline, not a separate section. 'If markets fall 20% in year 1, your funds last to age 82 instead of 90.' One sentence."

### On A3 (tail risk):
- **B attacks**: "I want this number. 'In the worst case, money runs out at 78' is terrifying but I need to know."
- **C attacks**: "Already available from MC p10 data. Just add one line to the narrative."

### On B1 (one action):
- **A attacks**: "The most impactful action depends on the situation. For a strong plan, it's 'do nothing.' For a weak plan, it's 'increase contributions.' For a borderline plan, it might be 'retire one year later.' The system should calculate which lever moves the needle most."
- **C attacks**: "Agreed. One headline action, prominently displayed. Use the engine to test 3-4 levers and pick the biggest impact."

### On B2 (contribution gap):
- **A attacks**: "Simple to model. Set contributions to 0 for N years, re-run projection. Show the impact."
- **C attacks**: "Not worth a separate UI for Round 4. Note for roadmap. The what-if slider from A1 covers this (slide contributions to 0)."

### On B3 (retire earlier/later):
- **A attacks**: "Simple to model. The Compare Plans feature existed but was removed. Add a lightweight version: +/- buttons on retirement age that re-run and show delta."
- **C attacks**: "The what-if slider from A1 could include retirement age as a second slider."

### On C1 (priority ordering):
- **A attacks**: "Correct. The most impactful action should be calculated, not hardcoded."
- **B attacks**: "Yes. Tell me the ONE thing."

### On C2 (share):
- **A attacks**: "A PDF summary that a partner or IFA can review is essential for couples."
- **B attacks**: "I'd send Carol a screenshot right now if I could."

### On C3 (scenarios):
- **A attacks**: "Good idea but complex. Defer."
- **B attacks**: "I just want to see 'retire at 58 vs 60 vs 62' without starting over."

---

## Defences and Concessions

### A1: All factions agree on a what-if contribution slider using deterministic calc.
### A2: Add sequence risk as one line in the narrative timeline. Use existing engine function.
### A3: Add tail risk (p10 depletion age) to narrative. Already in MC data.
### B1: Calculate the single most impactful action and highlight it.
### B2: Defer. Covered by contribution slider.
### B3: Defer. Covered by future retirement age slider.
### C1: Priority ordering = calculated best action highlighted.
### C2: Defer to Round 5 (PDF export).
### C3: Defer to roadmap.

---

## Synthesis: Round 4 Changes

### Change 4.1: Add tail risk and sequence risk to narrative timeline
Two new lines in the timeline:
- "In the worst 10% of market scenarios, funds last to age X" (from MC p10)
- "If markets fall 20% in your first retirement year, funds last to age Y" (from sequence-of-returns engine)
No new sections. Just two sentences added to the existing timeline.
- Files: js/app.js (renderNarrativeSummary)
- Priority: HIGH (risk communication)

### Change 4.2: Calculate and highlight the single most impactful action
Test 3 levers: (a) +500/month contributions, (b) retire 1 year later, (c) reduce target by 5k. Pick the one with biggest improvement to final balance or success rate. Show as the first "Consider" bullet with specific numbers, visually highlighted.
- Files: js/app.js (renderNarrativeSummary, new function calculateBestAction)
- Priority: HIGH (decision support)

### Change 4.3: Add "not financial advice" disclaimer
All three factions agree: the tool needs a clear disclaimer. "This tool provides estimates for planning purposes only. It is not financial advice. Consider consulting a qualified financial adviser before making retirement decisions."
- Files: index.html, js/app.js
- Priority: HIGH (compliance, brought forward from Round 5)

---

## Ranked Code Changes

1. **Tail risk + sequence risk in narrative** -- two sentences, huge value
2. **Calculated best action** -- the single most useful feature for decision-making
3. **Disclaimer** -- compliance requirement
