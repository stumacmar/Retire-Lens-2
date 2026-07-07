/**
 * Someday — example plans for the "see an example first" peek.
 *
 * Three illustrative UK personas, each a PATCH applied over Engine.freshStart()
 * (so they always carry current defaults for anything not listed). Not real
 * people, not advice — just realistic round numbers so a new visitor can see a
 * fully-worked answer in seconds, then make the plan their own.
 */

export const EXAMPLES = [
  {
    key: 'single',
    label: 'Careful single',
    blurb: 'One income, steady saving, retiring at 66',
    patch: {
      partnerA: { name: 'Sam', birthYear: 1966, pension: 260000, isa: 30000, monthlyPension: 500 },
      // Partner stays zeroed — planning solo
      retireYear: 2032, horizonAge: 92,
      cash: 15000, house: 280000,
      targetNet: 31300,          // PLSA 2024 "Moderate", single
    },
  },
  {
    key: 'couple',
    label: 'Comfortable couple',
    blurb: 'Two pensions, a home, retiring together at 64',
    patch: {
      partnerA: { name: 'Alex', birthYear: 1968, pension: 320000, isa: 40000, monthlyPension: 800 },
      partnerB: { name: 'Jo', birthYear: 1970, pension: 110000, isa: 25000, monthlyPension: 300 },
      retireYear: 2032, horizonAge: 92,
      cash: 20000, house: 380000,
      targetNet: 43100,          // PLSA 2024 "Moderate", couple
    },
  },
  {
    key: 'early',
    label: 'Early retiree',
    blurb: 'Bigger pot, stopping at 56 — can it stretch?',
    patch: {
      partnerA: { name: 'Chris', birthYear: 1971, pension: 550000, isa: 120000, monthlyPension: 1200 },
      retireYear: 2027, horizonAge: 95,
      cash: 40000, house: 350000,
      targetNet: 38000,
    },
  },
];
