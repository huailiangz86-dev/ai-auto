import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'

import { FinancialLedgerService } from './financial-ledger.service'
import { FinancialLedgerEntry } from './entities/financial-ledger-entry.entity'

const createRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((value) => value),
  save: jest.fn((value) => Promise.resolve({ id: 'entry-1', ...value })),
})

describe('FinancialLedgerService', () => {
  let service: FinancialLedgerService
  let repo: ReturnType<typeof createRepo>

  beforeEach(async () => {
    repo = createRepo()
    const module = await Test.createTestingModule({
      providers: [
        FinancialLedgerService,
        { provide: getRepositoryToken(FinancialLedgerEntry), useValue: repo },
      ],
    }).compile()
    service = module.get(FinancialLedgerService)
  })

  it('records Creator Payout as COGS and is idempotent', async () => {
    repo.findOne.mockResolvedValueOnce(null)
    const created = await service.record(
      {
        classification: 'cogs',
        entryType: 'creator_payout',
        amount: 120,
        idempotencyKey: 'payout:task-1:creator-1',
      },
      { id: 'admin-1' },
    )
    expect(created).toMatchObject({ classification: 'cogs', amount: 120, recordedByAdminId: 'admin-1' })

    repo.findOne.mockResolvedValueOnce({ id: 'entry-1', classification: 'cogs', amount: 120 })
    const duplicate = await service.record(
      {
        classification: 'cogs',
        entryType: 'creator_payout',
        amount: 120,
        idempotencyKey: 'payout:task-1:creator-1',
      },
      { id: 'admin-1' },
    )
    expect(duplicate).toMatchObject({ entryId: 'entry-1', classification: 'cogs', amount: 120 })
    expect(repo.save).toHaveBeenCalledTimes(1)
  })

  it('separates revenue, Creator payout COGS and gross profit', async () => {
    repo.find.mockResolvedValueOnce([
      { id: 'r-1', classification: 'revenue', amount: '1000', occurredAt: new Date() },
      { id: 'c-1', classification: 'cogs', amount: '400', occurredAt: new Date() },
      { id: 'o-1', classification: 'operating_cost', amount: '100', occurredAt: new Date() },
      { id: 'x-1', classification: 'reserve', amount: '50', occurredAt: new Date() },
    ])
    const result = await service.getEconomics({ campaignId: '11111111-1111-4111-8111-111111111111' })
    expect(result.totals).toEqual({
      merchantGrowthRevenue: 1000,
      creatorPayoutCogs: 400,
      operatingCost: 100,
      riskReserve: 50,
      grossProfit: 450,
      grossMargin: 0.45,
    })
  })
})