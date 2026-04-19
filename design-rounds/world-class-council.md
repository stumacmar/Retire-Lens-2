# RetireLens Council: World-Class Assessment

## The Screenshots Under Review

The council reviews 5 screenshots from a live couple scenario (user 56, partner 63, retire at 60, target 60k/yr):

1. **Hero**: YES badge, 88/100 confidence, retirement fund 1,012,754, final balance 1,922,130
2. **Narrative**: Timeline from age 60-90 with annuity, survivor, min pot, review date, action recommendation
3. **Income chart**: Stacked bars showing SP + DB + Pension Withdrawal + Target line, with tabs
4. **Income breakdown**: Per-source table with tax, total gross 69,372, net 60,000
5. **Wealth chart**: Pension + ISA + Total with age markers (60 Retire, 80 -25%)

---

## The World-Class Benchmark

After analyzing ProjectionLab, Boldin, Fidelity, Voyant, Timeline, Guiide, cFIREsim, and MoneyHelper:

### What "world class" means in 2026:

| Dimension | World Class Standard | RetireLens Today |
|-----------|---------------------|------------------|
| Time to first answer | 60 seconds (Fidelity) | 3-4 minutes (5 screens) |
| Visual design | Dark mode, gradients, animation (ProjectionLab) | Clean but plain (system fonts, flat cards) |
| Scenario comparison | Side-by-side with named scenarios (ProjectionLab) | Single run + what-if buttons |
| Cashflow visualization | Sankey diagram showing money flow (ProjectionLab) | Stacked bar chart (good but standard) |
| Historical backtesting | Every year since 1871 (cFIREsim) | Monte Carlo only |
| Withdrawal strategies | VPW, Guyton-Klinger guardrails (cFIREsim) | Fixed target with age reduction |
| Actionability | Scored suggestions with point impact (Fidelity) | Calculated best action (good) |
| Adviser handoff | Print-ready PDF report (Voyant) | Browser print (basic) |
| Input richness | Timeline events, life changes (ProjectionLab) | Fixed inputs, no events |
| UK specificity | Tax wrapper optimization (Timeline) | Per-person tax, PCLS, SP (good) |

---

## THE COUNCIL DEBATE

### Round 1: "Is this world class?"

**IFA faction (unanimous NO):**
"It's a solid consumer tool. Better than MoneyHelper, comparable to Guiide. But it's nowhere near Voyant or Timeline for planning depth. The missing pieces: no withdrawal strategy options (VPW, guardrails), no tax wrapper optimization (ISA vs SIPP drawdown order), no income splitting strategy for couples, no state pension deferral modelling, no partial annuity/drawdown blended strategy. The per-person tax is a good start but doesn't optimize -- it just calculates."

**Consumer faction (split -- 12 YES, 8 NO):**
The YES camp: "It answered my question clearly. 88 out of 100. The narrative told me what happens at each age. The annuity comparison was useful. I can print it for Carol."
The NO camp: "I can't compare 'retire at 58 vs 60 vs 62' side by side. The what-if buttons show a number but don't update the charts. I want to play with scenarios and see the impact visually."

**UX faction (unanimous NO):**
"Compare to ProjectionLab. The design is functional but forgettable. No animation, no delight, no 'wow' moment. The results page is a long scroll of text and charts -- there's no information hierarchy that guides my eye to what matters most. The tabs help but within each tab there's still too much content. The income chart is standard Chart.js with default styling. A world-class tool would have custom visualizations that tell a story, not generic charts with data dumped in."

### Round 2: "What would make it world class?"

Each faction submits their top 3 demands for the NEXT level:

**IFA Top 3:**

1. **Tax wrapper optimization**: Show the optimal order to draw from ISA vs SIPP vs GIA, year by year. "Draw from ISA this year to stay below the higher rate threshold. Switch to SIPP next year when your SP starts and you need less." This is what Timeline and Voyant do.

2. **Withdrawal strategy options**: Let the user choose between fixed withdrawal (current), percentage-of-portfolio, or Guyton-Klinger guardrails (reduce spending by 10% if portfolio drops below threshold, increase by 5% if it rises above ceiling). These are evidence-based strategies that meaningfully change outcomes.

3. **State pension deferral modelling**: Deferring SP by 1 year increases it by ~5.8%. For someone retiring at 60 with SP at 67, the question "should I defer SP to 68 or 69?" could add thousands per year to guaranteed income. Model it.

**Consumer Top 3:**

1. **Side-by-side scenario comparison**: "Show me retire at 58, 60, and 62 next to each other. One chart, three lines, with a summary: '62 gives you 180k more at 90 but you work 2 extra years.'" The what-if buttons are a start but I want to SEE the comparison.

2. **Monthly income view**: Everything is annual. I budget monthly. Show me "you'll have 5,000/month" not "60,000/year". Simple but important for how I think about money.

3. **"What Carol sees" view**: A simplified summary I can text to my partner. Not the full results page -- just: "We can retire at 60. Income 60k/year. Money lasts to 90. If anything happens to me, you'll have 1M+ and your own pensions."

**UX Top 3:**

1. **Interactive Sankey diagram**: Show money flowing from sources (SP, DB, Pension, ISA) through tax to net spending. Click any year to see the flow change. This is ProjectionLab's killer feature and it makes the abstract concrete. "I can SEE where my money comes from."

2. **Design refresh with microinteractions**: The numbers should animate when they appear. The charts should draw in. The tabs should slide. The confidence meter should fill like a gauge. These details are what make ProjectionLab feel premium. Currently RetireLens feels like a government tool.

3. **Progressive summary card**: A single card that floats at the top of results summarizing the entire plan in 4 lines:
   "You + Carol | Retire at 60 | Income 60k/yr (5k/month)
   88% confident your money lasts to 90
   Pension covers it all. ISA grows untouched.
   Next review: April 2027"
   This card should be shareable (copy to clipboard, screenshot-friendly).

---

## THE SYNTHESIS: 9 Changes to World Class

Ranked by impact and feasibility:

### Tier 1: High Impact, Achievable (do now)

**1. Monthly income view toggle**
Show all income figures as monthly (5,000/month) with a toggle to switch to annual (60,000/year). Apply to hero metrics, narrative, income breakdown, and data table.
- Effort: Small (formatting change)
- Impact: High (matches how consumers think)

**2. Shareable summary card**
A fixed-format card at the top of results with 4 lines summarizing the entire plan. "Copy to clipboard" button. Designed to be screenshotted and sent to a partner.
- Effort: Small (HTML/CSS)
- Impact: High (solves the "share with Carol" problem)

**3. Side-by-side scenario comparison**
Save current scenario, change one variable (retirement age), recalculate, show both on the same chart with a delta summary. Use the existing Save Scenario infrastructure.
- Effort: Medium (chart overlay + comparison logic)
- Impact: High (the feature every power user wants)

### Tier 2: Medium Impact, Medium Effort

**4. Animated confidence gauge**
Replace the plain "88 out of 100" text with an animated radial gauge that fills on page load. Green/amber/red zones. The single most impactful visual upgrade.
- Effort: Medium (SVG or canvas animation)
- Impact: Medium (emotional impact, trust)

**5. State pension deferral "what if"**
Add to the narrative: "If you defer your State Pension by 1 year to age 68, your annual SP increases from 11,973 to 12,667 (+694/yr for life)." Simple calculation, high value.
- Effort: Small (calculation + one narrative line)
- Impact: Medium (actionable insight)

**6. Withdrawal strategy guardrails**
Add an advanced option: "If your pot drops below [threshold], reduce spending by 10%." Model this in the projection. Shows resilience.
- Effort: Medium (engine change + UI toggle)
- Impact: Medium (IFA credibility)

### Tier 3: High Impact, Higher Effort (roadmap)

**7. Interactive Sankey cash flow diagram**
For any selected year, show money flowing from sources through tax to spending. Click through years with a slider. This is the ProjectionLab killer feature.
- Effort: High (custom visualization library)
- Impact: High (understanding + wow factor)

**8. Tax wrapper optimization**
Calculate the optimal ISA vs SIPP drawdown order for each year based on marginal tax rates. Show the tax saving vs the current strategy.
- Effort: High (engine logic + comparison UI)
- Impact: High (real money saved)

**9. Design system overhaul**
Custom color palette, microinteractions (number animations, chart draw-in, gauge fill), dark mode, refined typography. Move from "clean government tool" to "premium fintech."
- Effort: High (design + CSS + animation)
- Impact: Medium-High (perception of quality)

---

## The Council's Verdict

RetireLens is currently a **7 out of 10** retirement planning tool:
- Better than MoneyHelper (6), Guiide (6.5)
- Comparable to basic Boldin (7)
- Below ProjectionLab (8.5), Voyant (9), Timeline (8)

To reach **9 out of 10** (world class for consumers):
1. Monthly view, shareable card, scenario comparison (Tier 1)
2. Animated gauge, SP deferral, guardrails (Tier 2)

To reach **10 out of 10** (world class overall):
3. Sankey diagram, tax wrapper optimization, design overhaul (Tier 3)

The gap is not calculation accuracy (that's already strong). The gap is **visual storytelling** and **scenario exploration**. The tool tells you the answer but doesn't let you explore alternatives or feel confident in the result through design quality.
