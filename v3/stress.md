# stress.md: the dev-time stress harness

## What this is, and what it is not

`stress.test.js` is a deterministic, dev-time battery run with Node before
deployment. It is entirely separate from the in-browser Monte Carlo, which runs
1000 stochastic market paths live in a Web Worker every time the plan changes.
The app never conflates the two: the Monte Carlo card labels its 1000 paths as
live simulations and points here for the deterministic battery.

Run it yourself:

    node v3/stress.test.js

## The battery

### Sweep 1 to 4: the tax function itself
For both residences (England, Scotland), gross income swept from 0 to 200,000
in 50 pound steps (4,002 incomes x 2 residences), asserting at every step:

1. Tax is monotonic non-decreasing in income. Earning one more pound can never
   cut your tax bill.
2. The personal allowance is never negative, including throughout the taper
   zone and far beyond 125,140.
3. The marginal rate never exceeds the statutory maximum: 60.0 pence in England
   (40 pence plus taper), 67.5 pence in Scotland (45 pence plus taper).
4. No NaN is ever produced.

### The plan grid: 1,152 full plan combinations
Every combination of:

| Axis | Values | Count |
| --- | --- | --- |
| Residence (both partners) | England, Scotland | 2 |
| Target net income | 40,000. 60,000. 80,000. 100,000 | 4 |
| Retirement year | 2028, 2030, 2033 | 3 |
| Real return regime | -1%, +1%, +3% | 3 |
| Pot scale | 0.5x, 1x, 1.5x, 2x defaults | 4 |
| Strategy | Band-Fill, ISA-Bridge, PCLS-Phased, Naive | 4 |

2 x 4 x 3 x 3 x 4 x 4 = 1,152 complete multi-decade plans, satisfying the
brief's requirement of at least 1,000 parameter combinations. Each plan run
asserts:

5. No NaN in lifetime tax, estate, or any year's wealth.
6. No shortfall is ever reported in a year where material funds (over 100
   pounds) remain anywhere in the household. Money on the table while claiming
   poverty is a solver bug, not a market outcome.
7. Band-Fill never pays more lifetime tax than the naive proportional draw
   (tolerance 1 pound for float noise). This is guaranteed by construction:
   Band-Fill is an ensemble that prices both the greedy band-filling allocation
   and the naive allocation against an identical memoised return sequence and
   adopts the cheaper. Early heuristic-only versions of the allocator failed
   this invariant in a handful of Scottish cases, which is exactly why the
   harness exists; the ensemble closed it.

### Targeted edge cases (from CRITIQUE.md)
8. Personal allowance intact at exactly 100,000 and exactly zero at 125,140.
9. Zero income pays zero tax with a zero marginal rate.
10. Scotland at 46,000 gross sits at a 42 pence marginal rate.
11. A 2,000,000 SIPP engages the 268,275 lump sum allowance cap without error.
12. Two identical partners run cleanly and split draws.
13. A partner with zero assets and zero income runs cleanly.

## Honest result of the latest run

    RetireLens 3 stress harness
    ===========================
    Tax sweeps done: monotonicity, PA, marginal ceiling, NaN.
    Plan grid done: 1152 full plan combinations in 1.5s.

    RESULT: 98616 passed, 0 failed.
    All invariants held.

98,616 individual assertions across the sweeps, the 1,152-plan grid, and the
edge cases. Zero failures. If a future change breaks an invariant the harness
exits nonzero and prints the first 25 failing labels.
