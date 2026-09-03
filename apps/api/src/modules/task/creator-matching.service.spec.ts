import { AuditStatus } from '@ai-auto/shared'
import { AgentPlatformAccount } from '../agent/entities/agent-platform-account.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { Store } from '../merchant/entities/store.entity'
import { CampaignBudgetAllocation } from './entities/campaign-budget-allocation.entity'
import { CreatorTask, GrowthTask } from './entities/growth-task.entity'
import { CreatorMatchingService } from './creator-matching.service'

describe('CreatorMatchingService', () => {
  const merchantId = '11111111-1111-4111-8111-111111111111'
  const growthTaskId = '22222222-2222-4222-8222-222222222222'
  const creatorId = '33333333-3333-4333-8333-333333333333'
  const growth: any = {
    id: growthTaskId,
    merchantId,
    status: 'active',
    campaignId: '44444444-4444-4444-8444-444444444444',
    storeId: null,
    endAt: new Date(Date.now() + 86_400_000),
    compensationReserved: 0,
    campaignCreditsReserved: 0,
  }
  const creator: any = {
    id: creatorId,
    status: true,
    auditStatus: AuditStatus.APPROVED,
    realNameVerified: true,
    creatorGrowthScore: 80,
    creatorGrowthLevel: 4,
    creatorCategories: ['餐饮'],
    creatorTaskLimit: 3,
    nickname: '小林',
    avatar: null,
    region: '北京市朝阳区',
  }
  const allocation: any = [
    { category: 'creator_payout', status: 'funded', committedAmount: 500 },
    { category: 'campaign_credits', status: 'funded', committedAmount: 100 },
  ]

  function setup() {
    const manager: any = {
      findOne: jest.fn(async (entity) => (entity === GrowthTask ? growth : null)),
      find: jest.fn(async (entity) => {
        if (entity === SharingAgent) return [creator]
        if (entity === AgentPlatformAccount)
          return [{ agentId: creatorId, platformType: 'douyin', status: true }]
        if (entity === CreatorTask) return []
        if (entity === Store) return []
        return []
      }),
      getRepository: jest.fn(() => ({ find: jest.fn(async () => allocation) })),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (entity, value) => {
        const saved = value ?? entity
        if (entity === CreatorTask && Array.isArray(value))
          return value.map((item, index) => ({ ...item, id: `task-${index}` }))
        return saved
      }),
    }
    const growthRepo: any = { findOne: jest.fn(async () => growth), manager }
    const allocationRepo: any = { find: jest.fn(async () => allocation) }
    const dataSource: any = { transaction: jest.fn((callback) => callback(manager)) }
    return { service: new CreatorMatchingService(growthRepo, allocationRepo, dataSource), manager }
  }

  it('returns only eligible, channel-ready creators with an explanation', async () => {
    const { service } = setup()
    const result = await service.listMatches(merchantId, growthTaskId, {
      channel: 'douyin',
      categories: ['餐饮'],
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      creatorId,
      matchingScore: expect.any(Number),
      explanation: expect.objectContaining({
        reasons: expect.arrayContaining(['内容类目符合要求']),
      }),
    })
  })

  it('creates invited Creator Tasks atomically and reserves category-safe budget', async () => {
    const { service, manager } = setup()
    const result = await service.invite(merchantId, growthTaskId, {
      channel: 'douyin',
      contentType: 'short_video',
      creatorIds: [creatorId],
      brief: '探店短视频',
      deadline: new Date(Date.now() + 3_600_000).toISOString(),
      baseReward: 100,
      campaignCredits: 10,
    })

    expect(result).toMatchObject({
      invitedCount: 1,
      items: [expect.objectContaining({ creatorId, status: 'invited' })],
    })
    expect(growth.compensationReserved).toBe(100)
    expect(growth.campaignCreditsReserved).toBe(10)
    expect(manager.save).toHaveBeenCalledWith(
      CreatorTask,
      expect.arrayContaining([expect.objectContaining({ status: 'invited' })]),
    )
  })
})
