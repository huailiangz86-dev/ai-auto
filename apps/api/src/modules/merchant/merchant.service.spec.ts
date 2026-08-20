// ============================================================
// AI auto - MerchantService Unit Tests
// ============================================================

import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common'

import { MerchantService } from './merchant.service'
import { Merchant } from './entities/merchant.entity'
import { Store } from './entities/store.entity'
import { Subscription } from './entities/subscription.entity'
import { AuditLog } from '../admin/entities/audit-log.entity'
import { SubscriptionStatus } from '@ai-auto/shared'

// Mock repository factory
function createMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
    count: jest.fn(),
  }
}

describe('MerchantService', () => {
  let service: MerchantService
  let merchantRepo: any
  let storeRepo: any
  let subscriptionRepo: any
  let auditLogRepo: any
  let dataSource: any

  beforeEach(async () => {
    merchantRepo = createMockRepo()
    storeRepo = createMockRepo()
    subscriptionRepo = createMockRepo()
    auditLogRepo = createMockRepo()
    dataSource = {
      transaction: jest.fn((fn: (manager: any) => Promise<any>) => {
        const mockManager = {
          create: jest.fn((_: any, data: any) => ({ id: 'test-id', ...data })),
          save: jest.fn((_: any, data: any) => Promise.resolve({ id: 'test-id', ...data })),
        }
        return fn(mockManager)
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantService,
        { provide: getRepositoryToken(Merchant), useValue: merchantRepo },
        { provide: getRepositoryToken(Store), useValue: storeRepo },
        { provide: getRepositoryToken(Subscription), useValue: subscriptionRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditLogRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile()

    service = module.get<MerchantService>(MerchantService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ========================
  // register()
  // ========================

  describe('register()', () => {
    const validDto = {
      businessName: '老王火锅（望京SOHO店）',
      contactName: '王老板',
      phone: '13812345678',
      verificationCode: '123456',
      email: 'wang@example.com',
      businessType: 'enterprise',
      industryCategory: 'catering',
      storeName: '望京SOHO店',
    }

    it('手机号已注册时抛出 ConflictException', async () => {
      merchantRepo.findOne.mockResolvedValueOnce({ id: 'existing-id' })

      await expect(service.register(validDto)).rejects.toThrow(ConflictException)
    })

    it('验证码为空时抛出 BadRequestException', async () => {
      merchantRepo.findOne.mockResolvedValueOnce(null)

      await expect(service.register({ ...validDto, verificationCode: '' })).rejects.toThrow(
        BadRequestException,
      )
    })

    it('验证码长度不足时抛出 BadRequestException', async () => {
      merchantRepo.findOne.mockResolvedValueOnce(null)

      await expect(service.register({ ...validDto, verificationCode: '123' })).rejects.toThrow(
        BadRequestException,
      )
    })

    it('注册成功返回 merchantId 和 pending_review 状态', async () => {
      merchantRepo.findOne.mockResolvedValueOnce(null)

      const result = await service.register(validDto)

      expect(result.merchantId).toBe('test-id')
      expect(result.status).toBe('pending_review')
    })
  })

  // ========================
  // getProfile()
  // ========================

  describe('getProfile()', () => {
    const mockMerchant = {
      id: 'merchant-123',
      businessName: '老王火锅',
      contactName: '王老板',
      phone: '13812345678',
      email: 'wang@example.com',
      businessType: 'enterprise',
      industryCategory: 'catering',
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      createdAt: new Date('2026-08-01'),
      stores: [{ id: 'store-1', storeName: '望京SOHO店' }],
      subscriptions: [
        {
          id: 'sub-1',
          planName: 'annual',
          status: SubscriptionStatus.ACTIVE,
          expireAt: new Date('2027-08-01'),
        },
      ],
    }

    it('商户不存在时抛出 NotFoundException', async () => {
      merchantRepo.findOne.mockResolvedValueOnce(null)

      await expect(service.getProfile('non-existent-id')).rejects.toThrow(NotFoundException)
    })

    it('成功返回商户信息，手机号已脱敏', async () => {
      merchantRepo.findOne.mockResolvedValueOnce(mockMerchant as any)

      const result = await service.getProfile('merchant-123')

      expect(result.merchantId).toBe('merchant-123')
      expect(result.phone).toBe('138****5678')
      expect(result.businessName).toBe('老王火锅')
      expect(result.subscription).toMatchObject({
        plan: 'annual',
        status: SubscriptionStatus.ACTIVE,
        storesUsed: 1,
        storesLimit: 3,
      })
    })

    it('无活跃订阅时返回 null subscription', async () => {
      merchantRepo.findOne.mockResolvedValueOnce({
        ...mockMerchant,
        subscriptions: [],
        stores: [],
      } as any)

      const result = await service.getProfile('merchant-123')

      expect(result.subscription).toBeNull()
    })
  })

  // ========================
  // updateProfile()
  // ========================

  describe('updateProfile()', () => {
    it('商户不存在时抛出 NotFoundException', async () => {
      merchantRepo.findOne.mockResolvedValueOnce(null)

      await expect(
        service.updateProfile('non-existent-id', { contactName: '新名字' }),
      ).rejects.toThrow(NotFoundException)
    })

    it('成功更新商户联系人和邮箱', async () => {
      const mockMerchant = {
        id: 'merchant-123',
        contactName: '王老板',
        email: null,
        addressDetail: null,
        latitude: null,
        longitude: null,
        save: jest.fn(),
      }
      merchantRepo.findOne.mockResolvedValueOnce(mockMerchant as any)
      merchantRepo.save.mockResolvedValueOnce(mockMerchant as any)

      await service.updateProfile('merchant-123', {
        contactName: '李老板',
        email: 'li@example.com',
      })

      expect(merchantRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          contactName: '李老板',
          email: 'li@example.com',
        }),
      )
    })
  })

  // ========================
  // createStore()
  // ========================

  describe('createStore()', () => {
    const dto = {
      storeName: '五道口店',
      addressDetail: '北京市海淀区五道口购物中心B1',
      latitude: 39.989,
      longitude: 116.312,
    }

    it('无活跃订阅时抛出 BadRequestException', async () => {
      subscriptionRepo.findOne.mockResolvedValueOnce(null)

      await expect(service.createStore('merchant-123', dto)).rejects.toThrow(BadRequestException)
    })

    it('门店数量已达上限时抛出 BadRequestException', async () => {
      subscriptionRepo.findOne.mockResolvedValueOnce({
        id: 'sub-1',
        merchantId: 'merchant-123',
        status: SubscriptionStatus.ACTIVE,
      })
      storeRepo.count.mockResolvedValueOnce(3) // 已有 3 个

      await expect(service.createStore('merchant-123', dto)).rejects.toThrow(BadRequestException)
    })

    it('订阅有效且门店未达上限时成功创建', async () => {
      subscriptionRepo.findOne.mockResolvedValueOnce({
        id: 'sub-1',
        status: SubscriptionStatus.ACTIVE,
      })
      storeRepo.count.mockResolvedValueOnce(1) // 只有 1 个
      storeRepo.create.mockReturnValueOnce({
        id: 'store-new',
        storeName: dto.storeName,
      })
      storeRepo.save.mockResolvedValueOnce({
        id: 'store-new',
        storeName: dto.storeName,
      })

      const result = await service.createStore('merchant-123', dto)

      expect(result.storeId).toBe('store-new')
    })
  })

  // ========================
  // deleteStore()
  // ========================

  describe('deleteStore()', () => {
    it('门店不存在时抛出 NotFoundException', async () => {
      storeRepo.findOne.mockResolvedValueOnce(null)

      await expect(service.deleteStore('merchant-123', 'non-existent-store')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('成功软删除门店', async () => {
      storeRepo.findOne.mockResolvedValueOnce({
        id: 'store-123',
        merchantId: 'merchant-123',
      })

      await service.deleteStore('merchant-123', 'store-123')

      expect(storeRepo.softDelete).toHaveBeenCalledWith('store-123')
    })
  })

  // ========================
  // getSubscription()
  // ========================

  describe('getSubscription()', () => {
    it('无订阅时返回 null plan', async () => {
      subscriptionRepo.find.mockResolvedValueOnce([])
      storeRepo.count.mockResolvedValueOnce(0)

      const result = await service.getSubscription('merchant-123')

      expect(result.plan).toBeNull()
      expect(result.status).toBeNull()
    })

    it('有活跃订阅时返回订阅信息', async () => {
      subscriptionRepo.find.mockResolvedValueOnce([
        {
          id: 'sub-1',
          planName: 'annual',
          status: SubscriptionStatus.ACTIVE,
          expireAt: new Date('2027-08-01'),
        },
      ])
      storeRepo.count.mockResolvedValueOnce(2)

      const result = await service.getSubscription('merchant-123')

      expect(result.plan).toBe('annual')
      expect(result.status).toBe(SubscriptionStatus.ACTIVE)
      expect(result.storesUsed).toBe(2)
    })
  })
})
