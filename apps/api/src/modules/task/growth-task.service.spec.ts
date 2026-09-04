import { BadRequestException } from '@nestjs/common'
import { DataSource } from 'typeorm'

import { AgentWallet } from '../agent/entities/agent-wallet.entity'
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
  })

  it('does not put an already settled payout on risk hold', async () => {
    payout.status = 'settled'

    await expect(service.holdForRisk('task-1', 'admin-1', '已结算任务复核')).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(task.status).toBe('completed')
    expect(manager.save).not.toHaveBeenCalled()
  })
})
