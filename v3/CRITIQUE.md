# CRITIQUE.md: red-team review of the RetireLens 3 tax engine

This file is the mandated self-critique. It was written after the engine passed
its load-time assertions and the stress harness, and it records what was probed,
what was found, what is simplified, and how the tool could still mislead you.

## 1. Edge cases probed, with outcomes

### Income at exactly 100,000
The taper must not fire at exactly 100,000, only above it. Verified:
`computeTax(null, 100000, 'EN')` returns a personal allowance of 12,570 intact.
The marginal rate at 100,000 is 40 pence, and at 100,001 it becomes 60 pence
(40 pence on the extra pound plus 20 pence from the 50 pence of allowance lost).
The stress harness asserts the allowance is intact at exactly 100,000 and fully
gone at 125,140. Both hold.

### Income at exactly 125,140
The allowance reaches zero at exactly 125,140 (12,570 x 2 above 100,000).
Verified: `personalAllowanceFor(125140)` returns 0, not a negative number.
The engine clamps with `Math.max(0, ...)` so the allowance can never go
negative at any income. Swept from 0 to 200,000 in 50 pound steps for both
residences: never negative, tax never decreasing, marginal never above the
statutory ceiling (60.0 pence England, 67.5 pence Scotland).

### Scottish crossover near 33,500 taxable
Scotland's starter and basic bands undercut England below roughly 27,300 of
taxable income, then the intermediate 21 pence band overtakes. The engine builds
the full six-band Scottish ladder (19, 20, 21, 42, 45, 48) rather than
approximating, so the crossover emerges from the bands themselves. Verified:
gross 46,000 in Scotland sits at a 42 pence marginal (higher band starts at
31,092 taxable, well below the English 37,700).

### Scottish taper trap
Because the Scottish advanced rate is 45 pence in the 100,000 to 125,140 zone,
the taper produces an effective 67.5 pence marginal (45 + 45/2), not England's
60 pence. The engine derives this from the ladder, it is not hard-coded. The
stress harness allows a marginal up to 0.676 for Scotland and 0.601 for England
and no swept income breached either.

### MPAA trigger
The engine flags the MPAA consequence: any flexible taxable drawdown from a SIPP
(beyond pure PCLS) permanently cuts the annual allowance for future pension
contributions from 60,000 to 10,000. The model treats both partners as retired
and no longer contributing, so the MPAA has no arithmetic effect on the plan,
but the warning is surfaced in the assumptions drawer because a user who plans
to keep contributing after first drawdown would be misled otherwise. Taking
PCLS alone does not trigger the MPAA and the engine respects that distinction.

### PCLS lifetime cap breach
A 2,000,000 SIPP crystallised progressively would want 500,000 of tax-free
cash, but the lump sum allowance caps tax-free cash at 268,275. The engine
tracks cumulative PCLS per partner and hard-stops at the cap; further
withdrawals are fully taxable. Stress test: a 2m pot run under the PCLS-Phased
strategy engages the cap and the plan continues without error.

### Partner with zero taxable income
A partner with no SIPP, no ISA, no state pension and no DB pension must not
break the allocator (division by zero in proportional splits was the risk).
Verified clean: the greedy allocator skips partners with zero capacity and the
plan runs entirely off the other partner.

### Both partners identical
Symmetric inputs risk oscillating or double-drawing allocators. Verified clean:
identical twins split draws and the plan completes with finite tax.

## 2. Known spec discrepancy, stated openly

The build brief quoted England tax on 120,000 as "about 40,432". Computing from
the brief's own stated bands (allowance 12,570 tapered to 2,570 at 120,000,
then 37,700 at 20 pence and the remainder to 125,140 at 40 pence) gives:
37,700 x 0.20 + 79,730 x 0.40 = 7,540 + 31,892 = 39,432. The engine returns
39,432 and the load-time assertion documents the 1,000 pound difference rather
than silently matching the quoted figure. The bands are authoritative, the
quoted example appears to contain an arithmetic slip.

## 3. Simplifications a professional would question

1. Real-terms modelling. All figures are in today's money and returns are real.
   Bands are held at 2026/27 levels in real terms, which quietly assumes bands
   rise with inflation. The actual policy is a nominal freeze to 2028, which is
   a stealth tax rise the model understates in those years.
2. No savings or dividend income taxation. Interest on the cash buffer is not
   pushed through the savings allowance, starting rate for savings, or dividend
   bands. For this persona the cash is small so the error is small, but it is
   nonzero.
3. Death and inheritance are out of scope. No IHT, no pension death benefit
   modelling (pre and post 75 rules), no spousal transfer of ISAs (APS). The
   residual estate figure is a raw asset total, not a net-of-IHT figure, and
   from April 2027 unspent pensions are expected to enter the IHT net.
4. State pension is user-editable but defaults to a single full new state
   pension figure for both partners. Real entitlements depend on NI records.
5. No tax on the way in. The model assumes accumulation is finished. Carry
   forward, tax relief on contributions, and salary sacrifice are not modelled.
6. Annual withdrawals, not monthly. Sequencing risk within a year is invisible.
7. The Monte Carlo uses normally distributed real returns with a single
   correlation. Real markets have fat tails; failure probabilities at the
   extremes are understated.
8. Scottish rates for 2026/27 are modelled as announced; the Scottish Budget
   process can revise them, and the engine has a single year switch, not a
   full multi-year rate table.

## 4. Top five ways this tool could mislead a real household

1. Certainty theatre. A Confidence Age of 91 reads like a promise. It is the
   output of one return model with estimated parameters. The true uncertainty
   about the inputs is larger than the uncertainty the simulation displays.
2. Tax minimisation is not welfare maximisation. The frontier can tempt you
   toward strategies that pay the least tax but leave you cash-poor in early
   retirement or concentrate risk in one partner's name. Least tax is the
   product's question, it is not always the right question.
3. Real-terms figures hide the nominal band freeze. In 2027 and 2028 the model
   flatters the taper thresholds slightly, so a plan hugging 99,999 of income
   is closer to the trap than the screen suggests.
4. The PCLS bypass looks free. Taking tax-free cash early forfeits future
   tax-free growth on it and, under the pcls strategy, can enlarge the estate's
   exposure to future IHT rules. The silver stream shows zero tax today, it
   cannot show the opportunity cost.
5. Two-partner optimisation assumes the partnership endures. Divorce or early
   death rearranges every number here, and the model says nothing about either.

## 5. What was not tested

Browser rendering under screen readers beyond basic semantics, non-WebKit range
input styling, and performance on pots above 10 million (the allocator slice
size of 250 makes very large draws slower, though still sub-second in Node).
