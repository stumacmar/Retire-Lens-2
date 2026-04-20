# RetireLens UX Benchmark & Integration Blueprint

## Step 1: Top 10 Tools Ranked

| Rank | Tool | UX Quality | Modelling Depth | Innovation | Key Strength |
|------|------|-----------|-----------------|------------|-------------|
| 1 | **Nutmeg** | 9/10 | 7/10 | 9/10 | Real-time sliders + probability fan chart |
| 2 | **Fidelity** | 8/10 | 8/10 | 8/10 | Income-first + 3 scenarios + PLSA + sliders |
| 3 | **MoneyHelper** | 7/10 | 8/10 | 6/10 | Couples support + phased income + PLSA |
| 4 | **PensionBee** | 9/10 | 5/10 | 7/10 | 3-input progressive disclosure, mobile-first |
| 5 | **Aviva** | 7/10 | 8/10 | 7/10 | Income gap + traffic light + PLSA |
| 6 | **AJ Bell** | 7/10 | 7/10 | 7/10 | Slider-driven + tax relief display |
| 7 | **L&G** | 7/10 | 7/10 | 6/10 | Income-first (annuity heritage) + phased |
| 8 | **Hargreaves Lansdown** | 6/10 | 7/10 | 5/10 | Tax relief amplification + data density |
| 9 | **Interactive Investor** | 6/10 | 6/10 | 5/10 | Platform integration |
| 10 | **Vanguard** | 8/10 | 5/10 | 4/10 | Radical simplicity |

---

## Step 2: Deep UX Teardown Summary

### The 11 UX Primitives Extracted

**1. Single-Slider Retirement Age with Live Impact**
- User drags slider, chart updates instantly
- Makes compound growth intuitive without requiring financial literacy
- Best: Nutmeg, AJ Bell, Fidelity
- Trade-off: Oversimplifies phased retirement

**2. Income-First Framing**
- "You will have 18,000/year" not "Your pot will be 340,000"
- Income is relatable. Pot size is abstract.
- Best: MoneyHelper, Fidelity, Aviva, L&G
- Trade-off: Requires drawdown/annuity assumptions

**3. Three-Scenario Growth Brackets**
- Low/Medium/High side by side
- Communicates uncertainty without probabilistic literacy
- Best: Fidelity, Aviva, AJ Bell
- Trade-off: Users anchor on the high scenario

**4. Probability Fan Chart**
- Shaded area showing outcome distribution
- Most honest representation of uncertainty
- Best: Nutmeg (only UK consumer tool doing this)
- Trade-off: Higher cognitive load, can alarm users

**5. Income Gap Visualisation**
- Target income vs projected with gap highlighted
- Loss aversion drives action
- Best: Fidelity, Aviva, MoneyHelper
- Trade-off: Can cause disengagement if gap is large

**6. PLSA Retirement Living Standards as Anchors**
- Min 14,400 / Mod 31,300 / Comfortable 43,100 (single)
- Solves "I don't know what I need"
- Best: MoneyHelper, Aviva, Fidelity
- Trade-off: National averages, London differs

**7. State Pension Phase Separation**
- Visually show income before vs after SP age
- Makes the "bridge period" impossible to miss
- Best: MoneyHelper, Fidelity, Aviva
- Trade-off: Alarming for early retirees

**8. Tax Relief Amplification**
- "You pay 80, 100 goes in"
- Most effective nudge toward pension saving
- Best: HL, AJ Bell
- Trade-off: Oversimplifies higher-rate relief

**9. Progressive Disclosure (3-4 inputs to first result)**
- Quick result, then refine
- Every extra input before first result = drop-off
- Best: PensionBee (3 inputs), Nutmeg (4 inputs)
- Trade-off: Quick results can be misleading

**10. Contribution Impact Calculator**
- "Add 50/month more = X,000 more income"
- Makes marginal value tangible
- Best: Fidelity, Nutmeg, Aviva
- Trade-off: Linear extrapolation misleading near limits

**11. Shareable Output**
- PDF/print for partner or adviser
- Retirement is rarely a solo decision
- Best: MoneyHelper, Fidelity, Aviva
- Trade-off: Must include disclaimers

---

## Step 3: RetireLens Gap Analysis

### A. Critical UX Gaps (Ranked)

| Gap | Impact | Current State | World-Class Standard |
|-----|--------|--------------|---------------------|
| **No sliders** | HIGH | All text inputs | Every top tool uses sliders for retirement age + contributions |
| **5 screens to first result** | HIGH | household > age > income > pensions > ISA+SP > review | PensionBee: 3 inputs. Nutmeg: 4. |
| **No real-time updates** | HIGH | Step-based: fill, next, fill, calculate | Nutmeg/AJ Bell: slider moves, chart updates instantly |
| **Pot-size framing** | MEDIUM | Hero shows "Retirement Fund 1,012,754" | Income-first: "5,000/month" is more meaningful |
| **No income gap visual** | MEDIUM | Narrative text only | Aviva/Fidelity: visual bar showing target vs projected |
| **Charts use defaults** | MEDIUM | Chart.js with default styling | Custom SVG (Sankey is good, rest are generic) |
| **Tab overload on mobile** | MEDIUM | 5 tabs: Income/Flow/Wealth/Risk/Detail | 3 tabs max on mobile, progressive reveal |

### B. UX Anti-Patterns to Remove

1. **Review screen with advanced options** -- nobody opens the accordions. Defaults should just work. Move scenario selector to a simple toggle on the results page.
2. **"Calculate my retirement" button** -- should be automatic when all inputs are present. The button is a friction barrier.
3. **Separate "Edit Inputs" flow** -- going back through 5 screens to change one number. Should be inline editing on the results page.
4. **Monthly/annual toggle as a button** -- should be a persistent setting, not a toggle that resets.
5. **What-if buttons that don't update the primary chart** -- currently shows a text result and overlays on wealth chart. Should update the hero number and income chart too.

---

## Step 4: Integration Blueprint

### Core Screens (4 total, down from 6)

**Screen 1: WHO + WHEN**
- Household type (single/couple)
- Your age + retirement age (slider, 50-75)
- Partner age + retirement age (if couple, slider)
- Auto-advance when complete

**Screen 2: HOW MUCH**
- Target income: PLSA presets (Min/Mod/Comfortable) as tappable cards, with custom override
- Current pension pot
- Monthly contribution (with salary sacrifice toggle)
- PCLS already taken (yes/no + amount if yes)
- Partner pensions (DC pot, DB income, contribution) if couple

**Screen 3: OTHER INCOME**
- ISA balance
- State pension (pre-filled, editable)
- Partner SP + DB if couple
- Flexi-access/MPAA checkbox

**Screen 4: RESULTS** (single scrollable page, no tabs)
- Hero: animated gauge + monthly income + confidence
- Share card with copy button
- Retirement timeline (narrative events)
- Income chart (stacked, stepped target)
- Sankey flow (year selector)
- What-if sliders (retirement age, contribution -- live updating)
- Data table (collapsible)
- Assumptions + disclaimer

### Component-Level Design

**Sliders (NEW -- highest priority)**
- Retirement age: range 50-75, step 1, live updates hero
- Monthly contribution: range 0-5000, step 100, live updates hero
- Both on the results page, not the input screens
- Touch-optimised: 48px thumb, 200px track minimum

**Charts**
- Income chart: stacked bar, stepped target line (3px red dashed)
- Wealth chart: dual area (pension + ISA) with event markers
- Sankey: SVG, year stepper, tax amount visible
- Fan chart: capped Y-axis, compact labels
- Remove tax chart (redundant, tax shown in breakdown)

**Tables**
- Mobile: 3 columns (Age, Start, End). Tap row for detail.
- Desktop: full columns visible
- Sticky age column
- No horizontal scroll -- columns hide, don't scroll

**Presets**
- PLSA targets as tappable cards replacing free-text income input
- Scenario selector: 3 cards (Below Average / Average / Above Average) replacing dropdown
- These are visual choices, not form fields

### Interaction Model

**Real-time (no recalculation needed):**
- Retirement age slider on results page
- Contribution slider on results page
- Monthly/annual toggle

**Requires recalculation (loading spinner):**
- Changing pension pot, ISA, SP, DB amounts
- Toggling guardrails
- Changing scenario

**State flow:**
- Central state object (already exists)
- Auto-save to localStorage every 3s (already exists)
- Results re-render from state, not from DOM reads

### Visual Hierarchy

**What the user sees FIRST:**
- Animated gauge with confidence number
- Monthly income figure (not annual)
- YES/LIKELY/AT RISK badge

**What is visible on scroll:**
- Share card
- Retirement timeline (narrative)
- Income chart

**What is behind interaction:**
- Sankey (year stepper)
- What-if sliders
- Data table (collapsible)
- Assumptions (collapsible)

---

## Step 5: Implementation Output

### A. Wireframe-Level Descriptions

**Results Page (single scroll, no tabs):**

```
[Badge: YES]
[Gauge: 88 out of 100]
[Monthly: 5,000/month | Annual: 60,000/year toggle]
[disclaimer line]

[Share card -- gradient border, copy button]

[Retirement Timeline card]
  60 -- You retire. Carol's SP+DB start.
  67 -- Your SP starts. Withdrawals drop.
  80 -- Spending reduces 25%.
  90 -- Plan succeeds. Final 1.9M.
  ! -- Worst 10%: age 67.
  Annuity alt: 47k/yr at 5%.
  Min pot: 261k (you have 334k more).
  Survivor: Carol inherits 1M+.

[What-if sliders]
  Retirement age: [====O=========] 60
  Monthly contribution: [========O====] 3,000
  Impact shown live above sliders

[Income chart -- stacked bars, stepped target]

[Sankey -- year stepper < Age 74 >]

[Data table -- collapsed by default, tap to expand]
  [Age] [Start] [End]

[Assumptions -- collapsed]
[Your inputs -- collapsed]
[Disclaimer]
[Edit | Print | Save | Reset]
```

### B. Frontend Architecture

**Component structure:**
- `renderHero()` -- gauge, badge, income, disclaimer
- `renderShareCard()` -- summary, copy button
- `renderTimeline()` -- narrative events
- `renderSliders()` -- retirement age + contribution with live callback
- `renderIncomeChart()` -- stacked bar with stepped target
- `renderSankey()` -- SVG flow diagram with year stepper
- `renderDataTable()` -- collapsible, mobile-responsive
- `renderAssumptions()` -- collapsible details

**State model:**
- Single `state` object (existing)
- `state.formData` feeds all rendering
- Slider changes update `state.formData` directly and re-run deterministic projection (fast, <50ms)
- MC runs once on calculate, not on slider change

**Rendering strategy:**
- Remove tabs entirely -- single scrollable page
- Each section is a function that renders to its container
- Slider callbacks run `createPlan` + `runProjection` (deterministic only) and update hero + chart
- No full page re-render on slider change -- surgical DOM updates

### C. Priority Build Plan

**Phase 1: Fix critical UX (1 day)**
1. Remove tabs -- single scrollable results page
2. Add PLSA preset cards on income screen (replace free text)
3. Move scenario selector from review to results page as visual cards

**Phase 2: High-impact primitives (2 days)**
4. Add retirement age slider to results page with live projection update
5. Add contribution slider to results page with live update
6. Switch hero from annual to monthly-first (toggle to annual)
7. Auto-calculate when all inputs present (remove Calculate button friction)

**Phase 3: Refactor UI structure (2 days)**
8. Collapse review screen into results (scenario + guardrails as toggles on results)
9. Reduce to 3 input screens (WHO+WHEN, HOW MUCH, OTHER INCOME)
10. Inline editing from results page (tap a number to change it)

---

## Constraints Acknowledgement

- All analysis based on tools as of early-mid 2025. Some features may have changed.
- Nutmeg's probability cone is the only verified fan chart in UK consumer space. Others may have added similar since.
- PLSA integration depth varies -- verified for MoneyHelper and Aviva, inferred for others.
- Couples planning is a market-wide gap. Only MoneyHelper partially addresses it. RetireLens is ahead of the market here.
- Mobile-first slider implementation requires careful touch target sizing (48px minimum) and debounced calculation to maintain <200ms update latency.
