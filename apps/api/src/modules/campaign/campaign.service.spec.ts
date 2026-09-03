// ============================================================
// AI auto - CampaignService Unit Tests
// ============================================================

import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { NotFoundException, BadRequestException } from '@nestjs/common'

import { CampaignService } from './campaign.service'
import { Campaign } from './entities/campaign.entity'
import { Coupon } from './entities/coupon.entity'
import { Merchant } from '../merchant/entities/merchant.entity'
import { CampaignType, CouponStatus } from '@ai-auto/shared'
import { PilotMeasurementService } from '../pilot/pilot-measurement.service'

function createMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  }
}

describe('CampaignService', () => {
  let service: CampaignService
  let campaignRepo: any
  let couponRepo: any
  let merchantRepo: any
  let dataSource: any
  let pilotMeasurement: any

  beforeEach(async () => {
    campaignRepo = createMockRepo()
    couponRepo = createMockRepo()
    merchantRepo = createMockRepo()
    dataSource = {
      transaction: jest.fn((fn: (manager: any) => Promise<any>) => fn({})),
    }
    pilotMeasurement = { assertActivationAllowed: jest.fn(), recordCampaignActivation: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignService,
        { provide: getRepositoryToken(Campaign), useValue: campaignRepo },
        { provide: getRepositoryToken(Coupon), useValue: couponRepo },
        { provide: getRepositoryToken(Merchant), useValue: merchantRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: PilotMeasurementService, useValue: pilotMeasurement },
      ],
    }).compile()

    service = module.get<CampaignService>(CampaignService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ========================
  // createCampaign()
  // ========================

  describe('createCampaign()', () => {
    const validDto = {
      campaignName: '七夕满减活动',
      campaignType: CampaignType.DISCOUNT,
      startAt: '2026-08-25T00:00:00Z',
      endAt: '2026-09-05T23:59:59Z',
      targetAudience: 'all',
      maxBudget: 10000,
    }

    it('商户不存在时抛出 NotFoundException', async () => {
      merchantRepo.findOne.mockResolvedValueOnce(null)

      await expect(service.createCampaign('merchant-123', validDto)).rejects.toThrow(
        NotFoundException,
      )
    })

    it('不支持的活动类型抛出 BadRequestException', async () => {
      merchantRepo.findOne.mockResolvedValueOnce({ id: 'merchant-123' })

      await expect(
        service.createCampaign('merchant-123', {
          ...validDto,
          campaignType: 'invalid_type' as any,
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('结束时间早于开始时间时抛出 BadRequestException', async () => {
      merchantRepo.findOne.mockResolvedValueOnce({ id: 'merchant-123' })

      await expect(
        service.createCampaign('merchant-123', {
          ...validDto,
          startAt: '2026-09-05T00:00:00Z',
          endAt: '2026-08-25T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('创建成功返回 campaignId', async () => {
      merchantRepo.findOne.mockResolvedValueOnce({ id: 'merchant-123' })
      campaignRepo.create.mockReturnValueOnce({
        id: 'campaign-new',
        campaignName: validDto.campaignName,
      })
      campaignRepo.save.mockResolvedValueOnce({
        id: 'campaign-new',
        campaignName: validDto.campaignName,
      })

      const result = await service.createCampaign('merchant-123', validDto)

      expect(result.campaignId).toBe('campaign-new')
      expect(campaignRepo.save).toHaveBeenCalled()
    })

    it('不传时间时默认当前时间作为开始时间', async () => {
      merchantRepo.findOne.mockResolvedValueOnce({ id: 'merchant-123' })
      campaignRepo.create.mockReturnValueOnce({ id: 'campaign-new' })
      campaignRepo.save.mockResolvedValueOnce({ id: 'campaign-new' })

      await service.createCampaign('merchant-123', {
        campaignName: '测试活动',
        campaignType: CampaignType.DISCOUNT,
      })

      expect(campaignRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignStatus: 'draft',
          startAt: expect.any(Date),
        }),
      )
    })
  })

  // ========================
  // listCampaigns()
  // ========================

  describe('listCampaigns()', () => {
    it('返回活动分页列表', async () => {
      campaignRepo.findAndCount.mockResolvedValueOnce([
        [
          {
            id: 'c1',
            campaignName: '七夕活动',
            campaignType: CampaignType.DISCOUNT,
            campaignStatus: 'active',
            startAt: new Date(),
            endAt: new Date(),
            totalClaims: 100,
            totalRedemptions: 50,
            totalCommissionSpent: 2500,
            createdAt: new Date(),
          },
        ],
        1,
      ])

      const result = await service.listCampaigns('merchant-123', {
        page: 1,
        pageSize: 20,
      })

      expect(result.items).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
      expect(result.items[0].campaignName).toBe('七夕活动')
      expect(result.items[0].stats.claimed).toBe(100)
    })

    it('按状态筛选', async () => {
      campaignRepo.findAndCount.mockResolvedValueOnce([[], 0])

      await service.listCampaigns('merchant-123', { status: 'draft' })

      expect(campaignRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ campaignStatus: 'draft' }),
        }),
      )
    })
  })

  // ========================
  // getCampaign()
  // ========================

  describe('getCampaign()', () => {
    it('活动不存在时抛出 NotFoundException', async () => {
      campaignRepo.findOne.mockResolvedValueOnce(null)

      await expect(service.getCampaign('merchant-123', 'non-existent')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('返回活动详情和优惠券', async () => {
      campaignRepo.findOne.mockResolvedValueOnce({
        id: 'campaign-1',
        campaignName: '七夕活动',
        campaignType: CampaignType.DISCOUNT,
        campaignStatus: 'active',
        description: '节日特惠',
        startAt: new Date('2026-08-25'),
        endAt: new Date('2026-09-05'),
        maxBudget: 10000,
        totalImpressions: 1000,
        totalClicks: 500,
        totalClaims: 100,
        totalRedemptions: 50,
        totalCommissionSpent: 2500,
        coupons: [
          {
            id: 'coupon-1',
            couponName: '满100减20',
            couponCode: 'QIXI20',
            discountAmount: 20,
            thresholdAmount: 100,
            agentRewardAmount: 5,
            validFrom: new Date('2026-08-25'),
            validUntil: new Date('2026-09-05'),
            totalStock: 1000,
            remainingStock: 900,
            status: CouponStatus.ACTIVE,
          },
        ],
      })

      const result = await service.getCampaign('merchant-123', 'campaign-1')

      expect(result.campaignName).toBe('七夕活动')
      expect(result.coupons).toHaveLength(1)
      expect(result.coupons[0].couponName).toBe('满100减20')
      expect(result.stats.claimed).toBe(100)
      expect(result.stats.redeemed).toBe(50)
    })
  })

  // ========================
  // publishCampaign()
  // ========================

  describe('publishCampaign()', () => {
    it('活动不存在时抛出 NotFoundException', async () => {
      campaignRepo.findOne.mockResolvedValueOnce(null)

      await expect(service.publishCampaign('merchant-123', 'non-existent')).rejects.toThrow(
        NotFoundException,
      )
    })

    it('非草稿状态无法发布', async () => {
      campaignRepo.findOne.mockResolvedValueOnce({
        id: 'campaign-1',
        campaignStatus: 'active',
      })

      await expect(service.publishCampaign('merchant-123', 'campaign-1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('无优惠券无法发布', async () => {
      campaignRepo.findOne.mockResolvedValueOnce({
        id: 'campaign-1',
        campaignStatus: 'draft',
        coupons: [],
      })

      await expect(service.publishCampaign('merchant-123', 'campaign-1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('未预登记测量协议时阻止发布', async () => {
      campaignRepo.findOne.mockResolvedValueOnce({
        id: 'campaign-1',
        campaignStatus: 'draft',
        coupons: [{ id: 'coupon-1' }],
      })
      pilotMeasurement.assertActivationAllowed.mockRejectedValueOnce(
        new BadRequestException('Campaign 激活前必须预登记'),
      )

      await expect(service.publishCampaign('merchant-123', 'campaign-1')).rejects.toThrow(
        BadRequestException,
      )
      expect(campaignRepo.save).not.toHaveBeenCalled()
    })

    it('发布成功', async () => {
      campaignRepo.findOne.mockResolvedValueOnce({
        id: 'campaign-1',
        campaignStatus: 'draft',
        coupons: [{ id: 'coupon-1' }],
        save: jest.fn(),
      })
      campaignRepo.save.mockResolvedValueOnce({ id: 'campaign-1' })

      const result = await service.publishCampaign('merchant-123', 'campaign-1')

      expect(result.code).toBe(0)
      expect(result.message).toBe('活动已发布')
    })
  })

  // ========================
  // pauseCampaign()
  // ========================

  describe('pauseCampaign()', () => {
    it('只有进行中的活动可以暂停', async () => {
      campaignRepo.findOne.mockResolvedValueOnce({
        id: 'campaign-1',
        campaignStatus: 'draft',
      })

      await expect(service.pauseCampaign('merchant-123', 'campaign-1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('暂停成功', async () => {
      campaignRepo.findOne.mockResolvedValueOnce({
        id: 'campaign-1',
        campaignStatus: 'active',
        save: jest.fn(),
      })
      campaignRepo.save.mockResolvedValueOnce({ id: 'campaign-1' })

      const result = await service.pauseCampaign('merchant-123', 'campaign-1')

      expect(result.code).toBe(0)
      expect(result.message).toBe('活动已暂停')
    })
  })

  // ========================
  // terminateCampaign()
  // ========================

  describe('terminateCampaign()', () => {
    it('已终止的活动不能再终止', async () => {
      campaignRepo.findOne.mockResolvedValueOnce({
        id: 'campaign-1',
        campaignStatus: 'cancelled',
      })

      await expect(service.terminateCampaign('merchant-123', 'campaign-1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('终止成功', async () => {
      campaignRepo.findOne.mockResolvedValueOnce({
        id: 'campaign-1',
        campaignStatus: 'active',
        save: jest.fn(),
      })
      campaignRepo.save.mockResolvedValueOnce({ id: 'campaign-1' })

      const result = await service.terminateCampaign('merchant-123', 'campaign-1')

      expect(result.code).toBe(0)
      expect(result.message).toBe('活动已终止')
    })
  })

  // ========================
  // createCoupon()
  // ========================

  describe('createCoupon()', () => {
    const validCouponDto = {
      couponName: '满100减20',
      discountAmount: 20,
      thresholdAmount: 100,
      agentRewardAmount: 5,
      validFrom: '2026-08-25T00:00:00Z',
      validUntil: '2026-09-05T23:59:59Z',
      totalStock: 1000,
      perCustomerLimit: 1,
    }

    it('活动不存在时抛出 NotFoundException', async () => {
      campaignRepo.findOne.mockResolvedValueOnce(null)

      await expect(
        service.createCoupon('merchant-123', 'campaign-1', validCouponDto),
      ).rejects.toThrow(NotFoundException)
    })

    it('非草稿活动不能添加优惠券', async () => {
      campaignRepo.findOne.mockResolvedValueOnce({
        id: 'campaign-1',
        campaignStatus: 'active',
      })

      await expect(
        service.createCoupon('merchant-123', 'campaign-1', validCouponDto),
      ).rejects.toThrow(BadRequestException)
    })

    it('券码重复时抛出 BadRequestException', async () => {
      campaignRepo.findOne.mockResolvedValueOnce({
        id: 'campaign-1',
        campaignStatus: 'draft',
      })
      couponRepo.findOne.mockResolvedValueOnce({ id: 'existing-coupon' })

      await expect(
        service.createCoupon('merchant-123', 'campaign-1', {
          ...validCouponDto,
          couponCode: 'DUPLICATE',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('创建成功并生成券码', async () => {
      campaignRepo.findOne.mockResolvedValueOnce({
        id: 'campaign-1',
        campaignType: CampaignType.DISCOUNT,
        campaignStatus: 'draft',
      })
      couponRepo.findOne.mockResolvedValueOnce(null)
      couponRepo.create.mockReturnValueOnce({
        id: 'coupon-new',
        couponCode: expect.stringMatching(/^CPN-/),
      })
      couponRepo.save.mockResolvedValueOnce({
        id: 'coupon-new',
        couponCode: 'CPN-CAMPAIGN-ABCDEF', // campaign-1.slice(0,8) = "campaign-"
      })

      const result = await service.createCoupon('merchant-123', 'campaign-1', validCouponDto)

      expect(result.couponId).toBe('coupon-new')
      expect(result.couponCode).toMatch(/^CPN-/)
    })
  })

  // ========================
  // updateCoupon()
  // ========================

  describe('updateCoupon()', () => {
    it('库存少于已发放数时抛出 BadRequestException', async () => {
      couponRepo.findOne.mockResolvedValueOnce({
        id: 'coupon-1',
        campaignId: 'campaign-1',
        totalIssued: 50,
        save: jest.fn(),
      })
      campaignRepo.findOne.mockResolvedValueOnce({
        id: 'campaign-1',
        campaignStatus: 'draft',
      })

      await expect(
        service.updateCoupon('merchant-123', 'coupon-1', {
          totalStock: 30,
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('已发布活动的优惠券不能修改', async () => {
      couponRepo.findOne.mockResolvedValueOnce({
        id: 'coupon-1',
        campaignId: 'campaign-1',
        totalIssued: 0,
      })
      campaignRepo.findOne.mockResolvedValueOnce({
        id: 'campaign-1',
        campaignStatus: 'active',
      })

      await expect(
        service.updateCoupon('merchant-123', 'coupon-1', {
          couponName: '新名称',
        }),
      ).rejects.toThrow(BadRequestException)
    })
  })

  // ========================
  // deleteCoupon()
  // ========================

  describe('deleteCoupon()', () => {
    it('非草稿活动的优惠券不能删除', async () => {
      couponRepo.findOne.mockResolvedValueOnce({
        id: 'coupon-1',
        campaignId: 'campaign-1',
      })
      campaignRepo.findOne.mockResolvedValueOnce({
        id: 'campaign-1',
        campaignStatus: 'active',
      })

      await expect(service.deleteCoupon('merchant-123', 'coupon-1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('软删除成功', async () => {
      couponRepo.findOne.mockResolvedValueOnce({
        id: 'coupon-1',
        campaignId: 'campaign-1',
      })
      campaignRepo.findOne.mockResolvedValueOnce({
        id: 'campaign-1',
        campaignStatus: 'draft',
      })

      await service.deleteCoupon('merchant-123', 'coupon-1')

      expect(couponRepo.softDelete).toHaveBeenCalledWith('coupon-1')
    })
  })
})
