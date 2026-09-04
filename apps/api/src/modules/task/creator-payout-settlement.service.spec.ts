import { DataSource } from 'typeorm'

import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { CreatorTaskPayout } from './entities/creator-task-payout.entity'
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
      save: jest.fn((value: unknown) => Promise.resolve(value)),
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
      creatorId: 'creator-1',
      status: 'verified',
      settleAt: new Date('2000-01-01T00:00:00Z'),
      verifiedAmount: 25,
    }
    const wallet = {
      agentId: 'creator-1',
      pendingSettlementBalance: 25,
      settledBalance: 10,
      totalSettled: 10,
    }
    payouts.find.mockResolvedValue([candidate])
    manager.findOne.mockImplementation((entity: unknown) =>
      Promise.resolve(entity === CreatorTaskPayout ? payout : wallet),
    )

    const result = await service.settleDuePayouts()

    expect(result).toEqual({ processed: 1, totalAmount: 25 })
    expect(payout.status).toBe('settled')
    expect(wallet).toMatchObject({
      pendingSettlementBalance: 0,
      settledBalance: 35,
      totalSettled: 35,
    })
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
})
