// ============================================================
// AI auto - CommissionService Unit Tests
// Commission calculation: 80% to agent, 20% platform fee
// ============================================================

import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { NotFoundException } from '@nestjs/common'

import { CommissionService } from './commission.service'
import { Commission } from './entities/commission.entity'
import { Redemption } from './entities/redemption.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'

function createMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
  }
}

describe('CommissionService', () => {
  let service: CommissionService
  let commissionRepo: any
  let redemptionRepo: any
  let walletRepo: any
  let dataSource: any

  beforeEach(async () => {
    commissionRepo = createMockRepo()
    redemptionRepo = createMockRepo()
    walletRepo = createMockRepo()

    const mockManager = {
      create: jest.fn((_, data) => ({ id: 'comm-1', ...data })),
      save: jest.fn((data) => Promise.resolve(data)),
      update: jest.fn(),
      increment: jest.fn(),
    }

    dataSource = {
      transaction: jest.fn((fn: (manager: any) => Promise<any>) => fn(mockManager)),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionService,
        { provide: getRepositoryToken(Commission), useValue: commissionRepo },
        { provide: getRepositoryToken(Redemption), useValue: redemptionRepo },
        { provide: getRepositoryToken(AgentWallet), useValue: walletRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile()

    service = module.get<CommissionService>(CommissionService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ========================
  // calculateCommission()
  // ========================

  describe('calculateCommission()', () => {
    const mockRedemption = {
      id: 'redemption-1',
      customerId: 'customer-1',
      merchantId: 'merchant-1',
      agentRewardAmount: 10,
      createdAt: new Date(),
      attribution: {
        id: 'attr-1',
        agentId: 'agent-1',
        campaignId: 'campaign-1',
        lockExpiredAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 未过期
        totalRedemptions: 0,
        totalCommission: 0,
      },
    }

    it('幂等：已计算的 redemption 直接返回', async () => {
      commissionRepo.findOne.mockResolvedValueOnce({
        id: 'comm-existing',
        agentFinalPayout: 8,
      })

      const result = await service.calculateCommission('redemption-1')

      expect(result.commissionId).toBe('comm-existing')
      expect(result.agentPayout).toBe(8)
    })

    it('核销记录不存在时抛出 NotFoundException', async () => {
      commissionRepo.findOne.mockResolvedValueOnce(null)
      redemptionRepo.findOne.mockResolvedValueOnce(null)

      await expect(service.calculateCommission('non-existent')).rejects.toThrow(NotFoundException)
    })

    it('无归属时返回零佣金', async () => {
      commissionRepo.findOne.mockResolvedValueOnce(null)
      redemptionRepo.findOne.mockResolvedValueOnce({
        id: 'redemption-1',
        attribution: null,
      })

      const result = await service.calculateCommission('redemption-1')

      expect(result.agentPayout).toBe(0)
      expect(result.commissionId).toBe('')
    })

    it('归属已过期时返回零佣金', async () => {
      commissionRepo.findOne.mockResolvedValueOnce(null)
      redemptionRepo.findOne.mockResolvedValueOnce({
        id: 'redemption-1',
        attribution: {
          agentId: 'agent-1',
          lockExpiredAt: new Date(Date.now() - 1), // 已过期
        },
      })

      const result = await service.calculateCommission('redemption-1')

      expect(result.agentPayout).toBe(0)
      expect(result.commissionId).toBe('')
    })

    it('佣金计算正确（10元奖励 = 平台2元 + 分享员8元）', async () => {
      commissionRepo.findOne.mockResolvedValueOnce(null)
      redemptionRepo.findOne.mockResolvedValueOnce(mockRedemption)
      walletRepo.findOne.mockResolvedValueOnce({
        id: 'wallet-1',
        agentId: 'agent-1',
        pendingSettlementBalance: 0,
        totalEarned: 0,
        totalPlatformFee: 0,
        agentLevel: 'bronze',
      })

      const result = await service.calculateCommission('redemption-1')

      // 10 * 0.8 = 8元, 10 * 0.2 = 2元
      expect(result.agentPayout).toBe(8)
    })

    it('佣金计算正确（100元奖励 = 平台20元 + 分享员80元）', async () => {
      const highRewardRedemption = {
        ...mockRedemption,
        agentRewardAmount: 100,
      }
      commissionRepo.findOne.mockResolvedValueOnce(null)
      redemptionRepo.findOne.mockResolvedValueOnce(highRewardRedemption)
      walletRepo.findOne.mockResolvedValueOnce({
        id: 'wallet-1',
        agentId: 'agent-1',
        pendingSettlementBalance: 0,
        totalEarned: 0,
        totalPlatformFee: 0,
        agentLevel: 'bronze',
      })

      const result = await service.calculateCommission('redemption-1')

      expect(result.agentPayout).toBe(80)
    })

    it('agentReward 为 0 时返回零佣金', async () => {
      commissionRepo.findOne.mockResolvedValueOnce(null)
      redemptionRepo.findOne.mockResolvedValueOnce({
        ...mockRedemption,
        agentRewardAmount: 0,
      })
      walletRepo.findOne.mockResolvedValueOnce({
        id: 'wallet-1',
        agentId: 'agent-1',
        pendingSettlementBalance: 0,
        totalEarned: 0,
        totalPlatformFee: 0,
        agentLevel: 'bronze',
      })

      const result = await service.calculateCommission('redemption-1')

      expect(result.agentPayout).toBe(0)
    })
  })

  // ========================
  // getAgentWallet()
  // ========================

  describe('getAgentWallet()', () => {
    it('钱包不存在时自动创建', async () => {
      walletRepo.findOne.mockResolvedValueOnce(null)
      walletRepo.create.mockReturnValueOnce({
        id: 'wallet-new',
        agentId: 'agent-123',
      })
      walletRepo.save.mockResolvedValueOnce({
        id: 'wallet-new',
        agentId: 'agent-123',
        pendingSettlementBalance: 0,
        settledBalance: 0,
        frozenBalance: 0,
        totalEarned: 0,
        totalPlatformFee: 0,
        totalSettled: 0,
        totalWithdrawn: 0,
        aiTokenBalance: 0,
        lastSettlementAt: null,
      })

      const result = await service.getAgentWallet('agent-123')

      expect(result.walletId).toBe('wallet-new')
      expect(result.pendingSettlement).toBe(0)
    })

    it('返回钱包余额信息', async () => {
      walletRepo.findOne.mockResolvedValueOnce({
        id: 'wallet-1',
        agentId: 'agent-123',
        pendingSettlementBalance: 80,
        settledBalance: 200,
        frozenBalance: 0,
        totalEarned: 280,
        totalSettled: 200,
        totalWithdrawn: 50,
        lastSettlementAt: new Date(),
      })

      const result = await service.getAgentWallet('agent-123')

      expect(result.pendingSettlement).toBe(80)
      expect(result.available).toBe(200)
      expect(result.totalEarned).toBe(280)
    })
  })

  // ========================
  // listAgentCommissions()
  // ========================

  describe('listAgentCommissions()', () => {
    it('钱包不存在时返回空列表', async () => {
      walletRepo.findOne.mockResolvedValueOnce(null)

      const result = await service.listAgentCommissions('agent-123')

      expect(result.items).toHaveLength(0)
      expect(result.pagination.total).toBe(0)
    })

    it('返回佣金流水', async () => {
      walletRepo.findOne.mockResolvedValueOnce({
        id: 'wallet-1',
        agentId: 'agent-123',
      })
      commissionRepo.findAndCount.mockResolvedValueOnce([
        [
          {
            id: 'comm-1',
            redemptionId: 'redemption-1',
            customerId: 'customer-1',
            merchantReward: 10,
            platformFee: 2,
            agentFinalPayout: 8,
            levelMultiplier: 1.0,
            status: 'pending',
            settleAt: new Date(),
            settledAt: null,
            createdAt: new Date(),
          },
        ],
        1,
      ])

      const result = await service.listAgentCommissions('agent-123')

      expect(result.items).toHaveLength(1)
      expect(result.items[0].agentPayout).toBe(8)
      expect(result.items[0].platformFee).toBe(2)
    })
  })
})
