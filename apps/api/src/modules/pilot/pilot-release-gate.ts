export const PILOT_TARGETS = {
  merchants: 10,
  creators: 50,
  frozenCampaigns: 30,
  publishedContents: 100,
} as const

export interface PilotReleaseGateInput {
  actual: {
    merchants: number
    creators: number
    frozenCampaigns: number
    publishedContents: number
  }
  evidence: {
    verifiedRedemptions: number
    reconciledCreatorPayouts: number
    completeEvidenceChains: number
  }
  measurement: { preRegisteredCampaigns: number; measurableCampaigns: number }
  commercial: { merchantsWithRepeatCampaign: number; merchantsWithBudgetExpansion: number }
  creatorTasks: { invited: number; accepted: number }
}

/** Pure policy evaluator for the weekly pilot review. */
export function evaluatePilotReleaseGate(input: PilotReleaseGateInput) {
  const targets = Object.fromEntries(
    Object.entries(PILOT_TARGETS).map(([key, target]) => {
      const actual = input.actual[key as keyof typeof input.actual]
      return [key, { target, actual, passed: actual >= target }]
    }),
  ) as Record<keyof typeof PILOT_TARGETS, { target: number; actual: number; passed: boolean }>

  const frozenCampaigns = input.actual.frozenCampaigns
  const reconciliationRate = rate(
    input.evidence.reconciledCreatorPayouts,
    input.evidence.verifiedRedemptions,
  )
  const completeEvidenceChainRate = rate(
    input.evidence.completeEvidenceChains,
    input.evidence.verifiedRedemptions,
  )
  const measurableCampaignShare = rate(input.measurement.measurableCampaigns, frozenCampaigns)
  const preRegistrationShare = rate(input.measurement.preRegisteredCampaigns, frozenCampaigns)
  const creatorTaskAcceptanceRate = rate(input.creatorTasks.accepted, input.creatorTasks.invited)
  const repeatCampaignRate = rate(
    input.commercial.merchantsWithRepeatCampaign,
    input.actual.merchants,
  )
  const budgetExpansionRate = rate(
    input.commercial.merchantsWithBudgetExpansion,
    input.actual.merchants,
  )
  const hardGates = {
    scale: Object.values(targets).every((target) => target.passed),
    reconciliation:
      input.evidence.verifiedRedemptions > 0 &&
      input.evidence.reconciledCreatorPayouts === input.evidence.verifiedRedemptions,
    measurement:
      frozenCampaigns > 0 &&
      input.measurement.preRegisteredCampaigns === frozenCampaigns &&
      input.measurement.measurableCampaigns === frozenCampaigns,
    commercialSignal:
      input.commercial.merchantsWithRepeatCampaign + input.commercial.merchantsWithBudgetExpansion >
      0,
  }
  return {
    targets,
    evidence: {
      ...input.evidence,
      reconciliationRate,
      completeEvidenceChainRate,
      passed: hardGates.reconciliation,
    },
    measurement: {
      ...input.measurement,
      preRegistrationShare,
      measurableCampaignShare,
      passed: hardGates.measurement,
    },
    commercial: {
      ...input.commercial,
      repeatCampaignRate,
      budgetExpansionRate,
      passed: hardGates.commercialSignal,
    },
    creatorTasks: { ...input.creatorTasks, acceptanceRate: creatorTaskAcceptanceRate },
    hardGates,
    status: Object.values(hardGates).every(Boolean) ? 'ready_for_v2_p1_decision' : 'continue_pilot',
  }
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 10_000 : 0
}
