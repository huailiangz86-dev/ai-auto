import { BadRequestException } from '@nestjs/common'
import { DataSource } from 'typeorm'

import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { FinancialLedgerEntry } from '../admin/entities/financial-ledger-entry.entity'
import { CreatorTaskPayout } from './entities/creator-task-payout.entity'
import { CreatorTask } from './entities/growth-task.entity'
import { GrowthTaskService } from './growth-task.service'

describe('GrowthTaskService risk hold payout coordination', () => {
  let service: GrowthTaskService
  let manager: any
  let dataSource: any
  let task: any
  let payout: any
  let wallet: any

  beforeEach(() => {
    task = {
      id: 'task-1',
      status: 'completed',
      creatorId: 'creator-1',
      merchantId: 'merchant-1',
      growthTaskId: 'growth-1',
      campaignId: null,
      riskHoldPreviousStatus: null,
    }
    payout = {
      id: 'payout-1',
      creatorTaskId: 'task-1',
      creatorId: 'creator-1',
      merchantId: 'merchant-1',
      campaignId: 'campaign-1',
      status: 'verified',
      verifiedAmount: 100,
      riskHoldPreviousStatus: null,
      riskHoldReason: null,
    }
    wallet = {
      agentId: 'creator-1',
      pendingSettlementBalance: 100,
      settledBalance: 0,
      totalEarned: 100,
    }
    manager = {
      findOne: jest.fn((entity: unknown) => {
        if (entity === CreatorTask) return Promise.resolve(task)
        if (entity === CreatorTaskPayout) return Promise.resolve(payout)
        if (entity === AgentWallet) return Promise.resolve(wallet)
        return Promise.resolve(null)
      }),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((entityOrValue: unknown, maybeValue?: unknown) =>
        Promise.resolve(maybeValue ?? entityOrValue),
      ),
    }
    dataSource = {
      transaction: jest.fn((fn: (transactionManager: any) => Promise<unknown>) => fn(manager)),
    }
    service = new GrowthTaskService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource as DataSource,
      { record: jest.fn().mockResolvedValue(undefined) } as any,
      {} as any,
    )
  })

  it('puts a verified payout on hold and remembers its previous status', async () => {
    const result = await service.holdForRisk('task-1', 'admin-1', '内容需要复核')

    expect(result.status).toBe('risk_hold')
    expect(payout).toMatchObject({
      status: 'risk_hold',
      riskHoldPreviousStatus: 'verified',
      riskHoldReason: '内容需要复核',
    })
    expect(manager.findOne).toHaveBeenCalledWith(
      CreatorTaskPayout,
      expect.objectContaining({
        where: { creatorTaskId: 'task-1' },
        lock: { mode: 'pessimistic_write' },
      }),
    )
  })

  it('restores the payout status when a risk hold is resumed', async () => {
    task.status = 'risk_hold'
    task.riskHoldPreviousStatus = 'completed'
    payout.status = 'risk_hold'
    payout.riskHoldPreviousStatus = 'verified'
    payout.riskHoldReason = '内容需要复核'

    const result = await service.resolveRiskHold('task-1', 'admin-1', 'resume', '复核通过')

    expect(result.status).toBe('completed')
    expect(payout).toMatchObject({
      status: 'verified',
      riskHoldPreviousStatus: null,
      riskHoldReason: null,
    })
    expect(wallet.pendingSettlementBalance).toBe(100)
  })

  it('rejects a held payout and reverses the pending wallet amount on violation', async () => {
    task.status = 'risk_hold'
    task.riskHoldPreviousStatus = 'completed'
    payout.status = 'risk_hold'
    payout.riskHoldPreviousStatus = 'verified'

    const result = await service.resolveRiskHold('task-1', 'admin-1', 'violation', '确认刷量')

    expect(result.status).toBe('violation')
    expect(payout.status).toBe('rejected')
    expect(payout.riskHoldReason).toBe('确认刷量')
    expect(wallet.pendingSettlementBalance).toBe(0)
    expect(wallet.totalEarned).toBe(0)
    expect(wallet.settledBalance).toBe(0)
    expect(manager.save).toHaveBeenCalledWith(
      FinancialLedgerEntry,
      expect.objectContaining({
        classification: 'cogs',
        entryType: 'creator_task_payout',
        amount: 100,
        idempotencyKey: 'creator-task-payout:payout-1:verified',
        metadata: expect.objectContaining({ reconstructedAtReversal: true }),
      }),
    )
    expect(manager.save).toHaveBeenCalledWith(
      FinancialLedgerEntry,
      expect.objectContaining({
        classification: 'cogs',
        entryType: 'creator_payout_reversal',
        amount: -100,
        merchantId: 'merchant-1',
        campaignId: 'campaign-1',
        creatorId: 'creator-1',
        creatorTaskId: 'task-1',
        sourceReference: 'payout-1',
        idempotencyKey: 'creator-task-payout:payout-1:reversal',
        recordedByAdminId: 'admin-1',
        metadata: expect.objectContaining({
          reversedAmount: 100,
          reversesEntryIdempotencyKey: 'creator-task-payout:payout-1:verified',
          reason: '确认刷量',
        }),
      }),
    )
  })

  it('does not duplicate an existing verified payout ledger entry during reversal', async () => {
    task.status = 'risk_hold'
    task.riskHoldPreviousStatus = 'completed'
    payout.status = 'risk_hold'
    payout.riskHoldPreviousStatus = 'verified'
    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === CreatorTask) return Promise.resolve(task)
      if (entity === CreatorTaskPayout) return Promise.resolve(payout)
      if (entity === AgentWallet) return Promise.resolve(wallet)
      if (entity === FinancialLedgerEntry) return Promise.resolve({ id: 'ledger-verified' })
      return Promise.resolve(null)
    })

    await service.resolveRiskHold('task-1', 'admin-1', 'violation', '确认刷量')

    expect(manager.save).not.toHaveBeenCalledWith(
      FinancialLedgerEntry,
      expect.objectContaining({ entryType: 'creator_task_payout' }),
    )
    expect(manager.save).toHaveBeenCalledWith(
      FinancialLedgerEntry,
      expect.objectContaining({ entryType: 'creator_payout_reversal', amount: -100 }),
    )
  })

  it.each([
    ['pendingSettlementBalance', 99, 100],
    ['totalEarned', 100, 99],
  ])(
    'refuses reversal when wallet %s cannot cover the verified payout',
    async (_, pending, earned) => {
      task.status = 'risk_hold'
      task.riskHoldPreviousStatus = 'completed'
      payout.status = 'risk_hold'
      payout.riskHoldPreviousStatus = 'verified'
      wallet.pendingSettlementBalance = pending
      wallet.totalEarned = earned

      await expect(
        service.resolveRiskHold('task-1', 'admin-1', 'violation', '确认刷量'),
      ).rejects.toBeInstanceOf(BadRequestException)

      expect(wallet.pendingSettlementBalance).toBe(pending)
      expect(wallet.totalEarned).toBe(earned)
      expect(payout.status).toBe('risk_hold')
      expect(manager.save).not.toHaveBeenCalledWith(FinancialLedgerEntry, expect.anything())
    },
  )

  it('does not put an already settled payout on risk hold', async () => {
    payout.status = 'settled'

    await expect(service.holdForRisk('task-1', 'admin-1', '已结算任务复核')).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(task.status).toBe('completed')
    expect(manager.save).not.toHaveBeenCalled()
  })

  it('records a creator declining an invitation with a reason', async () => {
    task.status = 'invited'
    task.deadline = new Date('2026-09-10T08:00:00Z')

    const result = await service.declineCreatorTask('creator-1', 'task-1', '档期冲突')

    expect(result).toMatchObject({
      status: 'cancelled',
      stateReason: '档期冲突',
      stateChangedBy: 'creator-1',
    })
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', stateReason: '档期冲突' }),
    )
  })

  it('expires overdue invitations and records a system transition', async () => {
    task.status = 'invited'
    task.deadline = new Date('2026-09-01T08:00:00Z')
    manager.find.mockResolvedValueOnce([task])

    const result = await service.expireOverdueCreatorTasks('creator-1')

    expect(result.expiredCount).toBe(1)
    expect(task).toMatchObject({
      status: 'expired',
      stateReason: '邀约已超过截止时间',
      stateChangedBy: null,
    })
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'expired', stateReason: '邀约已超过截止时间' }),
    )
  })
})
