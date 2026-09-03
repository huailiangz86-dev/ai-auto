import { PilotMeasurementService } from './pilot-measurement.service'

const week = '2026-09-07T00:00:00.000Z'
const point = '2026-09-09T10:00:00.000Z'

function repo<T>(items: T[] = []) {
  return {
    find: jest.fn().mockResolvedValue(items),
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
    createQueryBuilder: jest.fn(),
  }
}

describe('PilotMeasurementService mock end-to-end evidence acceptance', () => {
  it('enforces an activation-ready protocol and aggregates consent → claim → redemption → payout → report without gaps', async () => {
    const campaigns: any[] = [
      {
        id: 'campaign-1',
        merchantId: 'merchant-1',
        campaignStatus: 'active',
        maxBudget: 100,
        createdAt: new Date('2026-09-01'),
      },
      {
        id: 'campaign-2',
        merchantId: 'merchant-1',
        campaignStatus: 'active',
        maxBudget: 150,
        createdAt: new Date('2026-09-08'),
      },
    ]
    const protocols: any[] = [
      {
        id: 'protocol-1',
        campaignId: 'campaign-1',
        merchantId: 'merchant-1',
        method: 'geo_holdout',
        experimentGroupDefinition: '上海实验门店',
        controlGroupDefinition: '苏州对照门店',
        baselineStartAt: new Date('2026-08-01'),
        baselineEndAt: new Date('2026-08-31'),
        observationStartAt: new Date('2026-09-01'),
        observationEndAt: new Date('2026-09-30'),
        ordersDefinition: '已验证核销订单',
        gmvDefinition: '已验证交易金额',
        registeredAt: new Date('2026-08-30'),
      },
      {
        id: 'protocol-2',
        campaignId: 'campaign-2',
        merchantId: 'merchant-1',
        method: 'geo_holdout',
        experimentGroupDefinition: '上海实验门店',
        controlGroupDefinition: '苏州对照门店',
        baselineStartAt: new Date('2026-08-08'),
        baselineEndAt: new Date('2026-09-07'),
        observationStartAt: new Date('2026-09-08'),
        observationEndAt: new Date('2026-10-07'),
        ordersDefinition: '已验证核销订单',
        gmvDefinition: '已验证交易金额',
        registeredAt: new Date('2026-09-07'),
      },
    ]
    const protocolRepo: any = repo(protocols)
    protocolRepo.findOne.mockResolvedValue(protocols[0])
    protocolRepo.find.mockResolvedValueOnce([protocols[0]]).mockResolvedValueOnce(protocols)
    const eventRepo: any = repo([
      { eventType: 'campaign_activated', campaignId: 'campaign-1', subjectId: 'campaign-1' },
      { eventType: 'campaign_activated', campaignId: 'campaign-2', subjectId: 'campaign-2' },
      { eventType: 'task_invited', campaignId: 'campaign-2', subjectId: 'task-1' },
      { eventType: 'task_accepted', campaignId: 'campaign-2', subjectId: 'task-1' },
    ])
    const service = new PilotMeasurementService(
      protocolRepo as any,
      repo(campaigns) as any,
      repo([{ id: 'coupon-1', campaignId: 'campaign-1' }]) as any,
      repo([
        {
          id: 'claim-1',
          couponId: 'coupon-1',
          couponCode: 'CP-1',
          redemptionId: 'redemption-1',
          trackingConsent: true,
          trackingConsentedAt: new Date(point),
          claimedAt: new Date(point),
        },
      ]) as any,
      repo([
        {
          id: 'redemption-1',
          campaignId: 'campaign-1',
          couponCode: 'CP-1',
          attributionId: 'attr-1',
          transactionAmount: 288,
          status: 'verified',
          verifiedAt: new Date(point),
          createdAt: new Date(point),
        },
      ]) as any,
      repo([{ id: 'attr-1', agentId: 'creator-1' }]) as any,
      repo([
        {
          id: 'task-1',
          campaignId: 'campaign-1',
          status: 'accepted',
          stateChangedAt: new Date(point),
          createdAt: new Date(point),
        },
      ]) as any,
      repo([
        {
          id: 'payout-1',
          campaignId: 'campaign-1',
          creatorId: 'creator-1',
          status: 'verified',
          expectedAmount: 60,
          verifiedAmount: 60,
          verifiedAt: new Date(point),
          createdAt: new Date(point),
        },
      ]) as any,
      eventRepo as any,
    )

    await expect(
      service.assertActivationAllowed('merchant-1', 'campaign-1'),
    ).resolves.toBeUndefined()
    const weekly = await service.weeklyEvidence({ campaignId: 'campaign-1', weekStartAt: week })
    expect(weekly.summary).toMatchObject({
      preRegisteredCampaigns: 1,
      consented: 1,
      claimed: 1,
      redeemed: 1,
      creatorPayouts: 1,
      reports: 1,
      discrepancyCount: 0,
    })
    expect(weekly.discrepancies[0]).toMatchObject({
      redemptionId: 'redemption-1',
      reportIncluded: true,
      missingStages: [],
    })

    await expect(service.operationsMetrics()).resolves.toMatchObject({
      repeatCampaignRate: 1,
      budgetExpansionRate: 1,
      validTaskAcceptanceRate: 1,
      measurableCampaignShare: 1,
    })
  })
})
