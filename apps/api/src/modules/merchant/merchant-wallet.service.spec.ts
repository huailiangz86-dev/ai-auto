// ============================================================
// AI auto - MerchantWalletService Unit Tests
// Commission budget: topup / freeze / unfreeze / transactions
// ============================================================

import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { NotFoundException, BadRequestException } from '@nestjs/common'

import { MerchantWalletService } from './merchant-wallet.service'
import { CommissionBudget } from './entities/commission-budget.entity'
import { BudgetTransaction } from './entities/commission-budget.entity'
import { PlatformRevenue } from './entities/platform-revenue.entity'
import { Merchant } from './entities/merchant.entity'
import { WalletTransactionType } from '@ai-auto/shared'

function createMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  }
}

describe('MerchantWalletService', () => {
  let service: MerchantWalletService
  let budgetRepo: any
  let txRepo: any
  let revenueRepo: any
  let merchantRepo: any
  let dataSource: any

  beforeEach(async () => {
    budgetRepo = createMockRepo()
    txRepo = createMockRepo()
    revenueRepo = createMockRepo()
    merchantRepo = createMockRepo()

    dataSource = {
      transaction: jest.fn((fn: (manager: any) => Promise<any>) =>
        fn({
          create: jest.fn((_, data) => ({ id: 'tx-new', ...data })),
          save: jest.fn((data) => Promise.resolve(data)),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        }),
      ),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantWalletService,
        { provide: getRepositoryToken(CommissionBudget), useValue: budgetRepo },
        { provide: getRepositoryToken(BudgetTransaction), useValue: txRepo },
        { provide: getRepositoryToken(PlatformRevenue), useValue: revenueRepo },
        { provide: getRepositoryToken(Merchant), useValue: merchantRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile()

    service = module.get<MerchantWalletService>(MerchantWalletService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ========================
  // getWallet()
  // ========================

  describe('getWallet()', () => {
    it('钱包不存在时自动创建', async () => {
      budgetRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
        id: 'budget-new',
        merchantId: 'merchant-123',
        totalBalance: 0,
        availableBalance: 0,
        frozenBalance: 0,
        totalSpent: 0,
        totalTopup: 0,
        lowBalanceThreshold: 100,
        status: true,
      })
      budgetRepo.create.mockReturnValueOnce({
        id: 'budget-new',
        merchantId: 'merchant-123',
      })
      budgetRepo.save.mockResolvedValueOnce({
        id: 'budget-new',
        merchantId: 'merchant-123',
        totalBalance: 0,
        availableBalance: 0,
        frozenBalance: 0,
        totalSpent: 0,
        totalTopup: 0,
        lowBalanceThreshold: 100,
        status: true,
      })

      const result = await service.getWallet('merchant-123')

      expect(result.budgetId).toBe('budget-new')
      expect(result.totalBalance).toBe(0)
    })

    it('返回钱包余额信息', async () => {
      budgetRepo.findOne.mockResolvedValueOnce({
        id: 'budget-1',
        merchantId: 'merchant-123',
        totalBalance: 1000,
        availableBalance: 800,
        frozenBalance: 200,
        totalSpent: 50,
        totalTopup: 1000,
        lowBalanceThreshold: 100,
        status: true,
      })

      const result = await service.getWallet('merchant-123')

      expect(result.totalBalance).toBe(1000)
      expect(result.availableBalance).toBe(800)
      expect(result.frozenBalance).toBe(200)
      expect(result.isLowBalance).toBe(false)
    })

    it('余额低于阈值时 isLowBalance=true', async () => {
      budgetRepo.findOne.mockResolvedValueOnce({
        id: 'budget-1',
        merchantId: 'merchant-123',
        totalBalance: 50,
        availableBalance: 50,
        frozenBalance: 0,
        totalSpent: 0,
        totalTopup: 50,
        lowBalanceThreshold: 100,
        status: true,
      })

      const result = await service.getWallet('merchant-123')

      expect(result.isLowBalance).toBe(true)
    })
  })

  // ========================
  // checkBudget()
  // ========================

  describe('checkBudget()', () => {
    it('余额足够时返回 true', async () => {
      budgetRepo.findOne.mockResolvedValueOnce({
        id: 'budget-1',
        merchantId: 'merchant-123',
        totalBalance: 1000,
        availableBalance: 800,
        frozenBalance: 200,
        totalSpent: 0,
        totalTopup: 1000,
        lowBalanceThreshold: 100,
        status: true,
      })

      const result = await service.checkBudget('merchant-123', 500)

      expect(result).toBe(true)
    })

    it('余额不足时返回 false', async () => {
      budgetRepo.findOne.mockResolvedValueOnce({
        id: 'budget-1',
        merchantId: 'merchant-123',
        totalBalance: 100,
        availableBalance: 100,
        frozenBalance: 0,
        totalSpent: 0,
        totalTopup: 100,
        lowBalanceThreshold: 100,
        status: true,
      })

      const result = await service.checkBudget('merchant-123', 500)

      expect(result).toBe(false)
    })
  })

  // ========================
  // topupBudget()
  // ========================

  describe('topupBudget()', () => {
    it('幂等：同一支付流水号不重复充值', async () => {
      txRepo.findOne.mockResolvedValueOnce({
        id: 'tx-existing',
        amount: 100,
      })

      const result = await service.topupBudget('merchant-123', {
        amount: 100,
        method: 'alipay',
        paymentTransactionId: 'tx-existing',
      })

      expect(result.transactionId).toBe('tx-existing')
    })

    it('新充值成功', async () => {
      budgetRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'budget-1',
          merchantId: 'merchant-123',
        })
        .mockResolvedValueOnce({
          id: 'budget-1',
          merchantId: 'merchant-123',
          totalBalance: 1000,
          availableBalance: 1000,
          frozenBalance: 0,
          totalSpent: 0,
          totalTopup: 1000,
          lowBalanceThreshold: 100,
          status: true,
        })
      budgetRepo.create.mockReturnValueOnce({
        id: 'budget-1',
        merchantId: 'merchant-123',
        totalBalance: 0,
        availableBalance: 0,
        frozenBalance: 0,
        totalSpent: 0,
        totalTopup: 0,
        lowBalanceThreshold: 100,
        status: true,
      })
      budgetRepo.save.mockResolvedValueOnce({
        id: 'budget-1',
        merchantId: 'merchant-123',
        totalBalance: 1000,
        availableBalance: 1000,
        frozenBalance: 0,
        totalSpent: 0,
        totalTopup: 1000,
        lowBalanceThreshold: 100,
        status: true,
      })
      txRepo.findOne.mockResolvedValueOnce(null)
      txRepo.findOne.mockResolvedValueOnce({
        id: 'tx-new',
      })

      const result = await service.topupBudget('merchant-123', {
        amount: 1000,
        method: 'alipay',
      })

      expect(result.budgetId).toBe('budget-1')
    })
  })

  // ========================
  // freezeBudget()
  // ========================

  describe('freezeBudget()', () => {
    it('钱包不存在时抛出 NotFoundException', async () => {
      budgetRepo.findOne.mockResolvedValueOnce(null)

      await expect(
        service.freezeBudget('merchant-123', {
          amount: 500,
          campaignId: 'campaign-1',
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('余额不足时抛出 BadRequestException', async () => {
      budgetRepo.findOne.mockResolvedValueOnce({
        id: 'budget-1',
        merchantId: 'merchant-123',
        availableBalance: 100,
        frozenBalance: 0,
      })

      await expect(
        service.freezeBudget('merchant-123', {
          amount: 500,
          campaignId: 'campaign-1',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('冻结成功', async () => {
      budgetRepo.findOne.mockResolvedValueOnce({
        id: 'budget-1',
        merchantId: 'merchant-123',
        availableBalance: 1000,
        frozenBalance: 0,
        totalBalance: 1000,
      })

      const result = await service.freezeBudget('merchant-123', {
        amount: 500,
        campaignId: 'campaign-1',
      })

      expect(result.transactionId).toBe('tx-new')
      expect(result.frozenBalance).toBe(500)
    })
  })

  // ========================
  // unfreezeBudget()
  // ========================

  describe('unfreezeBudget()', () => {
    it('钱包不存在时抛出 NotFoundException', async () => {
      budgetRepo.findOne.mockResolvedValueOnce(null)

      await expect(
        service.unfreezeBudget('merchant-123', 'campaign-1', 100, false),
      ).rejects.toThrow(NotFoundException)
    })

    it('解冻成功（加回可用余额）', async () => {
      budgetRepo.findOne.mockResolvedValueOnce({
        id: 'budget-1',
        merchantId: 'merchant-123',
        availableBalance: 500,
        frozenBalance: 500,
        totalBalance: 1000,
        totalSpent: 0,
      })

      const result = await service.unfreezeBudget('merchant-123', 'campaign-1', 100, false)

      expect(result.transactionId).toBe('tx-new')
    })

    it('扣减成功（实际佣金）', async () => {
      budgetRepo.findOne.mockResolvedValueOnce({
        id: 'budget-1',
        merchantId: 'merchant-123',
        availableBalance: 0,
        frozenBalance: 500,
        totalBalance: 1000,
        totalSpent: 0,
      })

      const result = await service.unfreezeBudget('merchant-123', 'campaign-1', 50, true)

      expect(result.transactionId).toBe('tx-new')
    })
  })

  // ========================
  // listTransactions()
  // ========================

  describe('listTransactions()', () => {
    it('钱包不存在时返回空列表', async () => {
      budgetRepo.findOne.mockResolvedValueOnce(null)

      const result = await service.listTransactions('merchant-123', {})

      expect(result.items).toHaveLength(0)
    })

    it('返回交易分页列表', async () => {
      budgetRepo.findOne.mockResolvedValueOnce({
        id: 'budget-1',
        merchantId: 'merchant-123',
      })
      txRepo.findAndCount.mockResolvedValueOnce([
        [
          {
            id: 'tx-1',
            type: WalletTransactionType.RECHARGE,
            amount: 1000,
            balanceBefore: 0,
            balanceAfter: 1000,
            campaignId: null,
            description: '充值',
            createdAt: new Date(),
          },
        ],
        1,
      ])

      const result = await service.listTransactions('merchant-123', {})

      expect(result.items).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
      expect(result.items[0].type).toBe(WalletTransactionType.RECHARGE)
    })

    it('按类型筛选', async () => {
      budgetRepo.findOne.mockResolvedValueOnce({
        id: 'budget-1',
        merchantId: 'merchant-123',
      })
      txRepo.findAndCount.mockResolvedValueOnce([[], 0])

      await service.listTransactions('merchant-123', { type: 'FREEZE' })

      expect(txRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'FREEZE' }),
        }),
      )
    })
  })

  // ========================
  // getRevenueStats()
  // ========================

  describe('getRevenueStats()', () => {
    it('返回收入统计', async () => {
      revenueRepo.find.mockResolvedValueOnce([
        {
          revenueType: 'commission_royalty',
          amount: 100,
        },
        {
          revenueType: 'subscription',
          amount: 200,
        },
      ])

      const result = await service.getRevenueStats('merchant-123')

      expect(result.totalCommissionRoyalty).toBe(100)
      expect(result.totalSubscription).toBe(200)
      expect(result.totalRevenue).toBe(300)
      expect(result.transactionCount).toBe(2)
    })

    it('空数据时返回零值', async () => {
      revenueRepo.find.mockResolvedValueOnce([])

      const result = await service.getRevenueStats('merchant-123')

      expect(result.totalRevenue).toBe(0)
      expect(result.transactionCount).toBe(0)
    })
  })
})
