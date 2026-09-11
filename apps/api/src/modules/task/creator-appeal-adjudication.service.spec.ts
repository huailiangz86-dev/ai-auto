import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { BadRequestException } from '@nestjs/common'
import { DataSource } from 'typeorm'
import { AuditStatus } from '@ai-auto/shared'

import { FinancialLedgerEntry } from '../admin/entities/financial-ledger-entry.entity'
import { AuditLog } from '../admin/entities/audit-log.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { Notification } from '../notification/entities/notification.entity'
import { CampaignBudgetAllocation } from './entities/campaign-budget-allocation.entity'
import { CreatorTaskAppeal, CreatorTaskPayout } from './entities/creator-task-payout.entity'
import { CreatorTask, GrowthTask } from './entities/growth-task.entity'
import { CreatorPortalService } from './creator-portal.service'

const repo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  create: jest.fn((v) => v),
  save: jest.fn((v) => v),
})

describe('Creator appeal adjudication accounting acceptance', () => {
  let service: CreatorPortalService
  let manager: any
  let payouts: ReturnType<typeof repo>
  let appeals: ReturnType<typeof repo>
  const task = {
    id: 'task-1',
    growthTaskId: 'growth-1',
    campaignId: 'campaign-1',
    merchantId: 'merchant-1',
    creatorId: 'creator-1',
    channel: 'douyin',
    contentType: 'short_video',
    brief: '验收内容',
    deadline: new Date(),
    status: 'completed',
    baseReward: 100,
    reviewReason: null,
    riskHoldReason: null,
  }
  const creator = {
    id: 'creator-1',
    nickname: '创作者',
    phone: '13812345678',
    realNameVerified: true,
    auditStatus: AuditStatus.APPROVED,
    creatorGrowthScore: 80,
    creatorGrowthLevel: 4,
  }

  beforeEach(async () => {
    const creators = repo()
    const tasks = repo()
    const growthTasks = repo()
    const allocations = repo()
    payouts = repo()
    appeals = repo()
    const wallets = repo()
    manager = {
      findOne: jest.fn(),
      create: jest.fn((_: unknown, value: unknown) => value),
      save: jest.fn((entityOrValue: unknown, value?: any) =>
        Promise.resolve(
          entityOrValue === FinancialLedgerEntry
            ? { ...value, id: 'ledger-1' }
            : (value ?? entityOrValue),
        ),
      ),
    }
    const dataSource = {
      transaction: jest.fn((work: (tx: any) => Promise<unknown>) => work(manager)),
      getRepository: jest.fn(() => ({ save: jest.fn(), find: jest.fn().mockResolvedValue([]) })),
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
    tasks.find.mockResolvedValue([task])
    payouts.find.mockResolvedValue([])
    creators.find.mockResolvedValue([creator])
  })

  it('completes settlement → bilateral appeal → payout adjustment → wallet and ROI ledger reconciliation', async () => {
    const appeal = {
      id: 'appeal-1',
      creatorTaskId: task.id,
      creatorId: task.creatorId,
      merchantId: task.merchantId,
      appellantType: 'merchant',
      payoutId: 'payout-1',
      target: 'payout',
      status: 'open',
      reason: '核销证据有误',
      evidence: { redemptionId: 'r-1' },
    }
    const payout = {
      id: 'payout-1',
      creatorTaskId: task.id,
      creatorId: task.creatorId,
      merchantId: task.merchantId,
      campaignId: task.campaignId,
      status: 'settled',
      expectedAmount: 100,
      verifiedAmount: 100,
    }
    const wallet = {
      agentId: task.creatorId,
      pendingSettlementBalance: 0,
      settledBalance: 100,
      frozenBalance: 0,
      totalEarned: 100,
      totalSettled: 100,
      totalPlatformFee: 0,
      totalWithdrawn: 0,
      recoveryReceivableBalance: 0,
      totalRecovered: 0,
    }
    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === CreatorTaskAppeal) return appeal
      if (entity === CreatorTask) return task
      if (entity === CreatorTaskPayout) return payout
      if (entity === AgentWallet) return wallet
      return null
    })

    const result = await service.resolveAppeal(
      'appeal-1',
      { id: 'admin-1' },
      {
        decision: 'adjust_payout',
        adjustedAmount: 80,
        confirmedAmount: 80,
        resolution: '双方证据交叉核验后，确认应扣除无效核销。',
      },
    )

    expect(result).toMatchObject({
      adjudicationDecision: 'adjust_payout',
      amountBefore: 100,
      amountAfter: 80,
      financialLedgerEntryIds: ['ledger-1'],
    })
    expect(wallet).toMatchObject({ settledBalance: 80, totalEarned: 80, totalSettled: 80 })
    expect(payout).toMatchObject({ adjudicatedAmount: 80, status: 'settled' })
    expect(manager.save).toHaveBeenCalledWith(
      FinancialLedgerEntry,
      expect.objectContaining({
        classification: 'cogs',
        entryType: 'appeal_payout_adjustment',
        amount: -20,
        campaignId: 'campaign-1',
        creatorTaskId: 'task-1',
        metadata: expect.objectContaining({ amountBefore: 100, amountAfter: 80 }),
      }),
    )
    expect(manager.save).toHaveBeenCalledWith(
      AuditLog,
      expect.objectContaining({
        metadata: expect.objectContaining({
          financialLedgerEntryIds: ['ledger-1'],
          amountBefore: 100,
          amountAfter: 80,
        }),
      }),
    )
    expect(manager.save).toHaveBeenCalledWith(
      Notification,
      expect.objectContaining({ recipientId: 'merchant-1' }),
    )
    expect(manager.save).toHaveBeenCalledWith(
      Notification,
      expect.objectContaining({ recipientId: 'creator-1' }),
    )
  })

  it('records a full reversal and tracks the unrecovered balance after a withdrawal', async () => {
    const appeal = {
      id: 'appeal-2',
      creatorTaskId: task.id,
      creatorId: task.creatorId,
      merchantId: task.merchantId,
      appellantType: 'creator',
      payoutId: 'payout-1',
      target: 'payout',
      status: 'open',
      reason: '撤销结算',
      evidence: {},
    }
    const payout = {
      id: 'payout-1',
      creatorTaskId: task.id,
      creatorId: task.creatorId,
      merchantId: task.merchantId,
      campaignId: task.campaignId,
      status: 'settled',
      expectedAmount: 100,
      verifiedAmount: 100,
    }
    const wallet = {
      agentId: task.creatorId,
      pendingSettlementBalance: 0,
      settledBalance: 70,
      frozenBalance: 0,
      totalEarned: 100,
      totalSettled: 100,
      totalPlatformFee: 0,
      totalWithdrawn: 30,
      recoveryReceivableBalance: 0,
      totalRecovered: 0,
    }
    manager.findOne.mockImplementation((entity: unknown) =>
      entity === CreatorTaskAppeal
        ? appeal
        : entity === CreatorTask
          ? task
          : entity === CreatorTaskPayout
            ? payout
            : entity === AgentWallet
              ? wallet
              : null,
    )

    await service.resolveAppeal(
      'appeal-2',
      { id: 'admin-1' },
      { decision: 'reverse_settlement', confirmedAmount: 100, resolution: '确认违规，撤销结算并追回。' },
    )

    expect(payout).toMatchObject({ status: 'reversed', adjudicatedAmount: 0 })
    expect(wallet).toMatchObject({
      settledBalance: 0,
      totalEarned: 0,
      totalRecovered: 70,
      recoveryReceivableBalance: 30,
    })
    expect(manager.save).toHaveBeenCalledWith(
      FinancialLedgerEntry,
      expect.objectContaining({ entryType: 'appeal_payout_reversal', amount: -100 }),
    )
  })

  it('rejects a financial adjudication when the independently confirmed amount differs', async () => {
    const appeal = {
      id: 'appeal-confirmation-1', creatorTaskId: task.id, creatorId: task.creatorId,
      merchantId: task.merchantId, appellantType: 'merchant', payoutId: 'payout-1',
      target: 'payout', status: 'open', reason: '金额确认', evidence: {},
    }
    const payout = {
      id: 'payout-1', creatorTaskId: task.id, creatorId: task.creatorId,
      merchantId: task.merchantId, campaignId: task.campaignId, status: 'settled',
      expectedAmount: 100, verifiedAmount: 100,
    }
    manager.findOne.mockImplementation((entity: unknown) =>
      entity === CreatorTaskAppeal ? appeal : entity === CreatorTask ? task : entity === CreatorTaskPayout ? payout : null,
    )

    await expect(
      service.resolveAppeal('appeal-confirmation-1', { id: 'admin-1' }, {
        decision: 'adjust_payout', adjustedAmount: 80, confirmedAmount: 81, resolution: '确认金额不一致。',
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(manager.save).not.toHaveBeenCalled()
  })
})
