import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'

import { FinancialLedgerService } from './financial-ledger.service'
import { FinancialLedgerEntry } from './entities/financial-ledger-entry.entity'
import { PlatformRevenue } from '../merchant/entities/platform-revenue.entity'
import { Commission } from '../commission/entities/commission.entity'
import { CreatorTaskPayout } from '../task/entities/creator-task-payout.entity'

const createRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  create: jest.fn((value) => value),
  save: jest.fn((value) => Promise.resolve({ id: 'entry-1', ...value })),
})

describe('FinancialLedgerService', () => {
  let service: FinancialLedgerService
  let repo: ReturnType<typeof createRepo>
  let platformRevenueRepo: ReturnType<typeof createRepo>
  let commissionRepo: ReturnType<typeof createRepo>
  let creatorTaskPayoutRepo: ReturnType<typeof createRepo>

  beforeEach(async () => {
    repo = createRepo()
    platformRevenueRepo = createRepo()
    commissionRepo = createRepo()
    creatorTaskPayoutRepo = createRepo()
    const module = await Test.createTestingModule({
      providers: [
        FinancialLedgerService,
        { provide: getRepositoryToken(FinancialLedgerEntry), useValue: repo },
        { provide: getRepositoryToken(PlatformRevenue), useValue: platformRevenueRepo },
        { provide: getRepositoryToken(Commission), useValue: commissionRepo },
        { provide: getRepositoryToken(CreatorTaskPayout), useValue: creatorTaskPayoutRepo },
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
    expect(created).toMatchObject({
      classification: 'cogs',
      amount: 120,
      recordedByAdminId: 'admin-1',
    })

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
    platformRevenueRepo.find.mockResolvedValueOnce([])
    commissionRepo.find.mockResolvedValueOnce([])
    const result = await service.getEconomics({
      campaignId: '11111111-1111-4111-8111-111111111111',
    })
    expect(result.totals).toEqual({
      merchantGrowthRevenue: 1000,
      creatorPayoutCogs: 400,
      operatingCost: 100,
      riskReserve: 50,
      grossProfit: 450,
      grossMargin: 0.45,
    })
  })

  it('derives older platform income and creator payouts without duplicating ledger references', async () => {
    repo.find.mockResolvedValueOnce([
      {
        id: 'ledger-1',
        classification: 'revenue',
        amount: '100',
        sourceReference: 'revenue-1',
        occurredAt: new Date(),
      },
    ])
    platformRevenueRepo.find.mockResolvedValueOnce([
      {
        id: 'revenue-1',
        amount: '100',
        revenueType: 'subscription',
        merchantId: 'merchant-1',
        revenueDate: new Date(),
        metadata: null,
        description: null,
      },
      {
        id: 'revenue-2',
        amount: '200',
        revenueType: 'commission_royalty',
        merchantId: 'merchant-1',
        revenueDate: new Date(),
        metadata: { campaignId: 'campaign-1' },
        description: null,
      },
    ])
    commissionRepo.find.mockResolvedValueOnce([
      {
        id: 'commission-1',
        agentFinalPayout: '80',
        merchantId: 'merchant-1',
        campaignId: 'campaign-1',
        agentId: 'creator-1',
        createdAt: new Date(),
        status: 'pending',
      },
    ])

    const result = await service.getEconomics({
      merchantId: 'merchant-1',
      campaignId: 'campaign-1',
    })

    expect(result.totals).toMatchObject({
      merchantGrowthRevenue: 300,
      creatorPayoutCogs: 80,
      grossProfit: 220,
    })
    expect(result.summary.entryCount).toBe(3)
    expect(result.entries.map((entry) => entry.entryId)).toEqual(
      expect.arrayContaining(['platform-revenue:revenue-2', 'creator-payout:commission-1']),
    )
  })

  it('derives both platform fee revenue and creator payout COGS from a legacy commission', async () => {
    repo.find.mockResolvedValueOnce([])
    platformRevenueRepo.find.mockResolvedValueOnce([])
    commissionRepo.find.mockResolvedValueOnce([
      {
        id: 'commission-legacy',
        platformFee: '20',
        agentFinalPayout: '80',
        merchantId: 'merchant-1',
        campaignId: 'campaign-1',
        agentId: 'creator-1',
        createdAt: new Date(),
        status: 'pending',
      },
    ])

    const result = await service.getEconomics({
      merchantId: 'merchant-1',
      campaignId: 'campaign-1',
    })

    expect(result.totals).toMatchObject({
      merchantGrowthRevenue: 20,
      creatorPayoutCogs: 80,
      grossProfit: -60,
    })
    expect(result.entries.map((entry) => entry.entryId)).toEqual(
      expect.arrayContaining([
        'commission-revenue:commission-legacy',
        'creator-payout:commission-legacy',
      ]),
    )
  })

  it('uses a linked legacy platform revenue row once and maps its campaign through commission', async () => {
    repo.find.mockResolvedValueOnce([])
    platformRevenueRepo.find.mockResolvedValueOnce([
      {
        id: 'platform-legacy',
        commissionId: 'commission-linked',
        amount: '20',
        revenueType: 'commission_royalty',
        merchantId: 'merchant-1',
        revenueDate: new Date(),
        metadata: null,
        description: null,
      },
    ])
    commissionRepo.find.mockResolvedValueOnce([
      {
        id: 'commission-linked',
        platformFee: '20',
        agentFinalPayout: '80',
        merchantId: 'merchant-1',
        campaignId: 'campaign-1',
        agentId: 'creator-1',
        createdAt: new Date(),
        status: 'settled',
      },
    ])

    const result = await service.getEconomics({
      merchantId: 'merchant-1',
      campaignId: 'campaign-1',
    })

    expect(result.totals).toMatchObject({ merchantGrowthRevenue: 20, creatorPayoutCogs: 80 })
    expect(result.summary.entryCount).toBe(2)
    expect(result.entries.map((entry) => entry.entryId)).toEqual(
      expect.arrayContaining([
        'platform-revenue:platform-legacy',
        'creator-payout:commission-linked',
      ]),
    )
    expect(
      result.entries.find((entry) => entry.entryId === 'platform-revenue:platform-legacy'),
    ).toMatchObject({
      campaignId: 'campaign-1',
    })
  })

  it('deduplicates revenue and COGS independently when ledger references share a commission id', async () => {
    repo.find.mockResolvedValueOnce([
      {
        id: 'ledger-cogs',
        classification: 'cogs',
        entryType: 'creator_payout',
        amount: '80',
        sourceReference: 'commission-shared',
        occurredAt: new Date(),
        metadata: {},
      },
    ])
    platformRevenueRepo.find.mockResolvedValueOnce([])
    commissionRepo.find.mockResolvedValueOnce([
      {
        id: 'commission-shared',
        platformFee: '20',
        agentFinalPayout: '80',
        merchantId: 'merchant-1',
        campaignId: 'campaign-1',
        agentId: 'creator-1',
        createdAt: new Date(),
        status: 'settled',
      },
    ])

    const result = await service.getEconomics({
      merchantId: 'merchant-1',
      campaignId: 'campaign-1',
    })

    expect(result.totals).toMatchObject({ merchantGrowthRevenue: 20, creatorPayoutCogs: 80 })
    expect(result.entries.map((entry) => entry.entryId)).toEqual(
      expect.arrayContaining(['ledger-cogs', 'commission-revenue:commission-shared']),
    )
    expect(result.entries).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entryId: 'creator-payout:commission-shared' }),
      ]),
    )
  })

  it('does not duplicate a creator-task payout already linked through creatorTaskId', async () => {
    repo.find.mockResolvedValueOnce([
      {
        id: 'ledger-cogs',
        classification: 'cogs',
        entryType: 'creator_task_payout',
        amount: '80',
        currency: 'CNY',
        creatorTaskId: 'task-1',
        occurredAt: new Date(),
        metadata: {},
      },
    ])
    platformRevenueRepo.find.mockResolvedValueOnce([])
    commissionRepo.find.mockResolvedValueOnce([])
    creatorTaskPayoutRepo.find.mockResolvedValueOnce([
      {
        id: 'payout-1',
        creatorTaskId: 'task-1',
        creatorId: 'creator-1',
        merchantId: 'merchant-1',
        campaignId: null,
        expectedAmount: '80',
        verifiedAmount: '80',
        status: 'verified',
        createdAt: new Date(),
        verifiedAt: new Date(),
      },
    ])

    const result = await service.getEconomics({ merchantId: 'merchant-1' })

    expect(result.totals.creatorPayoutCogs).toBe(80)
    expect(result.entries.map((entry) => entry.entryId)).toEqual(['ledger-cogs'])
  })
})
