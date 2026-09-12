import { DataSource } from 'typeorm'

import { FinancialLedgerEntry } from '../admin/entities/financial-ledger-entry.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { CreatorTaskPayout } from './entities/creator-task-payout.entity'
import { CreatorTask } from './entities/growth-task.entity'
import { CreatorPayoutSettlementService } from './creator-payout-settlement.service'

describe('CreatorPayoutSettlementService', () => {
  let service: CreatorPayoutSettlementService
  let payouts: any
  let manager: any
  let dataSource: any

  beforeEach(() => {
    payouts = { find: jest.fn() }
    manager = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((_: unknown, value: unknown) => value),
      save: jest.fn((entityOrValue: unknown, value?: any) =>
        Promise.resolve(
          entityOrValue === FinancialLedgerEntry
            ? { ...value, id: `ledger-${Math.random()}` }
            : (value ?? entityOrValue),
        ),
      ),
    }
    dataSource = {
      transaction: jest.fn((fn: (transactionManager: any) => Promise<unknown>) => fn(manager)),
    }
    service = new CreatorPayoutSettlementService(payouts, dataSource as DataSource)
  })

  it('settles only payouts that are still verified after acquiring a row lock', async () => {
    const candidate = { id: 'payout-1' }
    const payout = {
      id: 'payout-1',
      creatorTaskId: 'task-1',
      creatorId: 'creator-1',
      status: 'verified',
      settleAt: new Date('2000-01-01T00:00:00Z'),
      verifiedAmount: 25,
    }
    const wallet = {
      agentId: 'creator-1',
      pendingSettlementBalance: 25,
      settledBalance: 10,
      totalEarned: 35,
      totalSettled: 10,
    }
    const task = { id: 'task-1', status: 'completed' }
    payouts.find.mockResolvedValue([candidate])
    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === CreatorTaskPayout) return Promise.resolve(payout)
      if (entity === AgentWallet) return Promise.resolve(wallet)
      return Promise.resolve(task)
    })

    const result = await service.settleDuePayouts()

    expect(result).toEqual({ processed: 1, totalAmount: 25 })
    expect(payout.status).toBe('settled')
    expect(wallet).toMatchObject({
      pendingSettlementBalance: 0,
      settledBalance: 35,
      totalEarned: 35,
      totalSettled: 35,
    })
    expect(task).toMatchObject({ status: 'settled', stateChangedBy: null })
    expect(manager.findOne).toHaveBeenNthCalledWith(
      1,
      CreatorTaskPayout,
      expect.objectContaining({
        where: { id: 'payout-1' },
        lock: { mode: 'pessimistic_write' },
      }),
    )
    expect(manager.findOne).toHaveBeenNthCalledWith(
      2,
      AgentWallet,
      expect.objectContaining({
        where: { agentId: 'creator-1' },
        lock: { mode: 'pessimistic_write' },
      }),
    )
    expect(manager.findOne).toHaveBeenNthCalledWith(
      3,
      CreatorTask,
      expect.objectContaining({
        where: { id: 'task-1' },
        lock: { mode: 'pessimistic_write' },
      }),
    )
  })

  it('skips a candidate that was moved to risk hold before settlement lock acquisition', async () => {
    payouts.find.mockResolvedValue([{ id: 'payout-1' }])
    manager.findOne.mockResolvedValue({
      id: 'payout-1',
      status: 'risk_hold',
      settleAt: new Date('2000-01-01T00:00:00Z'),
    })

    const result = await service.settleDuePayouts()

    expect(result).toEqual({ processed: 0, totalAmount: 0 })
    expect(manager.save).not.toHaveBeenCalled()
    expect(manager.findOne).toHaveBeenCalledTimes(1)
  })

  it('does not mark a payout settled when its creator wallet is missing', async () => {
    const payout = {
      id: 'payout-1',
      creatorTaskId: 'task-1',
      creatorId: 'creator-1',
      status: 'verified',
      settleAt: new Date('2000-01-01T00:00:00Z'),
      verifiedAmount: 25,
    }
    payouts.find.mockResolvedValue([{ id: 'payout-1' }])
    manager.findOne.mockImplementation((entity: unknown) =>
      Promise.resolve(entity === CreatorTaskPayout ? payout : null),
    )

    const result = await service.settleDuePayouts()

    expect(result).toEqual({ processed: 0, totalAmount: 0 })
    expect(payout.status).toBe('verified')
  })

  it('does not settle when pending wallet balance cannot cover the payout', async () => {
    const payout = {
      id: 'payout-1',
      creatorTaskId: 'task-1',
      creatorId: 'creator-1',
      status: 'verified',
      settleAt: '2000-01-01',
      verifiedAmount: 25,
    }
    const wallet = {
      agentId: 'creator-1',
      pendingSettlementBalance: 20,
      settledBalance: 10,
      totalSettled: 10,
    }
    payouts.find.mockResolvedValue([{ id: 'payout-1' }])
    manager.findOne.mockImplementation((entity: unknown) =>
      Promise.resolve(entity === CreatorTaskPayout ? payout : wallet),
    )

    const result = await service.settleDuePayouts()

    expect(result).toEqual({ processed: 0, totalAmount: 0 })
    expect(payout.status).toBe('verified')
    expect(wallet.settledBalance).toBe(10)
  })

  it('automatically offsets an outstanding recovery before crediting a later payout', async () => {
    const payout = {
      id: 'payout-recovery-1',
      creatorId: 'creator-1',
      status: 'verified',
      settleAt: new Date('2000-01-01T00:00:00Z'),
      verifiedAmount: 100,
      recoveryOffsetAmount: 0,
    }
    const wallet = {
      agentId: 'creator-1',
      pendingSettlementBalance: 100,
      settledBalance: 10,
      totalSettled: 10,
      recoveryReceivableBalance: 30,
      totalRecovered: 70,
    }
    payouts.find.mockResolvedValue([{ id: payout.id }])
    manager.find.mockResolvedValue([
      {
        id: 'appeal-1',
        creatorId: 'creator-1',
        merchantId: 'merchant-1',
        payoutId: 'original-payout',
        status: 'accepted',
        adjudicationDecision: 'reverse_settlement',
        resolvedAt: new Date(),
        recoveryAmount: 30,
        recoveryRecoveredAmount: 0,
        financialLedgerEntryIds: [],
      },
    ])
    manager.findOne.mockImplementation((entity: unknown) =>
      Promise.resolve(entity === CreatorTaskPayout ? payout : wallet),
    )

    const result = await service.settleDuePayouts()

    expect(result).toEqual({ processed: 1, totalAmount: 70 })
    expect(payout).toMatchObject({ status: 'settled', recoveryOffsetAmount: 30 })
    expect(wallet).toMatchObject({
      pendingSettlementBalance: 0,
      settledBalance: 80,
      totalSettled: 80,
      recoveryReceivableBalance: 0,
      totalRecovered: 100,
    })
  })

  it('reconciles partial and full recovery across later payouts without crossing creators', async () => {
    const payoutsById: Record<string, any> = {
      'payout-a1': {
        id: 'payout-a1',
        creatorId: 'creator-a',
        merchantId: 'merchant-a',
        status: 'verified',
        settleAt: '2000-01-01',
        verifiedAmount: 40,
        recoveryOffsetAmount: 0,
      },
      'payout-a2': {
        id: 'payout-a2',
        creatorId: 'creator-a',
        merchantId: 'merchant-a',
        status: 'verified',
        settleAt: '2000-01-01',
        verifiedAmount: 60,
        recoveryOffsetAmount: 0,
      },
      'payout-b1': {
        id: 'payout-b1',
        creatorId: 'creator-b',
        merchantId: 'merchant-b',
        status: 'verified',
        settleAt: '2000-01-01',
        verifiedAmount: 25,
        recoveryOffsetAmount: 0,
      },
    }
    const walletsByCreator: Record<string, any> = {
      'creator-a': {
        agentId: 'creator-a',
        pendingSettlementBalance: 100,
        settledBalance: 0,
        totalSettled: 0,
        recoveryReceivableBalance: 100,
        totalRecovered: 0,
      },
      'creator-b': {
        agentId: 'creator-b',
        pendingSettlementBalance: 25,
        settledBalance: 0,
        totalSettled: 0,
        recoveryReceivableBalance: 25,
        totalRecovered: 0,
      },
    }
    const appealsByCreator: Record<string, any[]> = {
      'creator-a': [
        {
          id: 'appeal-a',
          creatorId: 'creator-a',
          merchantId: 'merchant-a',
          payoutId: 'old-a',
          status: 'accepted',
          adjudicationDecision: 'reverse_settlement',
          resolvedAt: new Date('2020-01-01'),
          recoveryAmount: 100,
          recoveryRecoveredAmount: 0,
          financialLedgerEntryIds: [],
        },
      ],
      'creator-b': [
        {
          id: 'appeal-b',
          creatorId: 'creator-b',
          merchantId: 'merchant-b',
          payoutId: 'old-b',
          status: 'accepted',
          adjudicationDecision: 'reverse_settlement',
          resolvedAt: new Date('2020-01-01'),
          recoveryAmount: 25,
          recoveryRecoveredAmount: 0,
          financialLedgerEntryIds: [],
        },
      ],
    }
    payouts.find.mockResolvedValue(Object.keys(payoutsById).map((id) => ({ id })))
    manager.findOne.mockImplementation((entity: unknown, options: any) =>
      Promise.resolve(
        entity === CreatorTaskPayout
          ? payoutsById[options.where.id]
          : walletsByCreator[options.where.agentId],
      ),
    )
    manager.find.mockImplementation((_: unknown, options: any) =>
      Promise.resolve(appealsByCreator[options.where.creatorId]),
    )

    const result = await service.settleDuePayouts()

    expect(result).toEqual({ processed: 3, totalAmount: 0 })
    expect(payoutsById['payout-a1']).toMatchObject({ recoveryOffsetAmount: 40 })
    expect(payoutsById['payout-a2']).toMatchObject({ recoveryOffsetAmount: 60 })
    expect(payoutsById['payout-b1']).toMatchObject({ recoveryOffsetAmount: 25 })
    expect(appealsByCreator['creator-a'][0]).toMatchObject({ recoveryRecoveredAmount: 100 })
    expect(appealsByCreator['creator-b'][0]).toMatchObject({ recoveryRecoveredAmount: 25 })
    expect(walletsByCreator['creator-a']).toMatchObject({
      recoveryReceivableBalance: 0,
      totalRecovered: 100,
    })
    expect(walletsByCreator['creator-b']).toMatchObject({
      recoveryReceivableBalance: 0,
      totalRecovered: 25,
    })
    const offsetEntries = manager.save.mock.calls
      .filter(([entity]: [unknown]) => entity === FinancialLedgerEntry)
      .map(([, value]: [unknown, any]) => value)
    expect(offsetEntries).toHaveLength(3)
    expect(offsetEntries.map((entry: any) => entry.creatorId).sort()).toEqual([
      'creator-a',
      'creator-a',
      'creator-b',
    ])
    expect(offsetEntries.map((entry: any) => entry.metadata.appealId).sort()).toEqual([
      'appeal-a',
      'appeal-a',
      'appeal-b',
    ])
  })
})
