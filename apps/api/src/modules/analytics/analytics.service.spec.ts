// ============================================================
// AI auto - AnalyticsService Unit Tests
// Attribution chain tracking, funnel, ROI, and reporting
// ============================================================

import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { AnalyticsService } from './analytics.service'
import { CustomerAttribution } from '../customer/entities/customer-attribution.entity'
import { CustomerCoupon } from '../customer/entities/customer-coupon.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { Commission } from '../commission/entities/commission.entity'
import { Campaign } from '../campaign/entities/campaign.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { RedemptionStatus } from '@ai-auto/shared'

function makeRepo() {
  return {
    find: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  }
}

function makeQB() {
  const qb: any = {}
  const methods = [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'groupBy',
    'having',
    'orderBy',
    'take',
    'getRawMany',
    'getCount',
  ]
  methods.forEach((m) => {
    qb[m] = jest.fn().mockReturnThis()
  })
  qb.getRawMany.mockResolvedValue([])
  qb.getCount.mockResolvedValue(0)
  return qb
}

describe('AnalyticsService', () => {
  let service: AnalyticsService
  let attributionRepo: any
  let couponRepo: any
  let redemptionRepo: any
  let commissionRepo: any
  let campaignRepo: any
  let agentRepo: any

  beforeEach(async () => {
    attributionRepo = makeRepo()
    couponRepo = makeRepo()
    redemptionRepo = makeRepo()
    commissionRepo = makeRepo()
    campaignRepo = makeRepo()
    agentRepo = makeRepo()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(CustomerAttribution), useValue: attributionRepo },
        { provide: getRepositoryToken(CustomerCoupon), useValue: couponRepo },
        { provide: getRepositoryToken(Redemption), useValue: redemptionRepo },
        { provide: getRepositoryToken(Commission), useValue: commissionRepo },
        { provide: getRepositoryToken(Campaign), useValue: campaignRepo },
        { provide: getRepositoryToken(SharingAgent), useValue: agentRepo },
      ],
    }).compile()

    service = module.get<AnalyticsService>(AnalyticsService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ========================
  // getFunnelData()
  // ========================

  describe('getFunnelData()', () => {
    it('返回漏斗数据', async () => {
      attributionRepo.count = jest.fn().mockResolvedValue(100) // clicks
      couponRepo.count = jest.fn().mockResolvedValue(50) // claims
      redemptionRepo.count = jest.fn().mockResolvedValue(20) // redemptions
      redemptionRepo.find = jest.fn().mockResolvedValue([])

      const result = await service.getFunnelData('merchant-123', { campaignId: 'campaign-1' })

      expect(result.clicks).toBe(100)
      expect(result.claims).toBe(50)
      expect(result.redemptions).toBe(20)
      expect(result.impressions).toBeGreaterThanOrEqual(100)
    })

    it('无数据时返回零', async () => {
      attributionRepo.count = jest.fn().mockResolvedValue(0)
      couponRepo.count = jest.fn().mockResolvedValue(0)
      redemptionRepo.count = jest.fn().mockResolvedValue(0)
      redemptionRepo.find = jest.fn().mockResolvedValue([])

      const result = await service.getFunnelData('merchant-123', { campaignId: 'campaign-1' })

      expect(result.clicks).toBe(0)
      expect(result.claims).toBe(0)
      expect(result.redemptions).toBe(0)
    })

    it('复购计算正确', async () => {
      attributionRepo.count = jest.fn().mockResolvedValue(10)
      couponRepo.count = jest.fn().mockResolvedValue(5)
      redemptionRepo.count = jest.fn().mockResolvedValue(3)
      redemptionRepo.find = jest.fn().mockResolvedValue([
        { customerId: 'c1' },
        { customerId: 'c2' },
        { customerId: 'c1' }, // c1 复购
      ])

      const result = await service.getFunnelData('merchant-123', { campaignId: 'campaign-1' })

      expect(result.repurchases).toBe(1)
    })
  })

  // ========================
  // getAttributionChain()
  // ========================

  describe('getAttributionChain()', () => {
    it('返回全链路记录', async () => {
      const now = new Date()
      const lockExpired = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      couponRepo.findAndCount = jest.fn().mockResolvedValue([
        [
          {
            customerId: 'cust-1',
            couponName: '七夕优惠券',
            source: 'share_link',
            claimedAt: now,
            usedAt: null,
            redemptionId: null,
            discountAmount: 20,
            agentId: 'agent-1',
            attribution: {
              sourcePlatform: 'douyin',
              lockExpiredAt: lockExpired,
              agent: { nickname: '小王' },
            },
          },
        ],
        1,
      ])

      const result = await service.getAttributionChain('merchant-123', { campaignId: 'campaign-1' })

      expect(result.total).toBe(1)
      expect(result.items[0].agentNickname).toBe('小王')
      expect(result.items[0].platform).toBe('douyin')
      expect(result.items[0].lockDaysRemaining).toBe(30)
    })

    it('无数据时返回空列表', async () => {
      couponRepo.findAndCount = jest.fn().mockResolvedValue([[], 0])

      const result = await service.getAttributionChain('merchant-123', { campaignId: 'campaign-1' })

      expect(result.items).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    it('自然流量显示正确', async () => {
      couponRepo.findAndCount = jest.fn().mockResolvedValue([
        [
          {
            customerId: 'cust-1',
            couponName: '券',
            source: 'lbs',
            claimedAt: new Date(),
            agentId: null,
            attribution: null,
          },
        ],
        1,
      ])

      const result = await service.getAttributionChain('merchant-123', { campaignId: 'campaign-1' })

      expect(result.items[0].agentNickname).toBe('自然流量')
    })
  })

  // ========================
  // getPeriodComparison()
  // ========================

  describe('getPeriodComparison()', () => {
    it('计算环比变化', async () => {
      // current period
      attributionRepo.count = jest.fn().mockResolvedValue(100)
      couponRepo.count = jest.fn().mockResolvedValue(50)
      redemptionRepo.count = jest.fn().mockResolvedValue(20)
      commissionRepo.createQueryBuilder = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '500' }),
      }))
      redemptionRepo.createQueryBuilder = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '2000' }),
      }))

      const result = await service.getPeriodComparison(
        'merchant-123',
        '2026-01-01',
        '2026-01-07',
        'weekly',
      )

      expect(result.current.period).toContain('2026-01-01')
      expect(result.previous.period).toContain('2025-12')
    })

    it('除零保护', async () => {
      attributionRepo.count = jest.fn().mockResolvedValue(0)
      couponRepo.count = jest.fn().mockResolvedValue(0)
      redemptionRepo.count = jest.fn().mockResolvedValue(0)
      commissionRepo.createQueryBuilder = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      }))
      redemptionRepo.createQueryBuilder = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      }))

      const result = await service.getPeriodComparison(
        'merchant-123',
        '2026-01-08',
        '2026-01-14',
        'weekly',
      )

      expect(result.changes.impressions).toBe(0)
      expect(result.changes.commission).toBe(0)
    })
  })

  // ========================
  // getROI()
  // ========================

  describe('getROI()', () => {
    it('计算 ROI', async () => {
      redemptionRepo.find = jest.fn().mockResolvedValue([
        { customerId: 'c1', transactionAmount: 200, agentRewardAmount: 10 },
        { customerId: 'c2', transactionAmount: 300, agentRewardAmount: 15 },
      ])
      attributionRepo.count = jest.fn().mockResolvedValue(2)

      const result = await service.getROI('merchant-123', { campaignId: 'campaign-1' })

      expect(result.totalRedemptions).toBe(2)
      expect(result.totalTransactionAmount).toBe(500)
      expect(result.totalCommissionSpent).toBe(25)
      expect(result.avgCommissionPerOrder).toBe(12.5)
      expect(result.roi).toBe(20)
    })

    it('无核销时 ROI 为 0', async () => {
      redemptionRepo.find = jest.fn().mockResolvedValue([])
      attributionRepo.count = jest.fn().mockResolvedValue(0)

      const result = await service.getROI('merchant-123', { campaignId: 'campaign-1' })

      expect(result.roi).toBe(0)
      expect(result.totalCommissionSpent).toBe(0)
    })

    it('复购率计算正确', async () => {
      redemptionRepo.find = jest.fn().mockResolvedValue([
        { customerId: 'c1', transactionAmount: 100, agentRewardAmount: 5 },
        { customerId: 'c1', transactionAmount: 100, agentRewardAmount: 5 }, // c1 复购
        { customerId: 'c2', transactionAmount: 100, agentRewardAmount: 5 },
      ])
      attributionRepo.count = jest.fn().mockResolvedValue(2)

      const result = await service.getROI('merchant-123', { campaignId: 'campaign-1' })

      expect(result.totalRedemptions).toBe(3)
      expect(result.repurchaseCustomers).toBe(1)
      expect(result.repurchaseRate).toBe(50)
    })
  })

  // ========================
  // getTimeSeries()
  // ========================

  describe('getTimeSeries()', () => {
    it('生成日期序列', async () => {
      const qb = makeQB()
      redemptionRepo.createQueryBuilder = jest.fn(() => qb)
      couponRepo.createQueryBuilder = jest.fn(() => qb)
      attributionRepo.createQueryBuilder = jest.fn(() => qb)

      const result = await service.getTimeSeries(
        'merchant-123',
        '2026-01-01',
        '2026-01-03',
        'daily',
      )

      expect(result.length).toBeGreaterThanOrEqual(3)
      expect(result[0].date).toBe('2026-01-01')
    })

    it('月度分组', async () => {
      const qb = makeQB()
      redemptionRepo.createQueryBuilder = jest.fn(() => qb)
      couponRepo.createQueryBuilder = jest.fn(() => qb)
      attributionRepo.createQueryBuilder = jest.fn(() => qb)

      const result = await service.getTimeSeries(
        'merchant-123',
        '2026-01-01',
        '2026-03-31',
        'monthly',
      )

      expect(result.length).toBeGreaterThanOrEqual(3)
    })
  })

  // ========================
  // getAgentLeaderboard()
  // ========================

  describe('getAgentLeaderboard()', () => {
    it('返回排行榜', async () => {
      attributionRepo.find = jest.fn().mockResolvedValue([
        {
          agentId: 'agent-1',
          totalRedemptions: 10,
          totalCommission: 500,
          agent: { nickname: '小王' },
        },
        {
          agentId: 'agent-2',
          totalRedemptions: 5,
          totalCommission: 250,
          agent: { nickname: '小李' },
        },
      ])

      const result = await service.getAgentLeaderboard('merchant-123', { campaignId: 'campaign-1' })

      expect(result).toHaveLength(2)
      expect(result[0].rank).toBe(1)
      expect(result[0].nickname).toBe('小王')
      expect(result[1].rank).toBe(2)
    })

    it('未知昵称处理', async () => {
      attributionRepo.find = jest.fn().mockResolvedValue([
        {
          agentId: 'agent-1',
          totalRedemptions: 5,
          totalCommission: 100,
          agent: null,
        },
      ])

      const result = await service.getAgentLeaderboard('merchant-123', { campaignId: 'campaign-1' })

      expect(result[0].nickname).toBe('未知')
    })
  })
})
