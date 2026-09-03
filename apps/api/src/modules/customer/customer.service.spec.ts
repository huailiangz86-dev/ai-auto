// ============================================================
// AI auto - CustomerService Unit Tests
// Attribution (365-day lock) + Coupon claiming
// ============================================================

import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { NotFoundException, BadRequestException } from '@nestjs/common'

import { CustomerService } from './customer.service'
import { Customer } from './entities/customer.entity'
import { CustomerAttribution } from './entities/customer-attribution.entity'
import { CustomerCoupon } from './entities/customer-coupon.entity'
import { MerchantCustomerLock } from './entities/merchant-customer-lock.entity'
import { CustomerDataExportRequest } from './entities/customer-data-export-request.entity'
import { Coupon } from '../campaign/entities/coupon.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { Store } from '../merchant/entities/store.entity'
import { CouponStatus } from '@ai-auto/shared'
import { SharingTaskService } from '../task/sharing-task.service'

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

describe('CustomerService', () => {
  let service: CustomerService
  let customerRepo: any
  let attributionRepo: any
  let couponRepo: any
  let customerCouponRepo: any
  let merchantCustomerLockRepo: any
  let dataExportRequestRepo: any
  let redemptionRepo: any
  let dataSource: any
  let agentRepo: any
  let storeRepo: any

  beforeEach(async () => {
    customerRepo = createMockRepo()
    attributionRepo = createMockRepo()
    couponRepo = {
      ...createMockRepo(),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      })),
    }
    customerCouponRepo = createMockRepo()
    merchantCustomerLockRepo = createMockRepo()
    merchantCustomerLockRepo.create.mockImplementation((value: any) => value)
    merchantCustomerLockRepo.save.mockImplementation(async (value: any) => value)
    dataExportRequestRepo = createMockRepo()
    redemptionRepo = createMockRepo()
    agentRepo = {
      ...createMockRepo(),
      findOne: jest.fn().mockResolvedValue({ id: 'agent-123', nickname: '小美' }),
    }
    storeRepo = {
      ...createMockRepo(),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      })),
    }

    dataSource = {
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      })),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(CustomerAttribution), useValue: attributionRepo },
        { provide: getRepositoryToken(CustomerCoupon), useValue: customerCouponRepo },
        { provide: getRepositoryToken(MerchantCustomerLock), useValue: merchantCustomerLockRepo },
        { provide: getRepositoryToken(CustomerDataExportRequest), useValue: dataExportRequestRepo },
        { provide: getRepositoryToken(Coupon), useValue: couponRepo },
        { provide: getRepositoryToken(Redemption), useValue: redemptionRepo },
        { provide: getRepositoryToken(SharingAgent), useValue: agentRepo },
        { provide: getRepositoryToken(Store), useValue: storeRepo },
        { provide: DataSource, useValue: dataSource },
        {
          provide: SharingTaskService,
          useValue: { trackClaim: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile()

    service = module.get<CustomerService>(CustomerService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ========================
  // createAttribution()
  // ========================

  describe('createAttribution()', () => {
    it('客户不存在时抛出 NotFoundException', async () => {
      customerRepo.findOne.mockResolvedValueOnce(null)

      await expect(
        service.createAttribution({
          customerId: 'customer-123',
          sourceType: 'share_link',
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('无 agentId 时记录匿名归属（不锁定）', async () => {
      customerRepo.findOne.mockResolvedValueOnce({ id: 'customer-123' })
      attributionRepo.create.mockReturnValueOnce({
        id: 'attr-anon',
        customerId: 'customer-123',
        isActive: false,
      })
      attributionRepo.save.mockResolvedValueOnce({ id: 'attr-anon' })

      const result = await service.createAttribution({
        customerId: 'customer-123',
        sourceType: 'share_link',
        sourcePlatform: 'douyin',
      })

      expect(result.isNewLock).toBe(false)
    })

    it('分享员不存在时抛出 NotFoundException', async () => {
      customerRepo.findOne.mockResolvedValueOnce({ id: 'customer-123' })
      agentRepo.findOne.mockResolvedValueOnce(null)

      await expect(
        service.createAttribution({
          customerId: 'customer-123',
          agentId: 'agent-123',
          sourceType: 'share_link',
        }),
      ).rejects.toThrow(NotFoundException)
    })

    it('已有活跃归属时返回现有归属（首击锁定不可逆）', async () => {
      customerRepo.findOne.mockResolvedValueOnce({ id: 'customer-123' })
      attributionRepo.findOne.mockResolvedValueOnce({
        id: 'existing-attr',
        agentId: 'agent-old',
        customerId: 'customer-123',
        isActive: true,
        clickIp: null,
        save: jest.fn(),
      })

      const result = await service.createAttribution({
        customerId: 'customer-123',
        agentId: 'agent-new',
        sourceType: 'share_link',
      })

      expect(result.attributionId).toBe('existing-attr')
      expect(result.isNewLock).toBe(false)
    })

    it('同一分享员重复点击时刷新但不重置锁定期', async () => {
      customerRepo.findOne.mockResolvedValueOnce({ id: 'customer-123' })
      attributionRepo.findOne.mockResolvedValueOnce({
        id: 'existing-attr',
        agentId: 'agent-123',
        customerId: 'customer-123',
        isActive: true,
        clickIp: null,
        save: jest.fn(),
      })

      const result = await service.createAttribution({
        customerId: 'customer-123',
        agentId: 'agent-123',
        sourceType: 'share_link',
        clickIp: '1.2.3.4',
      })

      expect(result.attributionId).toBe('existing-attr')
      expect(result.isNewLock).toBe(false)
    })

    it('全新归属时锁定 365 天', async () => {
      customerRepo.findOne.mockResolvedValueOnce({
        id: 'customer-123',
        save: jest.fn(),
      })
      attributionRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
      attributionRepo.create.mockReturnValueOnce({
        id: 'new-attr',
        customerId: 'customer-123',
        agentId: 'agent-123',
        isActive: true,
      })
      attributionRepo.save.mockResolvedValueOnce({
        id: 'new-attr',
        isActive: true,
      })

      const result = await service.createAttribution({
        customerId: 'customer-123',
        agentId: 'agent-123',
        sourceType: 'share_link',
      })

      expect(result.isNewLock).toBe(true)
    })
  })

  // ========================
  // getActiveAttribution()
  // ========================

  describe('getActiveAttribution()', () => {
    it('无归属时返回 null', async () => {
      attributionRepo.findOne.mockResolvedValueOnce(null)

      const result = await service.getActiveAttribution('customer-123')

      expect(result).toBeNull()
    })

    it('返回归属信息并计算剩余天数', async () => {
      const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      attributionRepo.findOne.mockResolvedValueOnce({
        id: 'attr-1',
        agentId: 'agent-123',
        agent: { nickname: '小美' },
        campaignId: 'campaign-1',
        sourceType: 'share_link',
        sourcePlatform: 'douyin',
        lockStartedAt: new Date(),
        lockExpiredAt: futureDate,
        totalRedemptions: 5,
        totalCommission: 100,
      })

      const result = await service.getActiveAttribution('customer-123')

      expect(result?.agentId).toBe('agent-123')
      expect(result?.agentName).toBe('小美')
      expect(result?.daysRemaining).toBeGreaterThan(0)
      expect(result?.isExpired).toBe(false)
    })

    it('已过期时 isExpired=true', async () => {
      const pastDate = new Date(Date.now() - 1)
      attributionRepo.findOne.mockResolvedValueOnce({
        id: 'attr-1',
        agentId: 'agent-123',
        agent: { nickname: '小美' },
        lockExpiredAt: pastDate,
        totalRedemptions: 0,
        totalCommission: 0,
      })

      const result = await service.getActiveAttribution('customer-123')

      expect(result?.isExpired).toBe(true)
      expect(result?.daysRemaining).toBe(0)
    })
  })

  // ========================
  // registerCustomer()
  // ========================

  describe('registerCustomer()', () => {
    it('微信 OpenID 已存在时返回现有客户', async () => {
      customerRepo.findOne.mockResolvedValueOnce({
        id: 'customer-existing',
        wechatOpenid: 'oTest123',
      })

      const result = await service.registerCustomer({ wechatOpenid: 'oTest123' })

      expect(result.customerId).toBe('customer-existing')
      expect(result.isNew).toBe(false)
    })

    it('新客户注册成功', async () => {
      customerRepo.findOne.mockResolvedValueOnce(null)
      customerRepo.findOne.mockResolvedValueOnce(null)
      customerRepo.create.mockReturnValueOnce({ id: 'customer-new' })
      customerRepo.save.mockResolvedValueOnce({ id: 'customer-new' })

      const result = await service.registerCustomer({ wechatOpenid: 'oNew123' })

      expect(result.customerId).toBe('customer-new')
      expect(result.isNew).toBe(true)
    })

    it('微信和手机号都为空时抛出 BadRequestException', async () => {
      await expect(service.registerCustomer({})).rejects.toThrow(BadRequestException)
    })
  })

  // ========================
  // claimCoupon()
  // ========================

  describe('claimCoupon()', () => {
    const now = new Date()
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const validCoupon = {
      id: 'coupon-1',
      couponCode: 'CPN-123',
      couponName: '满100减20',
      campaignId: 'campaign-1',
      merchantId: 'merchant-1',
      status: CouponStatus.ACTIVE,
      validFrom: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      validUntil: futureDate,
      totalStock: 100,
      remainingStock: 50,
      perCustomerLimit: 1,
      discountAmount: 20,
      thresholdAmount: 100,
      cashRewardAmount: null,
      couponType: 'DISCOUNT',
    }

    beforeEach(() => {
      attributionRepo.findOne.mockResolvedValue(null)
    })

    it('优惠券不存在时抛出 NotFoundException', async () => {
      couponRepo.findOne.mockResolvedValueOnce(null)

      await expect(
        service.claimCoupon('customer-123', { couponId: 'non-existent' }),
      ).rejects.toThrow(NotFoundException)
    })

    it('优惠券已下架时抛出 BadRequestException', async () => {
      couponRepo.findOne.mockResolvedValueOnce({
        ...validCoupon,
        status: CouponStatus.INACTIVE,
      })

      await expect(service.claimCoupon('customer-123', { couponId: 'coupon-1' })).rejects.toThrow(
        BadRequestException,
      )
    })

    it('优惠券未生效时抛出 BadRequestException', async () => {
      couponRepo.findOne.mockResolvedValueOnce({
        ...validCoupon,
        validFrom: futureDate,
      })

      await expect(service.claimCoupon('customer-123', { couponId: 'coupon-1' })).rejects.toThrow(
        BadRequestException,
      )
    })

    it('优惠券已过期时抛出 BadRequestException', async () => {
      couponRepo.findOne.mockResolvedValueOnce({
        ...validCoupon,
        validUntil: pastDate,
      })

      await expect(service.claimCoupon('customer-123', { couponId: 'coupon-1' })).rejects.toThrow(
        BadRequestException,
      )
    })

    it('优惠券已领完时抛出 BadRequestException', async () => {
      couponRepo.findOne.mockResolvedValueOnce({
        ...validCoupon,
        totalStock: 100,
        remainingStock: 0,
      })

      await expect(service.claimCoupon('customer-123', { couponId: 'coupon-1' })).rejects.toThrow(
        BadRequestException,
      )
    })

    it('超过限领次数时抛出 BadRequestException', async () => {
      couponRepo.findOne.mockResolvedValueOnce(validCoupon)
      customerCouponRepo.count.mockResolvedValueOnce(1)

      await expect(service.claimCoupon('customer-123', { couponId: 'coupon-1' })).rejects.toThrow(
        BadRequestException,
      )
    })

    it('领券成功', async () => {
      couponRepo.findOne.mockResolvedValueOnce(validCoupon)
      customerCouponRepo.count.mockResolvedValueOnce(0)
      customerCouponRepo.create.mockReturnValueOnce({
        id: 'cc-new',
        customerId: 'customer-123',
        couponId: 'coupon-1',
      })
      customerCouponRepo.save.mockResolvedValueOnce({
        id: 'cc-new',
        customerId: 'customer-123',
        couponId: 'coupon-1',
        couponCode: expect.stringMatching(/^CC-/),
        couponName: '满100减20',
        status: CouponStatus.ACTIVE,
      })

      const result = await service.claimCoupon('customer-123', {
        couponId: 'coupon-1',
      })

      expect(result.customerCouponId).toBe('cc-new')
      expect(result.couponName).toBe('满100减20')
    })
  })

  // ========================
  // listCustomerCoupons()
  // ========================

  describe('listCustomerCoupons()', () => {
    it('返回客户优惠券分页列表', async () => {
      customerCouponRepo.findAndCount.mockResolvedValueOnce([
        [
          {
            id: 'cc-1',
            couponId: 'coupon-1',
            status: CouponStatus.ACTIVE,
            claimedAt: new Date(),
            coupon: {
              couponName: '满100减20',
              couponCode: 'CPN-123',
              discountAmount: 20,
              thresholdAmount: 100,
            },
          },
        ],
        1,
      ])

      const result = await service.listCustomerCoupons('customer-123', {
        page: 1,
        pageSize: 20,
      })

      expect(result.items).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
      expect(result.items[0].couponName).toBe('满100减20')
    })

    it('空列表时返回空数组', async () => {
      customerCouponRepo.findAndCount.mockResolvedValueOnce([[], 0])

      const result = await service.listCustomerCoupons('customer-123', {})

      expect(result.items).toHaveLength(0)
    })
  })

  // ========================
  // Personal data export (STORY-AI-040)
  // ========================

  describe('personal data export', () => {
    it('creates an auditable request and scopes the download to its owner', async () => {
      customerRepo.findOne.mockResolvedValueOnce({ id: 'customer-123' })
      dataExportRequestRepo.create.mockReturnValueOnce({
        id: 'request-123',
        customerId: 'customer-123',
        status: 'completed',
      })
      dataExportRequestRepo.save.mockResolvedValueOnce({
        id: 'request-123',
        customerId: 'customer-123',
        status: 'completed',
        completedAt: new Date(),
      })

      const result = await service.requestPersonalDataExport('customer-123')

      expect(result.requestId).toBe('request-123')
      expect(result.downloadPath).toContain('request-123')
      expect(dataExportRequestRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ customerId: 'customer-123', format: 'json' }),
      )
    })

    it('does not return another customer’s export request', async () => {
      dataExportRequestRepo.findOne.mockResolvedValueOnce(null)

      await expect(
        service.downloadPersonalDataExport('customer-123', 'another-customers-request'),
      ).rejects.toThrow(NotFoundException)
      expect(dataExportRequestRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'another-customers-request', customerId: 'customer-123' },
      })
    })
  })
})
