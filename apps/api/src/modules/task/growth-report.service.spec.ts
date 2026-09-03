import { GrowthReportService } from './growth-report.service'

describe('GrowthReportService', () => {
  it('keeps verified attribution separate from unmeasured incremental results and totals traceable spend', async () => {
    const merchantId = 'merchant-1',
      planId = 'plan-1',
      campaignId = 'campaign-1',
      taskId = 'growth-task-1'
    const plans: any = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: planId, merchantId, growthTaskId: taskId, campaignId }),
    }
    const growthTasks: any = {
      findOne: jest
        .fn()
        .mockResolvedValue({
          id: taskId,
          merchantId,
          goalMetric: '新增订单数',
          baselineValue: 10,
          targetValue: 30,
        }),
    }
    const campaigns: any = {
      findOne: jest
        .fn()
        .mockResolvedValue({
          id: campaignId,
          merchantId,
          campaignName: '新客 Campaign',
          campaignStatus: 'active',
        }),
    }
    const allocations: any = {
      find: jest.fn().mockResolvedValue([
        { category: 'campaign_credits', committedAmount: 30, spentAmount: 8 },
        { category: 'channel_cost', committedAmount: 10, spentAmount: 2 },
        { category: 'risk_reserve', committedAmount: 5, spentAmount: 1 },
      ]),
    }
    const creatorTasks: any = {
      find: jest
        .fn()
        .mockResolvedValue([
          {
            id: 'creator-task-1',
            creatorId: 'creator-1',
            trackingId: 'track-1',
            status: 'published',
          },
        ]),
    }
    const credits: any = {
      find: jest.fn().mockResolvedValue([{ entryType: 'consumption', amount: 5 }]),
    }
    const redemptions: any = {
      find: jest
        .fn()
        .mockResolvedValue([
          {
            id: 'redeem-1',
            merchantId,
            campaignId,
            customerId: 'customer-1',
            attributionId: 'attr-1',
            transactionAmount: 100,
            discountValue: 20,
            verifiedAt: new Date('2026-09-01'),
          },
        ]),
    }
    const commissions: any = {
      find: jest
        .fn()
        .mockResolvedValue([{ redemptionId: 'redeem-1', agentFinalPayout: 15, status: 'pending' }]),
    }
    const attributions: any = {
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 'attr-1', agentId: 'creator-1', lockStartedAt: new Date('2026-08-20') },
        ]),
    }
    const contents: any = {
      find: jest.fn().mockResolvedValue([{ id: 'content-1', creatorTaskId: 'creator-task-1' }]),
    }
    const publications: any = {
      find: jest
        .fn()
        .mockResolvedValue([
          { contentId: 'content-1', status: 'published', publishedAt: new Date('2026-08-25') },
        ]),
    }
    const ledger: any = {
      find: jest.fn().mockResolvedValue([
        { classification: 'cogs', amount: 10 },
        { classification: 'operating_cost', amount: 3 },
      ]),
    }
    const incrementality: any = {
      result: jest.fn().mockResolvedValue({
        status: 'not_measured', orders: null, gmv: null, label: '增量结果尚未测量',
        method: '尚未配置对照组、地域实验或经批准的因果模型。', assumptions: [], measurement: null,
      }),
    }
    const service = new GrowthReportService(
      plans,
      growthTasks,
      campaigns,
      allocations,
      creatorTasks,
      credits,
      redemptions,
      commissions,
      attributions,
      contents,
      publications,
      ledger,
      incrementality,
    )

    const result = await service.report(merchantId, planId)

    expect(result.goal).toMatchObject({ actualValue: 1, targetProgress: 0 })
    expect(result.verified).toMatchObject({
      orders: 1,
      newCustomers: 1,
      gmv: 100,
      attributionLocks: 1,
    })
    expect(result.incremental).toMatchObject({ status: 'not_measured', orders: null, gmv: null })
    expect(result.investment).toMatchObject({
      creatorPayout: 15,
      campaignCreditsCost: 8,
      campaignCreditsConsumed: 5,
      discountCost: 20,
      channelCost: 5,
      riskReserve: 1,
      total: 49,
      grossProfit: 51,
      roi: 1.0408,
    })
    expect(result.evidence.transactions[0]).toMatchObject({
      creatorTaskId: 'creator-task-1',
      trackingId: 'track-1',
      payout: 15,
    })
  })
})
