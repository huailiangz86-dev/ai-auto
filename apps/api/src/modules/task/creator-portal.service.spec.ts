import { BadRequestException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { AuditActionType, AuditStatus, UserRole } from '@ai-auto/shared'
import { DataSource } from 'typeorm'

import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { AuditLog } from '../admin/entities/audit-log.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { Notification } from '../notification/entities/notification.entity'
import { CampaignBudgetAllocation } from './entities/campaign-budget-allocation.entity'
import { CreatorTaskAppeal, CreatorTaskPayout } from './entities/creator-task-payout.entity'
import { CreatorTask, GrowthTask } from './entities/growth-task.entity'
import { CreatorPortalService } from './creator-portal.service'

const createRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
  create: jest.fn((value) => value),
  save: jest.fn((value) => Promise.resolve(value)),
  createQueryBuilder: jest.fn(),
})

const createAppealBuilder = (items: unknown[] = [], total = 0, count = 0) => ({
  leftJoin: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([items, total]),
  getCount: jest.fn().mockResolvedValue(count),
})

describe('CreatorPortalService operations appeals', () => {
  let service: CreatorPortalService
  let creators: ReturnType<typeof createRepo>
  let tasks: ReturnType<typeof createRepo>
  let payouts: ReturnType<typeof createRepo>
  let appeals: ReturnType<typeof createRepo>
  let wallets: ReturnType<typeof createRepo>
  let ledgerEntries: { find: jest.Mock; save: jest.Mock }
  let dataSource: any
  let manager: any

  const appeal = {
    id: 'appeal-1',
    creatorTaskId: 'task-1',
    creatorId: 'creator-1',
    payoutId: 'payout-1',
    target: 'payout',
    reason: '报酬核验少算了线下核销',
    evidence: { redemptionIds: ['r-1'] },
    status: 'open',
    resolution: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: new Date('2026-09-01T08:00:00Z'),
    updatedAt: new Date('2026-09-01T08:00:00Z'),
  }
  const task = {
    id: 'task-1',
    growthTaskId: 'growth-1',
    campaignId: 'campaign-1',
    merchantId: 'merchant-1',
    creatorId: 'creator-1',
    channel: 'douyin',
    contentType: 'short_video',
    brief: '发布本地门店探店短视频',
    deadline: new Date('2026-09-05T08:00:00Z'),
    status: 'completed',
    baseReward: '120.00',
    reviewReason: null,
    riskHoldReason: null,
  }
  const payout = {
    id: 'payout-1',
    creatorTaskId: 'task-1',
    status: 'verified',
    expectedAmount: '120.00',
    verifiedAmount: '100.00',
    verificationEvidence: { redemptions: 10 },
    verifiedAt: new Date('2026-09-02T08:00:00Z'),
    settleAt: new Date('2026-09-07T00:00:00Z'),
    settledAt: null,
  }
  const creator = {
    id: 'creator-1',
    nickname: '小美妈妈',
    phone: '13812345678',
    realNameVerified: true,
    auditStatus: AuditStatus.APPROVED,
    creatorGrowthScore: 82,
    creatorGrowthLevel: 4,
  }

  beforeEach(async () => {
    creators = createRepo()
    tasks = createRepo()
    const growthTasks = createRepo()
    const allocations = createRepo()
    payouts = createRepo()
    appeals = createRepo()
    wallets = createRepo()
    manager = {
      findOne: jest.fn(),
      save: jest.fn((entityOrValue, maybeValue) => Promise.resolve(maybeValue ?? entityOrValue)),
      create: jest.fn((_: unknown, value: unknown) => value),
    }
    ledgerEntries = { find: jest.fn().mockResolvedValue([]), save: jest.fn() }
    dataSource = {
      transaction: jest.fn((fn: (transactionManager: any) => Promise<unknown>) => fn(manager)),
      getRepository: jest.fn(() => ledgerEntries),
    }

    const module = await Test.createTestingModule({
      providers: [
        CreatorPortalService,
        { provide: getRepositoryToken(SharingAgent), useValue: creators },
        { provide: getRepositoryToken(CreatorTask), useValue: tasks },
        { provide: getRepositoryToken(GrowthTask), useValue: growthTasks },
        { provide: getRepositoryToken(CampaignBudgetAllocation), useValue: allocations },
        { provide: getRepositoryToken(CreatorTaskPayout), useValue: payouts },
        { provide: getRepositoryToken(CreatorTaskAppeal), useValue: appeals },
        { provide: getRepositoryToken(AgentWallet), useValue: wallets },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile()
    service = module.get(CreatorPortalService)
  })

  afterEach(() => jest.clearAllMocks())

  it('lists open appeals with task, payout and masked creator context', async () => {
    const listBuilder = createAppealBuilder([appeal], 1)
    const openBuilder = createAppealBuilder([], 0, 1)
    const acceptedBuilder = createAppealBuilder([], 0, 0)
    const rejectedBuilder = createAppealBuilder([], 0, 0)
    const withdrawnBuilder = createAppealBuilder([], 0, 0)
    appeals.createQueryBuilder
      .mockReturnValueOnce(listBuilder)
      .mockReturnValueOnce(openBuilder)
      .mockReturnValueOnce(acceptedBuilder)
      .mockReturnValueOnce(rejectedBuilder)
      .mockReturnValueOnce(withdrawnBuilder)
    tasks.find.mockResolvedValueOnce([task])
    payouts.find.mockResolvedValueOnce([payout])
    creators.find.mockResolvedValueOnce([creator])

    const result = await service.listAppealsForOperations({ merchantId: 'merchant-1' })

    expect(listBuilder.andWhere).toHaveBeenCalledWith('appeal.status = :status', { status: 'open' })
    expect(listBuilder.andWhere).toHaveBeenCalledWith('task.merchantId = :merchantId', {
      merchantId: 'merchant-1',
    })
    expect(result.summary).toMatchObject({
      open: 1,
      accepted: 0,
      rejected: 0,
      withdrawn: 0,
      total: 1,
    })
    expect(result.items[0]).toMatchObject({
      appealId: 'appeal-1',
      target: 'payout',
      creator: { nickname: '小美妈妈', phone: '138****5678', growthLevel: 4 },
      task: { merchantId: 'merchant-1', baseReward: 120 },
      payout: { payoutId: 'payout-1', verifiedAmount: 100 },
    })
  })

  it('scopes direct appeal detail to the current creator or merchant', async () => {
    appeals.findOne.mockResolvedValue({ ...appeal, merchantId: 'merchant-1' })
    tasks.find.mockResolvedValue([task])
    payouts.find.mockResolvedValue([payout])
    creators.find.mockResolvedValue([creator])

    const creatorDetail = await service.appealDetailForCreator('creator-1', 'appeal-1')
    const merchantDetail = await service.appealDetailForMerchant('merchant-1', 'appeal-1')

    expect(appeals.findOne).toHaveBeenNthCalledWith(1, {
      where: { id: 'appeal-1', creatorId: 'creator-1' },
    })
    expect(appeals.findOne).toHaveBeenNthCalledWith(2, {
      where: { id: 'appeal-1', merchantId: 'merchant-1' },
    })
    expect(creatorDetail.appealId).toBe('appeal-1')
    expect(merchantDetail.appealId).toBe('appeal-1')
  })

  it('resolves an open appeal with immutable audit and creator notification', async () => {
    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === CreatorTaskAppeal) return Promise.resolve({ ...appeal })
      if (entity === CreatorTask) return Promise.resolve(task)
      if (entity === CreatorTaskPayout) return Promise.resolve(payout)
      return Promise.resolve(null)
    })
    tasks.find.mockResolvedValueOnce([task])
    payouts.find.mockResolvedValueOnce([payout])
    creators.find.mockResolvedValueOnce([creator])

    const result = await service.resolveAppeal(
      'appeal-1',
      { id: 'admin-1', name: '运营管理员' },
      { decision: 'accepted', resolution: '补充线下核销证据有效，后续由财务复核差额。' },
    )

    expect(result.status).toBe('accepted')
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'accepted', resolvedBy: 'admin-1' }),
    )
    expect(manager.save).toHaveBeenCalledWith(
      AuditLog,
      expect.objectContaining({
        actionType: AuditActionType.CREATOR_TASK_APPEAL_RESOLVED,
        actorType: 'admin',
        actorName: '运营管理员',
        metadata: expect.objectContaining({
          decision: 'accepted',
          creatorTaskId: 'task-1',
          payoutId: 'payout-1',
        }),
      }),
    )
    expect(manager.save).toHaveBeenCalledWith(
      Notification,
      expect.objectContaining({
        recipientId: 'creator-1',
        recipientRole: UserRole.AGENT,
        type: 'creator_task_appeal_resolved',
      }),
    )
  })

  it('rejects duplicate resolution for a closed appeal', async () => {
    manager.findOne.mockResolvedValueOnce({ ...appeal, status: 'accepted' })

    await expect(
      service.resolveAppeal(
        'appeal-1',
        { id: 'admin-1' },
        { decision: 'rejected', resolution: '证据不足。' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(manager.save).not.toHaveBeenCalled()
  })

  it('allows a merchant to appeal a completed task during the 30 calendar-day window', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-20T08:00:00Z'))
    const completedTask = { ...task, stateChangedAt: new Date('2026-09-01T08:00:00Z') }
    tasks.findOne.mockResolvedValueOnce(completedTask)
    payouts.findOne.mockResolvedValueOnce(null)
    appeals.findOne.mockResolvedValueOnce(null)

    const result = await service.appealForMerchant('merchant-1', 'task-1', {
      target: 'task',
      reason: '交付内容未满足约定要求。',
    })

    expect(result).toMatchObject({
      creatorTaskId: 'task-1',
      merchantId: 'merchant-1',
      appellantType: 'merchant',
      target: 'task',
      appealDeadlineAt: new Date('2026-10-01T08:00:00Z'),
    })
    expect(appeals.save).toHaveBeenCalledWith(
      expect.objectContaining({ appellantType: 'merchant', merchantId: 'merchant-1' }),
    )
    jest.useRealTimers()
  })

  it('rejects an appeal after the 30 calendar-day window expires', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-02T08:00:00Z'))
    tasks.findOne.mockResolvedValueOnce({
      ...task,
      stateChangedAt: new Date('2026-09-01T08:00:00Z'),
    })
    payouts.findOne.mockResolvedValueOnce(null)

    await expect(
      service.appealForMerchant('merchant-1', 'task-1', {
        target: 'task',
        reason: '逾期申诉应被拒绝。',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(appeals.save).not.toHaveBeenCalled()
    jest.useRealTimers()
  })

  it('lists outstanding recovery receivables by adjudication with linked offset records', async () => {
    appeals.find.mockResolvedValueOnce([{
      id: 'appeal-recovery-1', creatorId: 'creator-1', creatorTaskId: 'task-1', payoutId: 'payout-1',
      merchantId: 'merchant-1', status: 'accepted', adjudicationDecision: 'reverse_settlement',
      recoveryAmount: 100, recoveryRecoveredAmount: 70, resolvedAt: new Date('2026-08-01T08:00:00Z'),
      createdAt: new Date('2026-08-01T08:00:00Z'),
    }])
    ledgerEntries.find.mockResolvedValueOnce([{
      id: 'ledger-offset-1', entryType: 'recovery_auto_offset', amount: -70,
      occurredAt: new Date('2026-08-15T08:00:00Z'),
      metadata: { appealId: 'appeal-recovery-1', settlementPayoutId: 'payout-later-1' },
    }])
    wallets.find.mockResolvedValueOnce([{
      agentId: 'creator-1', recoveryReceivableBalance: 30, settledBalance: 0, pendingSettlementBalance: 10,
    }])
    creators.find.mockResolvedValueOnce([creator])

    const result = await service.listRecoveryReceivables({ page: 1, pageSize: 20 })

    expect(result).toMatchObject({
      items: [{
        appealId: 'appeal-recovery-1', creatorId: 'creator-1', remainingAmount: 30, recoveredAmount: 70,
        offsets: [{ ledgerEntryId: 'ledger-offset-1', settlementPayoutId: 'payout-later-1' }],
        creator: { nickname: '小美妈妈', phone: '138****5678' },
      }],
      pagination: { total: 1 },
    })
    expect(appeals.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ adjudicationDecision: 'reverse_settlement' }) }),
    )
  })

  it('reconciles wallet receivables and settlement-offset ledger entries every day', async () => {
    wallets.find.mockResolvedValueOnce([
      { agentId: 'creator-1', recoveryReceivableBalance: 30 },
    ])
    appeals.find.mockResolvedValueOnce([{
      id: 'appeal-recovery-1', creatorId: 'creator-1', status: 'accepted',
      adjudicationDecision: 'reverse_settlement', recoveryAmount: 100, recoveryRecoveredAmount: 70,
    }])
    ledgerEntries.find.mockResolvedValueOnce([{
      id: 'ledger-offset-1', entryType: 'recovery_auto_offset', amount: -70,
      metadata: { appealId: 'appeal-recovery-1', settlementPayoutId: 'payout-later-1' },
    }])
    payouts.find.mockResolvedValueOnce([{ id: 'payout-later-1', recoveryOffsetAmount: 70 }])

    await expect(service.recoveryReconciliation()).resolves.toMatchObject({
      walletReceivable: 30,
      adjudicationReceivable: 30,
      receivableDifference: 0,
      receivableMatches: true,
      settlementOffsets: { checkedPayouts: 1, matches: true, mismatches: [] },
    })
  })

  it('does not verify a payout that is on risk hold', async () => {
    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === CreatorTask) return Promise.resolve(task)
      if (entity === CreatorTaskPayout) return Promise.resolve({ ...payout, status: 'risk_hold' })
      return Promise.resolve(null)
    })

    await expect(
      service.verifyPayout('task-1', 'admin-1', { verifiedAmount: 100 }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(manager.save).not.toHaveBeenCalled()
  })
})
