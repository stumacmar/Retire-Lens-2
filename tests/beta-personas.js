/**
 * RetireLens - Beta Tester Personas
 *
 * Realistic UK households used by the cross-check harness and the E2E beta bot.
 * Age-based spending reductions are left OFF here so the independent tax oracle
 * can reconcile to the penny; the reductions are exercised separately.
 */

export const PERSONAS = [
  {
    id: 'stuart-56',
    label: 'Stuart, 56 — the founder’s own case',
    note: 'Single man, decade to go, decent DC pot, wants ~£28k net.',
    isCouple: false,
    inputs: {
      currentAge: 56, retirementAge: 67, targetNetIncome: 28000,
      currentPension: 320000, currentIsa: 60000,
      annualPensionContribution: 12000, annualIsaContribution: 4000,
      expectedStatePension: 11973, statePensionAge: 67,
    },
  },
  {
    id: 'early-retiree-low',
    label: 'Priya, 45 — aiming to stop at 60 on a modest income',
    isCouple: false,
    inputs: {
      currentAge: 45, retirementAge: 60, targetNetIncome: 20000,
      currentPension: 150000, currentIsa: 40000,
      annualPensionContribution: 8000, annualIsaContribution: 3000,
      expectedStatePension: 11973, statePensionAge: 67,
    },
  },
  {
    id: 'high-earner-taper',
    label: 'James, 50 — high earner, big pot, £55k target',
    isCouple: false,
    inputs: {
      currentAge: 50, retirementAge: 60, targetNetIncome: 55000,
      currentPension: 700000, currentIsa: 200000,
      annualPensionContribution: 40000, annualIsaContribution: 20000,
      expectedStatePension: 11973, statePensionAge: 67,
    },
  },
  {
    id: 'late-starter',
    label: 'Maureen, 58 — started late, small pot, low target',
    isCouple: false,
    inputs: {
      currentAge: 58, retirementAge: 68, targetNetIncome: 15000,
      currentPension: 60000, currentIsa: 8000,
      annualPensionContribution: 6000, annualIsaContribution: 1000,
      expectedStatePension: 11973, statePensionAge: 67,
    },
  },
  {
    id: 'db-holder',
    label: 'Geoff, 55 — has a DB pension plus a DC pot',
    isCouple: false,
    inputs: {
      currentAge: 55, retirementAge: 65, targetNetIncome: 30000,
      currentPension: 180000, currentIsa: 30000,
      annualPensionContribution: 9000, annualIsaContribution: 2000,
      expectedStatePension: 11973, statePensionAge: 67,
      hasDBPension: true, dbPensionAmount: 9000, dbPensionStartAge: 65,
    },
  },
  {
    id: 'isa-heavy',
    label: 'Dawn, 52 — ISA-heavy, wants tax-free flexibility',
    isCouple: false,
    inputs: {
      currentAge: 52, retirementAge: 62, targetNetIncome: 26000,
      currentPension: 90000, currentIsa: 250000,
      annualPensionContribution: 5000, annualIsaContribution: 15000,
      expectedStatePension: 11973, statePensionAge: 67,
    },
  },
  {
    id: 'scottish',
    label: 'Kirsty, 48 — Scottish taxpayer',
    isCouple: false,
    inputs: {
      currentAge: 48, retirementAge: 66, targetNetIncome: 32000,
      currentPension: 260000, currentIsa: 50000,
      annualPensionContribution: 11000, annualIsaContribution: 4000,
      expectedStatePension: 11973, statePensionAge: 67,
      taxJurisdiction: 'scotland',
    },
  },
  {
    id: 'modest-single',
    label: 'Tom, 60 — five years out, cautious',
    isCouple: false,
    inputs: {
      currentAge: 60, retirementAge: 65, targetNetIncome: 22000,
      currentPension: 300000, currentIsa: 45000,
      annualPensionContribution: 6000, annualIsaContribution: 2000,
      expectedStatePension: 11973, statePensionAge: 67,
    },
  },
  {
    id: 'young-aggressive',
    label: 'Aisha, 35 — long runway, saving hard',
    isCouple: false,
    inputs: {
      currentAge: 35, retirementAge: 58, targetNetIncome: 35000,
      currentPension: 80000, currentIsa: 30000,
      annualPensionContribution: 15000, annualIsaContribution: 8000,
      expectedStatePension: 11973, statePensionAge: 68,
    },
  },
  {
    id: 'couple-basic',
    label: 'Ann & Bob, 57/59 — a couple planning together',
    isCouple: true,
    inputs: {
      currentAge: 59, retirementAge: 66, targetNetIncome: 40000,
      currentPension: 350000, currentIsa: 80000,
      annualPensionContribution: 12000, annualIsaContribution: 5000,
      expectedStatePension: 11973, statePensionAge: 67,
      partnerCurrentAge: 57, partnerStatePensionAge: 67,
      partnerExpectedStatePension: 11973,
    },
  },
];

// Single personas only — used by the tight tax/PCLS oracle.
export const SINGLE_PERSONAS = PERSONAS.filter(p => !p.isCouple);
