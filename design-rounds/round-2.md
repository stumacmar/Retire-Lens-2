# Round 2: INPUT MODEL

What do we ask, in what order, with what defaults?

## Faction A (IFAs) -- Top 3 Demands

### A1: Ask about flexible access to determine MPAA
The "PCLS already taken" checkbox does not distinguish between taking tax-free cash only (no MPAA trigger) and taking flexible income (triggers MPAA at 10,000). The model must ask: "Have you taken any taxable income from your pension?" If yes, future contributions should be capped at 10,000/year. Getting this wrong overstates accumulation by up to 26,000/year for salary sacrifice users.

### A2: Separate each person's pensions clearly
The combined pension pot (yours + partner's) is entered as one number, then partner DC is entered separately on the same screen. This is confusing. The accumulation engine adds them together anyway, but the user can't verify which pot belongs to whom. Each person should have their own clearly labelled section: "Your DC pot: X, Your DB: Y" then "Carol's DC pot: X, Carol's DB: Y".

### A3: Capture contribution type (personal vs salary sacrifice)
Salary sacrifice contributions save employer NI (13.8%) which employers often pass on. A 1,000/month personal contribution costs 1,000 from net pay. A 1,000/month salary sacrifice contribution could add an extra 138 employer NI saving. This is material for high earners. At minimum, ask "Is this salary sacrifice?" and show the tax efficiency note.

## Faction B (Consumers) -- Top 3 Demands

### B1: Too many screens -- combine them
8 screens before results. Each screen has one input (plus partner for couples). Fidelity does it in 4. Combine: ages on one screen, pensions on one screen, other savings on one screen, review. 4 screens, not 8.

### B2: Default the state pension -- don't make me look it up
The state pension screen shows 11,973 and age 67 as defaults, which is good. But many users don't know their exact entitlement and feel anxiety about getting it wrong. Show a link to check at gov.uk but also say: "If you're not sure, the default is the full new State Pension. Most people with 35+ years of NI contributions qualify."

### B3: The PCLS section is buried and confusing
"Have you already taken your PCLS?" is on the review screen under Planning Options. Most users don't know what PCLS means. The question should be on the pension pot screen, in plain English: "Have you already taken your 25% tax-free cash from this pension?" with a yes/no toggle, and if yes, "How much did you receive?"

## Faction C (UX) -- Top 3 Demands

### C1: Progressive disclosure -- start with 3 inputs, expand
The fastest path to value: ask age, pension pot, target income. Show an instant estimate. Then say "Improve your estimate" with optional extras: partner details, ISA, contributions, DB pension. Don't gate the results behind 8 mandatory screens.

### C2: Mobile input fields are too small on the pension pot screen
The pension pot screen now has 5+ inputs (your DC, your DB income, your DB start age, partner DC, partner DB income, partner DB start age). On mobile this is a long scrolling form. Group with clear visual hierarchy and consider splitting DC and DB into separate screens.

### C3: The review screen has too many advanced options
Scenario selector, PCLS checkbox, PCLS amount, Monte Carlo toggle, tax optimization toggle, tax jurisdiction, care costs, phased retirement. Most users don't touch any of these. The defaults should be correct for 90% of users. Move advanced options behind a "Show advanced" toggle that's collapsed by default.

---

## Cross-Faction Attacks

### On A1 (MPAA):
- **B attacks**: "I don't know what MPAA means. You're asking me a question I can't answer. Ask in plain English: 'Have you taken any taxable income from your pension (not just tax-free cash)?'"
- **C attacks**: "Agreed on the need. But this should be part of the pension pot screen flow, not a separate screen. One yes/no toggle with a helper: 'This affects how much you can contribute in future.'"

### On A2 (separate pensions):
- **B attacks**: "I'm already entering separate values for partner DC, partner DB. What more do you want?"
- **C attacks**: "The current flow does separate them. Your DC is on the main pension pot field. Partner DC is injected below. The issue is the visual hierarchy, not the data model. Labels need work, not new screens."

### On A3 (salary sacrifice):
- **B attacks**: "I don't care about employer NI savings. My employer just tells me how much goes in."
- **C attacks**: "This is a nice-to-have, not a must-have. The contribution field already says 'including employer'. The salary sacrifice NI saving is a secondary optimization that adds complexity for marginal benefit."

### On B1 (fewer screens):
- **A attacks**: "Combining screens means users skip fields. One question per screen forces attention. But we concede 8 is too many for simple cases."
- **C attacks**: "Agreed. The pathfinder/mode-select screens at the start add 2 screens of zero value. Remove those and the wizard is 6 screens. Combine age + retirement age = 5 screens. That's close to Fidelity's 4."

### On B2 (SP defaults):
- **A attacks**: "The default is already set. But we should show 'You may get less if you have fewer than 35 qualifying years' as a caveat, not remove the input."
- **C attacks**: "Agreed. The context hint already links to gov.uk. Add: 'Most people qualify for the full amount. Check yours at gov.uk/check-state-pension.'"

### On B3 (PCLS location):
- **A attacks**: "Correct. PCLS is a pension-level concept. It belongs on the pension screen."
- **C attacks**: "Agreed. Move the PCLS question to the pension pot screen. Use plain English. 'Have you already taken your 25% tax-free cash?' Yes/No toggle. If yes, amount field appears."

### On C1 (progressive disclosure):
- **A attacks**: "An estimate from 3 inputs is dangerously misleading. No state pension, no partner income, no tax modelling. The user sees YES and stops entering data."
- **B attacks**: "I want the instant answer! But I'd also want to know 'this estimate doesn't include your partner's income' so I know it's rough."
- **C defence**: "The estimate would clearly say 'Based on limited data. Add more details to improve accuracy.' The point is to show value before asking for everything."

### On C2 (mobile inputs):
- **A attacks**: "Not an input model issue. The data collected is correct."
- **B attacks**: "Agreed. The pension pot screen is too long on mobile."

### On C3 (advanced options):
- **A attacks**: "Monte Carlo and care costs are important. But we concede they can be collapsed by default since the defaults are reasonable."
- **B attacks**: "I never open those accordions. Just calculate with sensible defaults."

---

## Defences and Concessions

### A1: IFAs accept plain English wording. "Have you taken any taxable income from your pension?" on the pension pot screen. If yes, contributions capped at 10,000/year with explanation.

### A2: IFAs concede the current structure is adequate. Labels need improvement but the data is separated.

### A3: IFAs concede salary sacrifice is a nice-to-have. Defer.

### B1: Consumers accept 5 screens. Remove pathfinder/mode-select (unused), combine age + retirement age.

### B2: Already done. Improve the context hint text.

### B3: All factions agree. Move PCLS to pension pot screen.

### C1: Deferred. Progressive disclosure (instant estimate from 3 inputs) is a major architectural change. Noted for roadmap.

### C2: Improve visual hierarchy on pension pot screen. Not a separate screen.

### C3: All factions agree. Collapse advanced options by default.

---

## Synthesis: Round 2 Changes

### Change 2.1: Move PCLS question to pension pot screen
Remove PCLS from review screen. Add to pension pot screen in plain English: "Have you already taken your 25% tax-free cash?" Yes/No toggle. If yes, "How much did you receive?" field appears. This is where the user is thinking about their pension, not on the review screen buried in options.
- Files: index.html, js/app.js
- Priority: HIGH (usability)

### Change 2.2: Combine age + retirement age into one screen
Reduce wizard from 8 to 7 screens. Single screen: "Your age" + "When do you want to retire?" (+ partner fields for couples). Context hint: "You have X years until retirement."
- Files: index.html, js/app.js
- Priority: HIGH (friction reduction)

### Change 2.3: Collapse advanced options by default on review
The advanced accordion (Risk & Uncertainty, Tax & Household, Life Events) should start collapsed. Most users use defaults. Show "Advanced options" as a single toggle.
- Files: index.html, js/app.js
- Priority: MEDIUM (declutter)

---

## Ranked Code Changes

1. **Move PCLS to pension pot screen** -- highest usability impact, all factions agree
2. **Combine age screens** -- reduces wizard friction
3. **Collapse advanced options** -- declutters review screen
