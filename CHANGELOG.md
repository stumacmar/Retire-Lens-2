# Changelog

## Round 3: Output Model (2026-04-18)

### Changed
- Income chart target line now steps down at 80 (-25%) and 90 (-35%) to match spending reductions
- Narrative summary replaced with event-based timeline showing key ages and what happens at each
- All chart Y-axes use compact format (500k, 1.0m) instead of raw numbers

### What a user of the previous version would notice
The income chart's red dashed target line now steps down at age 80 and 90, so you can see your income matches the reduced target instead of looking like a shortfall. The narrative summary is now a timeline: "60: You retire. 67: State Pension starts. 80: Spending reduces. 90: Plan succeeds." Chart labels show 500k instead of 500,000, making them readable on mobile.

## Round 2: Input Model (2026-04-18)

### Changed
- PCLS question moved from review screen to pension pot screen in plain English: "Have you already taken your 25% tax-free cash?"
- Age and retirement age combined into one screen (7 screens down from 8)
- Advanced options collapsed by default on review screen (scenario selector still visible)
- Partner age and retirement age now entered together on the combined age screen

### What a user of the previous version would notice
One fewer screen in the wizard. The pension pot screen now asks about your tax-free cash directly, so you don't have to scroll through the review screen to find it. The review screen is cleaner with advanced options hidden by default.

## Round 1: Calculation Core (2026-04-18)

### Added
- LSA cap enforcement: PCLS capped at min(25% of uncrystallised, 268,275 minus prior PCLS taken)
- LSA and LSDBA constants in config/defaults.js
- Baseline audit document (design-rounds/baseline-audit.md)
- Round 1 competition document (design-rounds/round-1.md)

### Changed
- Scenario labels: "Conservative/Moderate/Optimistic" renamed to "Below Average/Average/Above Average markets"
- Optimistic growth rate: 7% with 0% fees changed to 6% with 0.4% fees (historically grounded)
- Consistency audit test updated for LSA-capped PCLS

### What a user of the previous version would notice
The scenario dropdown now says "Below Average / Average / Above Average markets" instead of "Conservative / Moderate / Optimistic". The top scenario gives 6% real growth instead of 7%, which produces lower projections but is more realistic. If your pension pot is large enough that 25% PCLS would exceed 268,275, the tax-free cash is now capped at the Lump Sum Allowance limit.
