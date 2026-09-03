// ============================================================
// AI auto - MerchantAgentBindingService Unit Tests
// Agent recruitment: invite → register → audit → active
// ============================================================

import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { NotFoundException, BadRequestException } from '@nestjs/common'

import { MerchantAgentBindingService } from './merchant-agent-binding.service'
import { MerchantAgentBinding } from './entities/merchant-agent-binding.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { AgentPlatformAccount } from '../agent/entities/agent-platform-account.entity'
import { AuditStatus } from '@ai-auto/shared'

function makeRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn((_, data) => ({ id: 'generated-id', ...data })),
    save: jest.fn((data) => Promise.resolve({ id: 'id-new', ...data })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  }
}

describe('MerchantAgentBindingService', () => {
  let service: MerchantAgentBindingService
  let bindingRepo: any
  let agentRepo: any
  let platformAccountRepo: any
  let dataSource: any

  beforeEach(async () => {
    bindingRepo = makeRepo()
    agentRepo = makeRepo()
    platformAccountRepo = makeRepo()

    dataSource = {
      transaction: jest.fn((fn: (manager: any) => Promise<any>) =>
        fn({
          create: jest.fn((_, data) => ({ id: 'agent-new', ...data })),
          save: jest.fn((data) => Promise.resolve({ id: 'agent-new', ...data })),
          update: jest.fn().mockResolvedValue({ affected: 1 }),
        }),
      ),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantAgentBindingService,
        { provide: getRepositoryToken(MerchantAgentBinding), useValue: bindingRepo },
        { provide: getRepositoryToken(SharingAgent), useValue: agentRepo },
        { provide: getRepositoryToken(AgentPlatformAccount), useValue: platformAccountRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile()

    service = module.get<MerchantAgentBindingService>(MerchantAgentBindingService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ========================
  // createInviteLink()
  // ========================

  describe('createInviteLink()', () => {
    it('生成招募链接和邀请码', async () => {
      bindingRepo.create.mockReturnValueOnce({ id: 'binding-new' })
      bindingRepo.save.mockResolvedValueOnce({
        id: 'binding-new',
        inviteCode: 'TEST1234',
      })

      const result = await service.createInviteLink('merchant-123', {})

      expect(result.inviteLink).toContain('code=')
      expect(result.inviteCode).toHaveLength(8)
      expect(result.expiresInDays).toBe(30)
      expect(bindingRepo.save).toHaveBeenCalled()
    })

    it('招募链接包含门店参数', async () => {
      bindingRepo.create.mockReturnValueOnce({ id: 'binding-new' })
      bindingRepo.save.mockResolvedValueOnce({ id: 'binding-new' })

      const result = await service.createInviteLink('merchant-123', { storeId: 'store-1' })

      expect(result.inviteLink).toContain('sid=store-1')
      expect(result.inviteLink).toContain('mid=merchant-123')
    })
  })

  // ========================
  // agentRegister()
  // ========================

  describe('agentRegister()', () => {
    it('邀请码无效时抛出 NotFoundException', async () => {
      bindingRepo.findOne.mockResolvedValueOnce(null)

      await expect(
        service.agentRegister({
          phone: '13800000001',
          inviteCode: 'INVALID',
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('邀请码已使用过', async () => {
      bindingRepo.findOne.mockResolvedValueOnce({
        id: 'binding-1',
        bindingStatus: 'active',
      })

      await expect(
        service.agentRegister({
          phone: '13800000001',
          inviteCode: 'ALREADYUSED',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('邀请码已解绑或被拒绝', async () => {
      bindingRepo.findOne.mockResolvedValueOnce({
        id: 'binding-1',
        bindingStatus: 'unbound',
      })

      await expect(
        service.agentRegister({
          phone: '13800000001',
          inviteCode: 'UNBOUND',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('已有分享员时直接关联', async () => {
      bindingRepo.findOne.mockResolvedValueOnce({
        id: 'binding-1',
        bindingStatus: 'pending',
        merchantId: 'merchant-123',
      })
      agentRepo.findOne.mockResolvedValueOnce({
        id: 'agent-existing',
        phone: '13800000001',
      })

      const result = await service.agentRegister({
        phone: '13800000001',
        inviteCode: 'PENDING01',
      })

      expect(result.agentId).toBe('agent-existing')
      expect(result.status).toBe('registered')
      expect(bindingRepo.update).toHaveBeenCalled()
    })

    it('新分享员注册成功', async () => {
      bindingRepo.findOne.mockResolvedValueOnce({
        id: 'binding-1',
        bindingStatus: 'pending',
        merchantId: 'merchant-123',
      })
      agentRepo.findOne.mockResolvedValueOnce(null)

      const result = await service.agentRegister({
        phone: '13800000001',
        inviteCode: 'NEWAGENT',
        nickname: '小明',
      })

      expect(result.status).toBe('registered')
      expect(dataSource.transaction).toHaveBeenCalled()
    })
  })

  // ========================
  // auditAgentBinding()
  // ========================

  describe('auditAgentBinding()', () => {
    it('绑定记录不存在时抛出 NotFoundException', async () => {
      bindingRepo.findOne.mockResolvedValueOnce(null)

      await expect(
        service.auditAgentBinding('merchant-123', 'binding-999', {
          result: 'approved',
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('非注册状态不允许审核', async () => {
      bindingRepo.findOne.mockResolvedValueOnce({
        id: 'binding-1',
        merchantId: 'merchant-123',
        bindingStatus: 'pending', // 还没注册
      })

      await expect(
        service.auditAgentBinding('merchant-123', 'binding-1', {
          result: 'approved',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('审核通过时状态变为 active', async () => {
      bindingRepo.findOne.mockResolvedValueOnce({
        id: 'binding-1',
        merchantId: 'merchant-123',
        bindingStatus: 'registered',
      })

      const result = await service.auditAgentBinding('merchant-123', 'binding-1', {
        result: 'approved',
        auditComment: '审核通过',
      })

      expect(result.status).toBe('active')
      expect(bindingRepo.update).toHaveBeenCalledWith(
        'binding-1',
        expect.objectContaining({
          bindingStatus: 'active',
          auditStatus: AuditStatus.APPROVED,
        }),
      )
    })

    it('审核拒绝时状态变为 rejected', async () => {
      bindingRepo.findOne.mockResolvedValueOnce({
        id: 'binding-1',
        merchantId: 'merchant-123',
        bindingStatus: 'registered',
      })

      const result = await service.auditAgentBinding('merchant-123', 'binding-1', {
        result: 'rejected',
      })

      expect(result.status).toBe('rejected')
      expect(bindingRepo.update).toHaveBeenCalledWith(
        'binding-1',
        expect.objectContaining({
          bindingStatus: 'rejected',
          auditStatus: AuditStatus.REJECTED,
        }),
      )
    })
  })

  // ========================
  // listBindingAgents()
  // ========================

  describe('listBindingAgents()', () => {
    it('返回绑定列表', async () => {
      bindingRepo.findAndCount.mockResolvedValueOnce([
        [
          {
            id: 'b-1',
            agentId: 'agent-1',
            inviteCode: 'CODE1234',
            bindingStatus: 'active',
            auditStatus: AuditStatus.APPROVED,
            storeId: 'store-1',
            boundAt: new Date(),
            createdAt: new Date(),
            agent: { phone: '13800000001', nickname: '小明' },
          },
        ],
        1,
      ])

      const result = await service.listBindingAgents('merchant-123', {})

      expect(result.items).toHaveLength(1)
      expect(result.items[0].bindingStatus).toBe('active')
      // 手机号脱敏
      expect(result.items[0].phone).toContain('****')
    })

    it('按状态筛选', async () => {
      bindingRepo.findAndCount.mockResolvedValueOnce([[], 0])

      await service.listBindingAgents('merchant-123', { status: 'active' })

      expect(bindingRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ bindingStatus: 'active' }),
        }),
      )
    })
  })

  // ========================
  // unbindAgent()
  // ========================

  describe('unbindAgent()', () => {
    it('绑定记录不存在时抛出 NotFoundException', async () => {
      bindingRepo.findOne.mockResolvedValueOnce(null)

      await expect(service.unbindAgent('merchant-123', 'binding-999', {})).rejects.toThrow(
        NotFoundException,
      )
    })

    it('已解绑时抛出 BadRequestException', async () => {
      bindingRepo.findOne.mockResolvedValueOnce({
        id: 'binding-1',
        merchantId: 'merchant-123',
        bindingStatus: 'unbound',
      })

      await expect(service.unbindAgent('merchant-123', 'binding-1', {})).rejects.toThrow(
        BadRequestException,
      )
    })

    it('解绑成功', async () => {
      bindingRepo.findOne.mockResolvedValueOnce({
        id: 'binding-1',
        merchantId: 'merchant-123',
        agentId: 'agent-1',
        bindingStatus: 'active',
      })

      const result = await service.unbindAgent('merchant-123', 'binding-1', {
        reason: '不再合作',
      })

      expect(result.status).toBe('unbound')
      expect(bindingRepo.update).toHaveBeenCalledWith(
        'binding-1',
        expect.objectContaining({
          bindingStatus: 'unbound',
        }),
      )
    })
  })
})
