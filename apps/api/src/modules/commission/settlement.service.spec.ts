// ============================================================
// AI auto - SettlementService Unit Tests
// T+3 settlement batch + withdrawal requests
// ============================================================

import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { NotFoundException, BadRequestException } from '@nestjs/common'

import { SettlementService } from './settlement.service'
import { Withdrawal } from './entities/withdrawal.entity'
import { Commission } from './entities/commission.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { WithdrawalStatus } from '@ai-auto/shared'

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

describe('SettlementService', () => {
  let service: SettlementService
  let withdrawalRepo: any
  let commissionRepo: any
  let walletRepo: any
  let dataSource: any

  beforeEach(async () => {
    withdrawalRepo = createMockRepo()
    commissionRepo = createMockRepo()
    walletRepo = createMockRepo()

    const mockManager = {
      findOne: jest.fn(),
      create: jest.fn((_, data) => ({ id: 'withdrawal-new', ...data })),
      save: jest.fn((data) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      })),
    }

    dataSource = {
      transaction: jest.fn((fn: (manager: any) => Promise<any>) => fn(mockManager)),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        { provide: getRepositoryToken(Withdrawal), useValue: withdrawalRepo },
        { provide: getRepositoryToken(Commission), useValue: commissionRepo },
        { provide: getRepositoryToken(AgentWallet), useValue: walletRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile()

    service = module.get<SettlementService>(SettlementService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ========================
  // settleOverdueCommissions()
  // ========================

  describe('settleOverdueCommissions()', () => {
    it('无待结算佣金时返回 0', async () => {
      commissionRepo.find.mockResolvedValueOnce([])

      const result = await service.settleOverdueCommissions()

      expect(result.processed).toBe(0)
      expect(result.totalAmount).toBe(0)
    })

    it('有佣金时批量结算并更新钱包', async () => {
      commissionRepo.find.mockResolvedValueOnce([
        {
          id: 'comm-1',
          walletId: 'wallet-1',
          agentId: 'agent-1',
          agentFinalPayout: 10,
        },
      ])

      walletRepo.findOne.mockResolvedValueOnce({
        id: 'wallet-1',
        pendingSettlementBalance: 10,
        settledBalance: 0,
      })

      const result = await service.settleOverdueCommissions()

      expect(result.processed).toBe(1)
      expect(result.totalAmount).toBeGreaterThanOrEqual(0)
    })
  })

  // ========================
  // createWithdrawal()
  // ========================

  describe('createWithdrawal()', () => {
    it('钱包不存在时抛出 NotFoundException', async () => {
      walletRepo.findOne.mockResolvedValueOnce(null)

      await expect(
        service.createWithdrawal('agent-123', {
          amount: 50,
          method: 'alipay',
          accountNo: '123456',
          accountName: '张三',
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('余额不足时抛出 BadRequestException', async () => {
      walletRepo.findOne.mockResolvedValueOnce({
        id: 'wallet-1',
        agentId: 'agent-123',
        settledBalance: 5,
        frozenBalance: 0,
      })

      await expect(
        service.createWithdrawal('agent-123', {
          amount: 50,
          method: 'alipay',
          accountNo: '123456',
          accountName: '张三',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('低于最低金额时抛出 BadRequestException', async () => {
      walletRepo.findOne.mockResolvedValueOnce({
        id: 'wallet-1',
        agentId: 'agent-123',
        settledBalance: 100,
        frozenBalance: 0,
      })

      await expect(
        service.createWithdrawal('agent-123', {
          amount: 5,
          method: 'alipay',
          accountNo: '123456',
          accountName: '张三',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('幂等：已存在记录直接返回', async () => {
      withdrawalRepo.findOne.mockResolvedValueOnce({
        id: 'existing-withdrawal',
        status: WithdrawalStatus.PENDING,
      })

      const result = await service.createWithdrawal(
        'agent-123',
        { amount: 50, method: 'alipay', accountNo: '123456', accountName: '张三' },
        'idem-key-123',
      )

      expect(result.withdrawalId).toBe('existing-withdrawal')
      expect(result.status).toBe(WithdrawalStatus.PENDING)
    })

    it('申请成功返回 pending 状态', async () => {
      walletRepo.findOne
        .mockResolvedValueOnce({
          id: 'wallet-1',
          agentId: 'agent-123',
          settledBalance: 100,
          frozenBalance: 0,
        })
        .mockResolvedValueOnce({
          id: 'wallet-1',
        })

      withdrawalRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'withdrawal-new', status: 'pending' })

      const result = await service.createWithdrawal('agent-123', {
        amount: 50,
        method: 'alipay',
        accountNo: '1234567890',
        accountName: '张三',
      })

      expect(result.status).toBe(WithdrawalStatus.PENDING)
    })
  })

  // ========================
  // listWithdrawals()
  // ========================

  describe('listWithdrawals()', () => {
    it('返回提现记录分页列表', async () => {
      withdrawalRepo.findAndCount.mockResolvedValueOnce([
        [
          {
            id: 'w-1',
            amount: 50,
            actualAmount: 50,
            method: 'alipay',
            accountNo: '1234567890',
            status: WithdrawalStatus.SUCCESS,
            processStartedAt: new Date(),
            processCompletedAt: new Date(),
            processError: null,
            retryCount: 0,
            paymentTransactionId: 'TXN-001',
            createdAt: new Date(),
          },
        ],
        1,
      ])

      const result = await service.listWithdrawals('agent-123', {})

      expect(result.items).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
      expect(result.items[0].amount).toBe(50)
      expect(result.items[0].status).toBe(WithdrawalStatus.SUCCESS)
    })

    it('按状态筛选', async () => {
      withdrawalRepo.findAndCount.mockResolvedValueOnce([[], 0])

      await service.listWithdrawals('agent-123', { status: 'pending' })

      expect(withdrawalRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        }),
      )
    })

    it('账号脱敏', async () => {
      withdrawalRepo.findAndCount.mockResolvedValueOnce([
        [
          {
            id: 'w-1',
            amount: 50,
            actualAmount: 50,
            method: 'alipay',
            accountNo: '1234567890',
            status: WithdrawalStatus.SUCCESS,
            processStartedAt: null,
            processCompletedAt: null,
            processError: null,
            retryCount: 0,
            paymentTransactionId: null,
            createdAt: new Date(),
          },
        ],
        1,
      ])

      const result = await service.listWithdrawals('agent-123', {})

      expect(result.items[0].accountNo).toBe('123****7890')
    })
  })

  // ========================
  // getWithdrawal()
  // ========================

  describe('getWithdrawal()', () => {
    it('记录不存在时抛出 NotFoundException', async () => {
      withdrawalRepo.findOne.mockResolvedValueOnce(null)

      await expect(service.getWithdrawal('agent-123', 'non-existent')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('返回提现详情', async () => {
      withdrawalRepo.findOne.mockResolvedValueOnce({
        id: 'w-1',
        amount: 50,
        platformFee: 0,
        actualAmount: 50,
        method: 'bank_card',
        accountNo: '6222021234567890',
        accountName: '张三',
        status: WithdrawalStatus.PROCESSING,
        processStartedAt: new Date(),
        processCompletedAt: null,
        processError: null,
        retryCount: 1,
        paymentTransactionId: null,
        createdAt: new Date(),
      })

      const result = await service.getWithdrawal('agent-123', 'w-1')

      expect(result.amount).toBe(50)
      expect(result.status).toBe(WithdrawalStatus.PROCESSING)
      expect(result.accountNo).toBe('622****7890')
    })
  })
})
