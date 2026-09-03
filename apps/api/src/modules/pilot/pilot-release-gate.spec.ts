import { evaluatePilotReleaseGate } from './pilot-release-gate'

describe('evaluatePilotReleaseGate', () => {
  const fullPilot = {
    actual: { merchants: 10, creators: 50, frozenCampaigns: 30, publishedContents: 100 },
    evidence: {
      verifiedRedemptions: 120,
      reconciledCreatorPayouts: 120,
      completeEvidenceChains: 120,
    },
    measurement: { preRegisteredCampaigns: 30, measurableCampaigns: 30 },
    commercial: { merchantsWithRepeatCampaign: 3, merchantsWithBudgetExpansion: 2 },
    creatorTasks: { invited: 160, accepted: 100 },
  }

  it('marks a complete mock pilot ready for the V2-P1 decision', () => {
    const result = evaluatePilotReleaseGate(fullPilot)

    expect(result.status).toBe('ready_for_v2_p1_decision')
    expect(result.evidence).toMatchObject({
      reconciliationRate: 1,
      completeEvidenceChainRate: 1,
      passed: true,
    })
    expect(result.measurement).toMatchObject({
      preRegistrationShare: 1,
      measurableCampaignShare: 1,
      passed: true,
    })
    expect(result.commercial).toMatchObject({
      repeatCampaignRate: 0.3,
      budgetExpansionRate: 0.2,
      passed: true,
    })
    expect(result.creatorTasks.acceptanceRate).toBe(0.625)
  })

  it('keeps the pilot running if evidence cannot reconcile or measurement was not pre-registered', () => {
    const result = evaluatePilotReleaseGate({
      ...fullPilot,
      evidence: { ...fullPilot.evidence, reconciledCreatorPayouts: 119 },
      measurement: { preRegisteredCampaigns: 29, measurableCampaigns: 29 },
      commercial: { merchantsWithRepeatCampaign: 0, merchantsWithBudgetExpansion: 0 },
    })

    expect(result.status).toBe('continue_pilot')
    expect(result.hardGates).toMatchObject({
      scale: true,
      reconciliation: false,
      measurement: false,
      commercialSignal: false,
    })
  })
})
