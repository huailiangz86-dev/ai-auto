// ============================================================
// AI auto - AgentReputationService Unit Tests
// Level calculation, commission multiplier, and scheduled refresh
// ============================================================

import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { AgentReputationService, LEVEL_CONFIG } from './agent-reputation.service'
import { SharingAgent } from './entities/sharing-agent.entity'
import { CustomerAttribution } from '../customer/entities/customer-attribution.entity'
import { AgentLevel } from '@ai-auto/shared'
import { REDIS_CLIENT } from '../redis/redis.module'

function makeRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(),
  }
}

describe('AgentReputationService', () => {
  let service: AgentReputationService
  let agentRepo: any
  let attributionRepo: any
  let redis: any

  beforeEach(async () => {
    agentRepo = makeRepo()
    attributionRepo = makeRepo()

    redis = {
      get: jest.fn(),
      setex: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentReputationService,
        { provide: getRepositoryToken(SharingAgent), useValue: agentRepo },
        { provide: getRepositoryToken(CustomerAttribution), useValue: attributionRepo },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile()

    service = module.get<AgentReputationService>(AgentReputationService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ========================
  // computeLevel()
  // ========================

  describe('computeLevel()', () => {
    // 测试私有方法
    const computeLevel = (validCustomers: number) => (service as any).computeLevel(validCustomers)

    it('0-10 客户 → 青铜', () => {
      expect(computeLevel(0)).toBe(AgentLevel.BRONZE)
      expect(computeLevel(5)).toBe(AgentLevel.BRONZE)
      expect(computeLevel(10)).toBe(AgentLevel.BRONZE)
    })

    it('11-50 客户 → 白银', () => {
      expect(computeLevel(11)).toBe(AgentLevel.SILVER)
      expect(computeLevel(30)).toBe(AgentLevel.SILVER)
      expect(computeLevel(50)).toBe(AgentLevel.SILVER)
    })

    it('51-200 客户 → 黄金', () => {
      expect(computeLevel(51)).toBe(AgentLevel.GOLD)
      expect(computeLevel(100)).toBe(AgentLevel.GOLD)
      expect(computeLevel(200)).toBe(AgentLevel.GOLD)
    })

    it('201-500 客户 → 钻石', () => {
      expect(computeLevel(201)).toBe(AgentLevel.DIAMOND)
      expect(computeLevel(350)).toBe(AgentLevel.DIAMOND)
      expect(computeLevel(500)).toBe(AgentLevel.DIAMOND)
    })

    it('501+ 客户 → 王者', () => {
      expect(computeLevel(501)).toBe(AgentLevel.KING)
      expect(computeLevel(1000)).toBe(AgentLevel.KING)
    })
  })

  // ========================
  // getMultiplier()
  // ========================

  describe('getMultiplier()', () => {
    it('返回正确乘数', () => {
      expect(service.getMultiplier(AgentLevel.BRONZE)).toBe(1.0)
      expect(service.getMultiplier(AgentLevel.SILVER)).toBe(1.1)
      expect(service.getMultiplier(AgentLevel.GOLD)).toBe(1.2)
      expect(service.getMultiplier(AgentLevel.DIAMOND)).toBe(1.5)
      expect(service.getMultiplier(AgentLevel.KING)).toBe(2.0)
    })
  })

  // ========================
  // calculateReputation()
  // ========================

  describe('calculateReputation()', () => {
    it('命中缓存时直接返回', async () => {
      const cachedInfo = {
        agentId: 'agent-1',
        reputationScore: 25,
        level: AgentLevel.SILVER,
        levelLabel: '白银',
        commissionMultiplier: 1.1,
        currentLevelMin: 11,
        nextLevelMin: 51,
        progress: 35,
        rolling12Months: 25,
        updatedAt: new Date().toISOString(),
      }
      redis.get.mockResolvedValueOnce(JSON.stringify(cachedInfo))

      const result = await service.calculateReputation('agent-1')

      expect(result.level).toBe(AgentLevel.SILVER)
      expect(result.reputationScore).toBe(25)
      expect(redis.get).toHaveBeenCalledWith('agent:level:agent-1')
    })

    it('缓存未命中时计算并缓存', async () => {
      redis.get.mockResolvedValueOnce(null)
      attributionRepo.createQueryBuilder = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '25' }),
      }))
      agentRepo.findOne.mockResolvedValueOnce({
        id: 'agent-1',
        levelUpdatedAt: new Date(),
      })

      const result = await service.calculateReputation('agent-1')

      expect(result.reputationScore).toBe(25)
      expect(result.level).toBe(AgentLevel.SILVER) // 25 >= 11
      expect(result.commissionMultiplier).toBe(1.1)
      expect(redis.setex).toHaveBeenCalled()
    })

    it('青铜等级边界值', async () => {
      redis.get.mockResolvedValueOnce(null)
      attributionRepo.createQueryBuilder = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '10' }),
      }))
      agentRepo.findOne.mockResolvedValueOnce({ id: 'agent-1', levelUpdatedAt: new Date() })

      const result = await service.calculateReputation('agent-1')

      expect(result.level).toBe(AgentLevel.BRONZE)
      expect(result.commissionMultiplier).toBe(1.0)
      // 青铜: (10 - 0) / (11 - 0) * 100 = 91%
      expect(result.progress).toBe(91)
    })

    it('王者等级进度为100%', async () => {
      redis.get.mockResolvedValueOnce(null)
      attributionRepo.createQueryBuilder = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '800' }),
      }))
      agentRepo.findOne.mockResolvedValueOnce({ id: 'agent-1', levelUpdatedAt: new Date() })

      const result = await service.calculateReputation('agent-1')

      expect(result.level).toBe(AgentLevel.KING)
      expect(result.progress).toBe(100)
      expect(result.nextLevelMin).toBeNull()
    })
  })

  // ========================
  // invalidateCache()
  // ========================

  describe('invalidateCache()', () => {
    it('清除单条缓存', async () => {
      await service.invalidateCache('agent-1')

      expect(redis.del).toHaveBeenCalledWith('agent:level:agent-1')
      expect(redis.del).toHaveBeenCalledWith('agent:leaderboard')
    })
  })

  describe('invalidateAllCache()', () => {
    it('清除所有缓存', async () => {
      redis.keys.mockResolvedValueOnce(['agent:level:agent-1', 'agent:level:agent-2'])

      await service.invalidateAllCache()

      expect(redis.keys).toHaveBeenCalledWith('agent:level:*')
      expect(redis.del).toHaveBeenCalledWith('agent:level:agent-1', 'agent:level:agent-2')
      expect(redis.del).toHaveBeenCalledWith('agent:leaderboard')
    })

    it('无缓存时跳过', async () => {
      redis.keys.mockResolvedValueOnce([])

      await service.invalidateAllCache()

      expect(redis.del).toHaveBeenCalledWith('agent:leaderboard')
    })
  })

  // ========================
  // LEVEL_CONFIG 边界值
  // ========================

  describe('LEVEL_CONFIG', () => {
    it('所有等级都有配置', () => {
      expect(LEVEL_CONFIG[AgentLevel.BRONZE]).toBeDefined()
      expect(LEVEL_CONFIG[AgentLevel.SILVER]).toBeDefined()
      expect(LEVEL_CONFIG[AgentLevel.GOLD]).toBeDefined()
      expect(LEVEL_CONFIG[AgentLevel.DIAMOND]).toBeDefined()
      expect(LEVEL_CONFIG[AgentLevel.KING]).toBeDefined()
    })

    it('等级乘数递增', () => {
      const multipliers = [
        LEVEL_CONFIG[AgentLevel.BRONZE].multiplier,
        LEVEL_CONFIG[AgentLevel.SILVER].multiplier,
        LEVEL_CONFIG[AgentLevel.GOLD].multiplier,
        LEVEL_CONFIG[AgentLevel.DIAMOND].multiplier,
        LEVEL_CONFIG[AgentLevel.KING].multiplier,
      ]
      for (let i = 1; i < multipliers.length; i++) {
        expect(multipliers[i]).toBeGreaterThan(multipliers[i - 1])
      }
    })
  })
})
