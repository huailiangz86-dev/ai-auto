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
import { AuditStatus } from '@ai-auto/shared'

function createMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
  }
}

describe('AdminService', () => {
  let service: AdminService
  let merchantRepo: any
  let agentRepo: any
  let fraudAlertRepo: any
  let auditLogRepo: any
  let dataSource: any

  beforeEach(async () => {
    merchantRepo = createMockRepo()
    const storeRepo = createMockRepo()
    const subscriptionRepo = createMockRepo()
    agentRepo = createMockRepo()
    auditLogRepo = createMockRepo()
    fraudAlertRepo = createMockRepo()
    dataSource = {
      transaction: jest.fn((fn: (manager: any) => Promise<any>) => {
        const mockManager = {
          save: jest.fn((_: any, data: any) => Promise.resolve(data)),
        }
        return fn(mockManager)
      }),
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
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile()

    service = module.get<AdminService>(AdminService)
  })

  afterEach(() => {
    jest.clearAllMocks()
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
