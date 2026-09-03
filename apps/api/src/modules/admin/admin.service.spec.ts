// ============================================================
// AI auto - AdminService Unit Tests
// ============================================================

import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { NotFoundException, BadRequestException } from '@nestjs/common'

import { AdminService } from './admin.service'
import { Merchant } from '../merchant/entities/merchant.entity'
import { Store } from '../merchant/entities/store.entity'
import { Subscription } from '../merchant/entities/subscription.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { AuditLog } from './entities/audit-log.entity'
import { FraudAlert } from './entities/fraud-alert.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { Commission } from '../commission/entities/commission.entity'
import { PlatformRevenue } from '../merchant/entities/platform-revenue.entity'
import { Content } from '../content/entities/content.entity'
import { MerchantAgentBinding } from '../merchant/entities/merchant-agent-binding.entity'
import { Notification } from '../notification/entities/notification.entity'
import { AuditStatus } from '@ai-auto/shared'

function createMockRepo() {
  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getRawOne: jest.fn().mockResolvedValue({ count: '0', amount: '0' }),
    getRawMany: jest.fn().mockResolvedValue([]),
  }
  return {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn(),
    save: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
  }
}

describe('AdminService', () => {
  let service: AdminService
  let merchantRepo: any
  let agentRepo: any
  let fraudAlertRepo: any
  let auditLogRepo: any
  let subscriptionRepo: any
  let redemptionRepo: any
  let commissionRepo: any
  let platformRevenueRepo: any
  let contentRepo: any
  let merchantAgentBindingRepo: any
  let dataSource: any
  let transactionManager: any

  beforeEach(async () => {
    merchantRepo = createMockRepo()
    const storeRepo = createMockRepo()
    subscriptionRepo = createMockRepo()
    agentRepo = createMockRepo()
    auditLogRepo = createMockRepo()
    fraudAlertRepo = createMockRepo()
    redemptionRepo = createMockRepo()
    commissionRepo = createMockRepo()
    platformRevenueRepo = createMockRepo()
    contentRepo = createMockRepo()
    merchantAgentBindingRepo = createMockRepo()
    subscriptionRepo.find.mockResolvedValue([])
    transactionManager = {
      save: jest.fn((_: any, data?: any) => Promise.resolve(data ?? _)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    }
    dataSource = {
      transaction: jest.fn((fn: (manager: any) => Promise<any>) => fn(transactionManager)),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(Merchant), useValue: merchantRepo },
        { provide: getRepositoryToken(Store), useValue: storeRepo },
        { provide: getRepositoryToken(Subscription), useValue: subscriptionRepo },
        { provide: getRepositoryToken(SharingAgent), useValue: agentRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditLogRepo },
        { provide: getRepositoryToken(FraudAlert), useValue: fraudAlertRepo },
        { provide: getRepositoryToken(Redemption), useValue: redemptionRepo },
        { provide: getRepositoryToken(Commission), useValue: commissionRepo },
        { provide: getRepositoryToken(PlatformRevenue), useValue: platformRevenueRepo },
        { provide: getRepositoryToken(Content), useValue: contentRepo },
        { provide: getRepositoryToken(MerchantAgentBinding), useValue: merchantAgentBindingRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile()

    service = module.get<AdminService>(AdminService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ========================
  // 运营大屏
  // ========================

  describe('getDashboard()', () => {
    it('返回填充空日期的趋势、实时 KPI、告警和待办', async () => {
      const result = await service.getDashboard({ date: '2026-08-20', trendDays: 3 })

      expect(result.date).toBe('2026-08-20')
      expect(result.scope.level).toBe('platform')
      expect(result.today).toMatchObject({
        newMerchants: 0,
        activeAgents: 0,
        redemptions: 0,
        gmv: 0,
      })
      expect(result.trends.gmv).toEqual([
        { date: '2026-08-18', value: 0 },
        { date: '2026-08-19', value: 0 },
        { date: '2026-08-20', value: 0 },
      ])
      expect(result.pendingActions).toHaveLength(4)
      expect(result.refresh).toEqual({ kpiSeconds: 10, detail: 'daily' })
    })
  })

  describe('listDashboardAgents()', () => {
    it('只返回商户实际绑定且启用的分享员下钻选项', async () => {
      merchantAgentBindingRepo.find.mockResolvedValueOnce([
        { agentId: 'agent-1' },
        { agentId: 'agent-1' },
        { agentId: 'agent-2' },
      ])
      agentRepo.find.mockResolvedValueOnce([
        { id: 'agent-1', nickname: '小美', phone: '13812345678' },
      ])

      await expect(service.listDashboardAgents('merchant-1')).resolves.toEqual([
        { id: 'agent-1', nickname: '小美', phone: '138****5678' },
      ])
      expect(agentRepo.find).toHaveBeenCalledTimes(1)
    })

    it('没有已绑定分享员时不查询分享员表', async () => {
      merchantAgentBindingRepo.find.mockResolvedValueOnce([])

      await expect(service.listDashboardAgents('merchant-1')).resolves.toEqual([])
      expect(agentRepo.find).not.toHaveBeenCalled()
    })
  })

  // ========================
  // 商户审核测试
  // ========================

  describe('approveMerchant()', () => {
    it('商户不存在时抛出 NotFoundException', async () => {
      merchantRepo.findOne.mockResolvedValueOnce(null)

      await expect(service.approveMerchant('non-existent-id', {})).rejects.toThrow(
        NotFoundException,
      )
    })

    it('非待审核状态时抛出 BadRequestException', async () => {
      merchantRepo.findOne.mockResolvedValueOnce({
        id: 'merchant-123',
        auditStatus: AuditStatus.APPROVED,
      })

      await expect(service.approveMerchant('merchant-123', {})).rejects.toThrow(BadRequestException)
    })

    it('待审核状态时审核通过', async () => {
      merchantRepo.findOne.mockResolvedValueOnce({
        id: 'merchant-123',
        auditStatus: AuditStatus.PENDING,
      })

      const result = await service.approveMerchant('merchant-123', {
        comment: '资质齐全',
      })

      expect(result.code).toBe(0)
      expect(result.message).toBe('审核通过')
      expect(transactionManager.save).toHaveBeenCalledWith(
        AuditLog,
        expect.objectContaining({
          actorType: 'admin',
          actionType: 'merchant_approved',
          targetId: 'merchant-123',
        }),
      )
      expect(transactionManager.save).toHaveBeenCalledWith(
        Notification,
        expect.objectContaining({
          recipientId: 'merchant-123',
          recipientRole: 'merchant_admin',
          type: 'merchant_audit',
        }),
      )
    })
  })

  describe('rejectMerchant()', () => {
    it('商户不存在时抛出 NotFoundException', async () => {
      merchantRepo.findOne.mockResolvedValueOnce(null)

      await expect(
        service.rejectMerchant('non-existent-id', { reason: '资质不全' }),
      ).rejects.toThrow(NotFoundException)
    })

    it('待审核状态时审核拒绝', async () => {
      merchantRepo.findOne.mockResolvedValueOnce({
        id: 'merchant-123',
        auditStatus: AuditStatus.PENDING,
      })

      const result = await service.rejectMerchant('merchant-123', {
        reason: '营业执照过期',
      })

      expect(result.code).toBe(0)
      expect(result.message).toBe('已拒绝')
    })
  })

  // ========================
  // 分享员审核测试
  // ========================

  describe('approveAgent()', () => {
    it('分享员不存在时抛出 NotFoundException', async () => {
      agentRepo.findOne.mockResolvedValueOnce(null)

      await expect(service.approveAgent('non-existent-id')).rejects.toThrow(NotFoundException)
    })

    it('分享员审核通过', async () => {
      agentRepo.findOne.mockResolvedValueOnce({
        id: 'agent-123',
        auditStatus: AuditStatus.PENDING,
      })

      const result = await service.approveAgent('agent-123')

      expect(result.code).toBe(0)
      expect(result.message).toBe('审核通过')
    })
  })

  describe('rejectAgent()', () => {
    it('拒绝分享员', async () => {
      agentRepo.findOne.mockResolvedValueOnce({
        id: 'agent-123',
        auditStatus: AuditStatus.PENDING,
      })

      const result = await service.rejectAgent('agent-123', '虚假信息')

      expect(result.code).toBe(0)
    })
  })

  describe('suspendAgent()', () => {
    it('封禁分享员', async () => {
      agentRepo.findOne.mockResolvedValueOnce({
        id: 'agent-123',
        auditStatus: AuditStatus.APPROVED,
        status: true,
      })

      const result = await service.suspendAgent('agent-123', {
        reason: '恶意刷单',
        frozenCommission: true,
      })

      expect(result.code).toBe(0)
      expect(result.message).toBe('已封禁')
    })
  })

  // ========================
  // 风控告警测试
  // ========================

  describe('listFraudAlerts()', () => {
    it('返回告警列表和摘要统计', async () => {
      fraudAlertRepo.findAndCount.mockResolvedValueOnce([
        [
          {
            id: 'alert-1',
            alertType: 'high_frequency_redemption',
            severity: 'warning',
            confidenceScore: 0.85,
            status: 'pending',
            evidence: [{ type: 'rate', description: '10次/分钟' }],
            createdAt: new Date(),
          },
        ],
        1,
      ])
      fraudAlertRepo.count.mockImplementation((where: any) => {
        const s = where?.where?.severity ?? where?.severity
        if (s === 'critical') return Promise.resolve(2)
        if (s === 'warning') return Promise.resolve(5)
        if (s === 'notice') return Promise.resolve(3)
        return Promise.resolve(0)
      })

      const result = await service.listFraudAlerts(undefined, 1, 20)

      expect(result.summary.critical).toBe(2)
      expect(result.summary.warning).toBe(5)
      expect(result.items).toHaveLength(1)
      expect(result.items[0].severity).toBe('warning')
    })

    it('按严重级别筛选', async () => {
      fraudAlertRepo.findAndCount.mockResolvedValueOnce([[], 0])
      fraudAlertRepo.count.mockResolvedValue(0)

      const result = await service.listFraudAlerts('critical', 1, 20)

      expect(result.items).toHaveLength(0)
    })
  })

  describe('resolveFraudAlert()', () => {
    it('冻结佣金时更新告警、写审计并通知关联分享员', async () => {
      fraudAlertRepo.findOne.mockResolvedValueOnce({
        id: 'alert-1',
        alertType: 'high_frequency_redemption',
        status: 'pending',
        agentId: 'agent-1',
        merchantId: 'merchant-1',
      })

      const result = await service.resolveFraudAlert(
        'alert-1',
        { action: 'freeze_commission', note: '核验异常核销记录' },
        { id: 'admin-1', name: '审核员' },
      )

      expect(result.status).toBe('actioned')
      expect(transactionManager.update).toHaveBeenCalledWith(
        FraudAlert,
        'alert-1',
        expect.objectContaining({ status: 'actioned', reviewedBy: 'admin-1' }),
      )
      expect(transactionManager.update).toHaveBeenCalledWith(
        Commission,
        { agentId: 'agent-1', merchantId: 'merchant-1', status: 'pending' },
        { status: 'frozen' },
      )
      expect(transactionManager.save).toHaveBeenCalledWith(
        AuditLog,
        expect.objectContaining({ actionType: 'fraud_resolved', actorId: 'admin-1' }),
      )
    })

    it('标记误报没有处理说明时拒绝提交', async () => {
      fraudAlertRepo.findOne.mockResolvedValueOnce({ id: 'alert-1', status: 'pending' })

      await expect(service.resolveFraudAlert('alert-1', { action: 'dismiss' })).rejects.toThrow(
        BadRequestException,
      )
    })
  })

  describe('moderateContent()', () => {
    it('拦截内容时写入审核结论、审计与通知', async () => {
      contentRepo.findOne.mockResolvedValueOnce({
        id: 'content-1',
        contentType: 'video',
        moderationStatus: 'pending',
        agentId: 'agent-1',
      })

      const result = await service.moderateContent(
        'content-1',
        { decision: 'blocked', message: '含有夸大宣传' },
        { id: 'admin-1', name: '审核员' },
      )

      expect(result.moderationStatus).toBe('blocked')
      expect(transactionManager.update).toHaveBeenCalledWith(
        Content,
        'content-1',
        expect.objectContaining({ moderationStatus: 'blocked', moderationMessage: '含有夸大宣传' }),
      )
      expect(transactionManager.save).toHaveBeenCalledWith(
        AuditLog,
        expect.objectContaining({ actionType: 'content_moderated', targetId: 'content-1' }),
      )
    })

    it('标记内容没有审核意见时拒绝提交', async () => {
      contentRepo.findOne.mockResolvedValueOnce({ id: 'content-1', moderationStatus: 'pending' })

      await expect(service.moderateContent('content-1', { decision: 'flagged' })).rejects.toThrow(
        BadRequestException,
      )
    })
  })
  // ========================
  // listPendingMerchants()
  // ========================

  describe('listPendingMerchants()', () => {
    it('返回待审核商户列表（分页）', async () => {
      merchantRepo.findAndCount.mockResolvedValueOnce([
        [
          {
            id: 'merchant-1',
            businessName: '老王火锅',
            contactName: '王老板',
            phone: '13812345678',
            businessType: 'enterprise',
            industryCategory: 'catering',
            createdAt: new Date(),
          },
        ],
        1,
      ])

      const result = await service.listPendingMerchants({ page: 1, pageSize: 20 })

      expect(result.items).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
      expect(result.items[0].phone).toBe('138****5678')
    })

    it('空列表时返回空数组', async () => {
      merchantRepo.findAndCount.mockResolvedValueOnce([[], 0])

      const result = await service.listPendingMerchants({})

      expect(result.items).toHaveLength(0)
    })
  })

  // ========================
  // listPendingAgents()
  // ========================

  describe('listPendingAgents()', () => {
    it('返回待审核分享员列表', async () => {
      agentRepo.findAndCount.mockResolvedValueOnce([
        [
          {
            id: 'agent-1',
            phone: '13712345678',
            nickname: '小美妈妈',
            createdAt: new Date(),
          },
        ],
        1,
      ])

      const result = await service.listPendingAgents({})

      expect(result.items).toHaveLength(1)
      expect(result.items[0].phone).toBe('137****5678')
    })
  })

  // ========================
  // approveMerchant()
  // ========================

  describe('approveMerchant()', () => {
    it('审核通过事务正确执行', async () => {
      const mockMerchant = {
        id: 'merchant-123',
        auditStatus: AuditStatus.PENDING,
        save: jest.fn(),
      }
      merchantRepo.findOne.mockResolvedValueOnce(mockMerchant as any)

      const result = await service.approveMerchant('merchant-123', {
        comment: '资质齐全',
      })

      expect(result.code).toBe(0)
    })
  })

  // ========================
  // rejectMerchant()
  // ========================

  describe('rejectMerchant()', () => {
    it('非待审核状态时抛出 BadRequestException', async () => {
      merchantRepo.findOne.mockResolvedValueOnce({
        id: 'merchant-123',
        auditStatus: AuditStatus.APPROVED,
      })

      await expect(service.rejectMerchant('merchant-123', { reason: '资质不全' })).rejects.toThrow(
        BadRequestException,
      )
    })
  })

  // ========================
  // activateMerchantSubscription()
  // ========================

  describe('activateMerchantSubscription()', () => {
    it('商户不存在时抛出 NotFoundException', async () => {
      merchantRepo.findOne.mockResolvedValueOnce(null)

      await expect(service.activateMerchantSubscription('non-existent', 12)).rejects.toThrow(
        NotFoundException,
      )
    })

    it('订阅激活成功', async () => {
      merchantRepo.findOne.mockResolvedValueOnce({
        id: 'merchant-123',
        stores: [],
        save: jest.fn(),
      } as any)

      const result = await service.activateMerchantSubscription('merchant-123', 12)

      expect(result.code).toBe(0)
    })
  })

  // ========================

  describe('Creator v2 governance', () => {
    it('stores a weighted Growth Score and immutable audit evidence', async () => {
      const agent = {
        id: 'agent-1',
        nickname: '创作者小美',
        creatorGrowthScore: 0,
        creatorGrowthLevel: 1,
        creatorScoreBreakdown: {},
      }
      agentRepo.findOne.mockResolvedValueOnce(agent)

      const result = await service.setCreatorGrowthScore(
        'agent-1',
        { influence: 50, quality: 80, relevance: 90, conversion: 70, trust: 100, evidenceNote: 'P0 人工复核' },
        { id: 'admin-1', name: '运营' },
      )

      expect(result.data).toMatchObject({ creatorId: 'agent-1', score: 79, level: 4 })
      expect(agent.creatorScoreBreakdown).toEqual({
        influence: 50,
        quality: 80,
        relevance: 90,
        conversion: 70,
        trust: 100,
      })
      expect(transactionManager.save).toHaveBeenCalledWith(
        AuditLog,
        expect.objectContaining({ actionType: 'creator_score_updated', targetType: 'creator' }),
      )
    })

    it('blacklists the Creator and persists the reason in the audit trail', async () => {
      const agent = { id: 'agent-1', nickname: '创作者小美', status: true, blacklistedAt: null, blacklistReason: null }
      agentRepo.findOne.mockResolvedValueOnce(agent)

      const result = await service.blacklistCreator('agent-1', { reason: '重复违规' }, { id: 'admin-1' })

      expect(result.code).toBe(0)
      expect(agent.status).toBe(false)
      expect(agent.blacklistReason).toBe('重复违规')
      expect(transactionManager.save).toHaveBeenCalledWith(
        AuditLog,
        expect.objectContaining({ actionType: 'creator_blacklisted', targetType: 'creator' }),
      )
    })
  })
  // approveAgent() - 补充
  // ========================

  describe('approveAgent()', () => {
    it('非待审核状态时抛出 BadRequestException', async () => {
      agentRepo.findOne.mockResolvedValueOnce({
        id: 'agent-123',
        auditStatus: AuditStatus.APPROVED,
      })

      await expect(service.approveAgent('agent-123')).rejects.toThrow(BadRequestException)
    })
  })
})
