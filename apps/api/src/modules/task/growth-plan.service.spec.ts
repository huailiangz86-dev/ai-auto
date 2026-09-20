import { GrowthPlanService } from './growth-plan.service'
import { Campaign } from '../campaign/entities/campaign.entity'
import { Coupon } from '../campaign/entities/coupon.entity'
import { AuditLog } from '../admin/entities/audit-log.entity'
import { GrowthPlan } from './entities/growth-plan.entity'
import { GrowthTask } from './entities/growth-task.entity'

const store = (id: string, storeName: string) =>
  ({ id, storeName, storeCode: id.toUpperCase() }) as any

function makeService() {
  return new GrowthPlanService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  )
}

describe('GrowthPlanService conversational intake', () => {
  it('always lists missing fields instead of returning a generic recognition failure', () => {
    const service = makeService()

    const result = (service as any).replyFor('无法识别，请换一种说法', ['target_value', 'budget'], {
      goalMetric: '新增订单数',
    })

    expect(result).toContain('还需要补充：目标值、总预算')
    expect(result).toContain('不需要重新开始')
    expect(result).not.toContain('无法识别')
    expect(result).not.toContain('请换一种说法')
  })

  it('merges a later budget message with previously recognized fields', () => {
    const service = makeService()
    const current = {
      goalBrief: '望京店新增到店新客',
      goalMetric: '新增到店核销数',
      targetValue: 200,
      startAt: '2026-10-01T00:00:00+08:00',
      endAt: '2026-10-07T23:59:59+08:00',
      storeId: 'store-1',
      storeName: '望京店',
      storeScope: 'specific',
    }

    const result = (service as any).normalizeIntake(
      { reply: '已记录预算。', extracted: { budget: 10000 } },
      current,
      [store('store-1', '望京店')],
    )

    expect(result.ready).toBe(true)
    expect(result.missing).toEqual([])
    expect(result.extracted).toMatchObject({
      goalMetric: '新增到店核销数',
      targetValue: 200,
      budget: 10000,
      storeId: 'store-1',
      storeName: '望京店',
    })
  })

  it('clears a previous concrete store when the merchant changes scope to all stores', () => {
    const service = makeService()
    const result = (service as any).normalizeIntake(
      {
        extracted: {
          store_scope: 'all',
          store_id: null,
          store_name: null,
        },
      },
      {
        goalBrief: '全店拉新',
        goalMetric: '新增订单数',
        targetValue: 100,
        budget: 5000,
        startAt: '2026-10-01T00:00:00+08:00',
        endAt: '2026-10-07T23:59:59+08:00',
        storeId: 'store-1',
        storeName: '望京店',
        storeScope: 'specific',
      },
      [store('store-1', '望京店')],
    )

    expect(result.extracted.storeScope).toBe('all')
    expect(result.extracted.storeId).toBeNull()
    expect(result.extracted.storeName).toBe('全部门店')
    expect(result.ready).toBe(true)
  })

  it('keeps the current draft when the AI service is unavailable and fallback parses the new budget', async () => {
    const stores = { find: jest.fn().mockResolvedValue([store('store-1', '望京店')]) }
    const ai = { growthIntake: jest.fn().mockRejectedValue(new Error('AI unavailable')) }
    const service = new GrowthPlanService(
      {} as any,
      {} as any,
      stores as any,
      {} as any,
      {} as any,
      ai as any,
      {} as any,
    )

    const result = await service.intake('merchant-1', {
      message: '预算 1 万元',
      current: {
        goalBrief: '望京店拉新',
        goalMetric: '新增订单数',
        targetValue: 200,
        startAt: '2026-10-01T00:00:00+08:00',
        endAt: '2026-10-07T23:59:59+08:00',
        storeId: 'store-1',
        storeName: '望京店',
        storeScope: 'specific',
      },
    })

    expect(result.ready).toBe(true)
    expect(result.extracted).toMatchObject({
      goalMetric: '新增订单数',
      targetValue: 200,
      budget: 10000,
      storeId: 'store-1',
    })
    expect(result.reply).toContain('信息已经齐全')
  })

  it('does not turn a budget-only fallback message into a fake growth goal', async () => {
    const stores = { find: jest.fn().mockResolvedValue([]) }
    const ai = { growthIntake: jest.fn().mockRejectedValue(new Error('AI unavailable')) }
    const service = new GrowthPlanService(
      {} as any,
      {} as any,
      stores as any,
      {} as any,
      {} as any,
      ai as any,
      {} as any,
    )

    const result = await service.intake('merchant-1', { message: '预算 1 万元' })

    expect(result.extracted.goalBrief).toBeNull()
    expect(result.missing).toContain('goal_brief')
    expect(result.reply).toContain('完整增长目标')
  })

  it('extracts the fields already present in a natural-language follow-up', async () => {
    const stores = { find: jest.fn().mockResolvedValue([store('store-1', '望京店')]) }
    const ai = { growthIntake: jest.fn().mockRejectedValue(new Error('AI unavailable')) }
    const service = new GrowthPlanService(
      {} as any,
      {} as any,
      stores as any,
      {} as any,
      {} as any,
      ai as any,
      {} as any,
    )

    const result = await service.intake('merchant-1', {
      message:
        '增长目标需要达到新客200人，订单额达到1万元，总预算1万，从9月19日9点开始到9月30日零点，适用所有门店',
      current: { goalBrief: '中秋节花1万做一个活动，活动7天' },
    })

    expect(result.ready).toBe(true)
    expect(result.missing).toEqual([])
    expect(result.extracted).toMatchObject({
      goalMetric: '新增到店核销数',
      targetValue: 200,
      budget: 10000,
      storeScope: 'all',
      storeId: null,
      storeName: '全部门店',
    })
    expect(result.extracted.startAt).toMatch(/2026-09-19T09:00:00\+08:00/)
    expect(result.extracted.endAt).toMatch(/2026-09-30T00:00:00\+08:00/)
    expect(result.reply).toContain('信息已经齐全')
  })

  it('approving a plan atomically creates and links a campaign and coupon', async () => {
    const plan: any = {
      id: '11111111-1111-4111-8111-111111111111',
      merchantId: 'merchant-1',
      growthTaskId: '22222222-2222-4222-8222-222222222222',
      goalBrief: '望京店新增到店新客',
      title: '新增到店核销数增长计划',
      status: 'proposed',
      alternatives: [
        {
          optionId: 1,
          title: '稳健拉新方案',
          campaignType: 'discount',
          offer: { thresholdAmount: 100, discountAmount: 20 },
          targetAudience: '新客',
          creatorStrategy: {
            channels: ['douyin'],
            recommendedCreatorCount: 3,
            contentTypes: ['short_video'],
            rationale: '本地匹配',
          },
          budgetAllocation: { creatorPayout: 45, campaignCredits: 10, offerCost: 35, reserve: 10 },
          expectedOutcome: {
            metric: '新增到店核销数',
            low: 10,
            likely: 20,
            high: 30,
            expectedRoi: 1.2,
          },
          assumptions: [],
        },
      ],
    }
    const task: any = {
      id: plan.growthTaskId,
      merchantId: 'merchant-1',
      storeId: null,
      startAt: new Date('2026-10-01T00:00:00Z'),
      endAt: new Date('2026-10-07T23:59:59Z'),
      budget: 10000,
      status: 'draft',
    }
    const manager: any = {
      findOne: jest.fn().mockResolvedValueOnce(plan).mockResolvedValueOnce(task),
      create: jest.fn((entity, values) => ({ ...values })),
      save: jest.fn((entity, value) => {
        if (entity === Campaign) return Promise.resolve({ ...value, id: 'campaign-1' })
        if (entity === Coupon) return Promise.resolve({ ...value, id: 'coupon-1' })
        return Promise.resolve(value)
      }),
    }
    const dataSource = { transaction: jest.fn((callback) => callback(manager)) }
    const service = new GrowthPlanService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource as any,
    )

    const result = await service.approve('merchant-1', plan.id, { optionId: 1 })

    expect(result).toMatchObject({ campaignId: 'campaign-1', couponId: 'coupon-1' })
    expect(manager.create).toHaveBeenCalledWith(
      Coupon,
      expect.objectContaining({
        campaignId: 'campaign-1',
        couponType: 'discount',
        thresholdAmount: 100,
        discountAmount: 20,
      }),
    )
    expect(plan.campaignId).toBe('campaign-1')
    expect(plan.couponId).toBe('coupon-1')
    expect(manager.save).toHaveBeenCalledWith(
      AuditLog,
      expect.objectContaining({
        metadata: expect.objectContaining({ campaignId: 'campaign-1', couponId: 'coupon-1' }),
      }),
    )
  })

  it('repairs an approved legacy plan that has a campaign but no coupon link', async () => {
    const plan: any = {
      id: '33333333-3333-4333-8333-333333333333',
      merchantId: 'merchant-1',
      growthTaskId: '44444444-4444-4444-8444-444444444444',
      status: 'approved',
      campaignId: 'campaign-legacy',
      couponId: null,
      selectedOptionId: 1,
      alternatives: [
        {
          optionId: 1,
          title: '历史拉新方案',
          campaignType: 'discount',
          offer: { thresholdAmount: 100, discountAmount: 20 },
          targetAudience: '新客',
          creatorStrategy: {
            channels: ['douyin'],
            recommendedCreatorCount: 3,
            contentTypes: ['short_video'],
            rationale: '本地匹配',
          },
          budgetAllocation: { creatorPayout: 45, campaignCredits: 10, offerCost: 35, reserve: 10 },
          expectedOutcome: {
            metric: '新增到店核销数',
            low: 10,
            likely: 20,
            high: 30,
            expectedRoi: 1.2,
          },
          assumptions: [],
        },
      ],
    }
    const task: any = {
      id: plan.growthTaskId,
      merchantId: 'merchant-1',
      campaignId: 'campaign-legacy',
      storeId: null,
      startAt: new Date('2026-10-01T00:00:00Z'),
      endAt: new Date('2026-10-07T23:59:59Z'),
      budget: 10000,
    }
    const campaign = { id: 'campaign-legacy', merchantId: 'merchant-1' }
    const manager: any = {
      findOne: jest.fn((entity) => {
        if (entity === GrowthPlan) return Promise.resolve(plan)
        if (entity === GrowthTask) return Promise.resolve(task)
        if (entity === Campaign) return Promise.resolve(campaign)
        if (entity === Coupon) return Promise.resolve(null)
        return Promise.resolve(null)
      }),
      create: jest.fn((_, value) => ({ ...value })),
      save: jest.fn((entity, value) =>
        entity === Coupon
          ? Promise.resolve({ ...value, id: 'coupon-repaired' })
          : Promise.resolve(value),
      ),
    }
    const dataSource = { transaction: jest.fn((callback) => callback(manager)) }
    const service = new GrowthPlanService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource as any,
    )

    const result = await (service as any).ensureApprovedAssets('merchant-1', plan)

    expect(result).toMatchObject({ campaignId: 'campaign-legacy', couponId: 'coupon-repaired' })
    expect(manager.create).toHaveBeenCalledWith(
      Coupon,
      expect.objectContaining({
        campaignId: 'campaign-legacy',
        couponCode: expect.stringContaining('GP-'),
      }),
    )
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ couponId: 'coupon-repaired' }),
    )
  })

  it('approving a creator-content plan creates a campaign conversion coupon and exposes creator deliverables', async () => {
    const plan: any = {
      id: '55555555-5555-4555-8555-555555555555',
      merchantId: 'merchant-1',
      growthTaskId: '66666666-6666-4666-8666-666666666666',
      goalBrief: '请达人发布探店图文并带来新客',
      title: '达人内容引流计划',
      status: 'proposed',
      alternatives: [
        {
          optionId: 1,
          title: '图文引流方案',
          taskType: 'creator_content',
          campaignType: 'discount',
          offer: { thresholdAmount: 0 },
          targetAudience: '本地兴趣人群',
          creatorStrategy: {
            channels: ['xiaohongshu'],
            recommendedCreatorCount: 3,
            contentTypes: ['graphic'],
            rationale: '按内容质量匹配达人',
          },
          contentBrief: '发布门店体验图文，带专属链接引流',
          creatorDeliverables: {
            contentTypes: ['graphic'],
            channels: ['xiaohongshu'],
            callToAction: '点击专属链接到店',
          },
          budgetAllocation: {
            creatorPayout: 6500,
            campaignCredits: 2000,
            offerCost: 0,
            reserve: 1500,
          },
          expectedOutcome: {
            metric: '新增到店核销数',
            low: 10,
            likely: 20,
            high: 30,
            expectedRoi: 1.2,
          },
          assumptions: [],
        },
      ],
    }
    const task: any = {
      id: plan.growthTaskId,
      merchantId: 'merchant-1',
      storeId: null,
      startAt: new Date('2026-10-01T00:00:00Z'),
      endAt: new Date('2026-10-07T23:59:59Z'),
      budget: 10000,
      status: 'draft',
    }
    const manager: any = {
      findOne: jest.fn().mockResolvedValueOnce(plan).mockResolvedValueOnce(task),
      create: jest.fn((entity, values) => ({ ...values })),
      save: jest.fn((entity, value) => {
        if (entity === Campaign) return Promise.resolve({ ...value, id: 'campaign-creator' })
        if (entity === Coupon) return Promise.resolve({ ...value, id: 'coupon-creator' })
        return Promise.resolve(value)
      }),
    }
    const service = new GrowthPlanService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { transaction: jest.fn((callback) => callback(manager)) } as any,
    )

    const result = await service.approve('merchant-1', plan.id, { optionId: 1 })

    expect(result).toMatchObject({
      campaignId: 'campaign-creator',
      couponId: 'coupon-creator',
      taskType: 'creator_content',
    })
    expect(manager.create).toHaveBeenCalledWith(
      Coupon,
      expect.objectContaining({ campaignId: 'campaign-creator' }),
    )
    expect(manager.create).toHaveBeenCalledWith(
      Campaign,
      expect.objectContaining({ purpose: 'creator_content' }),
    )
    expect(result.growthTask).toMatchObject({
      contentBrief: '发布门店体验图文，带专属链接引流',
      creatorDeliverables: {
        contentTypes: ['graphic'],
        channels: ['xiaohongshu'],
        callToAction: '点击专属链接到店',
      },
    })
  })
})
