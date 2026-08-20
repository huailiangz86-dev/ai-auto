// ============================================================
// AI auto - Campaign Service
// Marketing campaign and coupon management
// ============================================================

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, In, Not } from 'typeorm'
import * as crypto from 'crypto'

import { Campaign } from './entities/campaign.entity'
import { Coupon } from './entities/coupon.entity'
import { Merchant } from '../merchant/entities/merchant.entity'
import { CouponStatus, CampaignType } from '@ai-auto/shared'

import {
  CreateCampaignDto,
  CreateCouponDto,
  UpdateCampaignDto,
  UpdateCouponDto,
  ListCampaignsDto,
  ListCouponsDto,
} from './dto/campaign.dto'

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name)

  constructor(
    @InjectRepository(Campaign)
    private readonly campaignRepo: Repository<Campaign>,
    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    private readonly dataSource: DataSource,
  ) {}

  // ========================
  // 活动 CRUD
  // ========================

  /**
   * 创建活动
   */
  async createCampaign(
    merchantId: string,
    dto: CreateCampaignDto,
  ): Promise<{ campaignId: string }> {
    // 验证商户存在
    const merchant = await this.merchantRepo.findOne({
      where: { id: merchantId },
    })
    if (!merchant) {
      throw new NotFoundException({ code: 2002, message: '商户不存在' })
    }

    // 验证活动类型
    if (!Object.values(CampaignType).includes(dto.campaignType)) {
      throw new BadRequestException({
        code: 4001,
        message: `不支持的活动类型：${dto.campaignType}`,
      })
    }

    // 验证时间
    if (dto.startAt && dto.endAt) {
      const start = new Date(dto.startAt)
      const end = new Date(dto.endAt)
      if (end <= start) {
        throw new BadRequestException({
          code: 4001,
          message: '结束时间必须晚于开始时间',
        })
      }
    }

    const campaign = this.campaignRepo.create({
      merchantId,
      storeId: dto.storeId ?? null,
      campaignName: dto.campaignName,
      campaignType: dto.campaignType,
      description: dto.description ?? null,
      targetAudience: dto.targetAudience ?? 'all',
      startAt: dto.startAt ? new Date(dto.startAt) : new Date(),
      endAt: dto.endAt ? new Date(dto.endAt) : null,
      maxBudget: dto.maxBudget ?? null,
      frozenBudget: 0,
      spentBudget: 0,
      campaignStatus: 'draft',
      totalImpressions: 0,
      totalClicks: 0,
      totalClaims: 0,
      totalRedemptions: 0,
      totalCommissionSpent: 0,
    })

    await this.campaignRepo.save(campaign)

    this.logger.log({
      event: 'campaign_created',
      campaignId: campaign.id,
      merchantId,
      campaignType: dto.campaignType,
    })

    return { campaignId: campaign.id }
  }

  /**
   * 活动列表
   */
  async listCampaigns(merchantId: string, query: ListCampaignsDto) {
    const where: any = { merchantId }

    if (query.status) {
      where.campaignStatus = query.status
    }
    if (query.campaignType) {
      where.campaignType = query.campaignType
    }

    const [campaigns, total] = await this.campaignRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
      take: query.pageSize ?? 20,
    })

    const items = campaigns.map((c) => ({
      campaignId: c.id,
      campaignName: c.campaignName,
      campaignType: c.campaignType,
      status: c.campaignStatus,
      startAt: c.startAt,
      endAt: c.endAt,
      stats: {
        claimed: Number(c.totalClaims),
        redeemed: c.totalRedemptions,
        commissionSpent: Number(c.totalCommissionSpent),
      },
      createdAt: c.createdAt,
    }))

    return {
      items,
      pagination: {
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        total,
        totalPages: Math.ceil(total / (query.pageSize ?? 20)),
      },
    }
  }

  /**
   * 活动详情
   */
  async getCampaign(merchantId: string, campaignId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, merchantId },
      relations: ['coupons'],
    })

    if (!campaign) {
      throw new NotFoundException({ code: 4001, message: '活动不存在' })
    }

    return {
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      campaignType: campaign.campaignType,
      status: campaign.campaignStatus,
      description: campaign.description,
      startAt: campaign.startAt,
      endAt: campaign.endAt,
      maxBudget: campaign.maxBudget,
      stats: {
        impressions: Number(campaign.totalImpressions),
        clicks: Number(campaign.totalClicks),
        claimed: Number(campaign.totalClaims),
        redeemed: campaign.totalRedemptions,
        commissionSpent: Number(campaign.totalCommissionSpent),
      },
      coupons: campaign.coupons.map((coupon) => ({
        couponId: coupon.id,
        couponName: coupon.couponName,
        couponCode: coupon.couponCode,
        discountAmount: coupon.discountAmount,
        thresholdAmount: coupon.thresholdAmount,
        agentRewardAmount: coupon.agentRewardAmount,
        validFrom: coupon.validFrom,
        validUntil: coupon.validUntil,
        totalStock: coupon.totalStock,
        remainingStock: coupon.remainingStock,
        status: coupon.status,
      })),
    }
  }

  /**
   * 更新活动
   */
  async updateCampaign(merchantId: string, campaignId: string, dto: UpdateCampaignDto) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, merchantId },
    })

    if (!campaign) {
      throw new NotFoundException({ code: 4001, message: '活动不存在' })
    }

    if (campaign.campaignStatus === 'ended' || campaign.campaignStatus === 'cancelled') {
      throw new BadRequestException({
        code: 4002,
        message: '已结束的活动不可修改',
      })
    }

    const allowed = ['campaignName', 'description', 'endAt', 'maxBudget', 'targetAudience']
    for (const field of allowed) {
      if (dto[field] !== undefined) {
        if (field === 'endAt') {
          ;(campaign as any)[field] = dto[field] ? new Date(dto[field]) : null
        } else {
          ;(campaign as any)[field] = dto[field]
        }
      }
    }

    await this.campaignRepo.save(campaign)

    this.logger.log({ event: 'campaign_updated', campaignId })
  }

  /**
   * 发布活动（草稿 → 进行中）
   */
  async publishCampaign(merchantId: string, campaignId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, merchantId },
      relations: ['coupons'],
    })

    if (!campaign) {
      throw new NotFoundException({ code: 4001, message: '活动不存在' })
    }

    if (campaign.campaignStatus !== 'draft') {
      throw new BadRequestException({
        code: 4002,
        message: `当前状态(${campaign.campaignStatus})无法发布`,
      })
    }

    if (!campaign.coupons || campaign.coupons.length === 0) {
      throw new BadRequestException({
        code: 4003,
        message: '活动必须至少包含一张优惠券才能发布',
      })
    }

    campaign.campaignStatus = 'active'
    campaign.startAt = new Date()
    await this.campaignRepo.save(campaign)

    this.logger.log({ event: 'campaign_published', campaignId })
    return { code: 0, message: '活动已发布' }
  }

  /**
   * 暂停活动
   */
  async pauseCampaign(merchantId: string, campaignId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, merchantId },
    })

    if (!campaign) {
      throw new NotFoundException({ code: 4001, message: '活动不存在' })
    }

    if (campaign.campaignStatus !== 'active') {
      throw new BadRequestException({
        code: 4002,
        message: `当前状态(${campaign.campaignStatus})无法暂停`,
      })
    }

    campaign.campaignStatus = 'paused'
    await this.campaignRepo.save(campaign)

    this.logger.log({ event: 'campaign_paused', campaignId })
    return { code: 0, message: '活动已暂停' }
  }

  /**
   * 终止活动
   */
  async terminateCampaign(merchantId: string, campaignId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, merchantId },
    })

    if (!campaign) {
      throw new NotFoundException({ code: 4001, message: '活动不存在' })
    }

    if (campaign.campaignStatus === 'ended' || campaign.campaignStatus === 'cancelled') {
      throw new BadRequestException({
        code: 4002,
        message: '活动已终止',
      })
    }

    campaign.campaignStatus = 'cancelled'
    campaign.endAt = new Date()
    await this.campaignRepo.save(campaign)

    this.logger.log({ event: 'campaign_terminated', campaignId })
    return { code: 0, message: '活动已终止' }
  }

  // ========================
  // 优惠券 CRUD
  // ========================

  /**
   * 创建优惠券
   */
  async createCoupon(
    merchantId: string,
    campaignId: string,
    dto: CreateCouponDto,
  ): Promise<{ couponId: string; couponCode: string }> {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId, merchantId },
    })

    if (!campaign) {
      throw new NotFoundException({ code: 4001, message: '活动不存在' })
    }

    if (campaign.campaignStatus !== 'draft') {
      throw new BadRequestException({
        code: 4002,
        message: '只有草稿状态的活动才能添加优惠券',
      })
    }

    // 生成券码
    const couponCode =
      dto.couponCode ??
      `CPN-${campaignId.slice(0, 8).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`

    // 验证券码唯一
    const existing = await this.couponRepo.findOne({
      where: { couponCode },
    })
    if (existing) {
      throw new BadRequestException({
        code: 4003,
        message: '券码已存在',
      })
    }

    const coupon = this.couponRepo.create({
      campaignId,
      merchantId,
      couponName: dto.couponName,
      couponCode,
      couponType: campaign.campaignType,
      thresholdAmount: dto.thresholdAmount ?? 0,
      discountAmount: dto.discountAmount ?? null,
      cashRewardAmount: dto.cashRewardAmount ?? null,
      agentRewardAmount: dto.agentRewardAmount,
      validFrom: new Date(dto.validFrom),
      validUntil: new Date(dto.validUntil),
      totalStock: dto.totalStock ?? null,
      remainingStock: dto.totalStock ?? null,
      perCustomerLimit: dto.perCustomerLimit ?? 1,
      status: CouponStatus.ACTIVE,
      totalIssued: 0,
      totalRedeemed: 0,
      totalCommissionPaid: 0,
    })

    await this.couponRepo.save(coupon)

    this.logger.log({
      event: 'coupon_created',
      couponId: coupon.id,
      couponCode,
      campaignId,
    })

    return { couponId: coupon.id, couponCode }
  }

  /**
   * 优惠券列表
   */
  async listCoupons(merchantId: string, query: ListCouponsDto) {
    const where: any = { merchantId }

    if (query.campaignId) {
      where.campaignId = query.campaignId
    }
    if (query.status) {
      where.status = query.status
    }

    const [coupons, total] = await this.couponRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
      take: query.pageSize ?? 20,
    })

    const items = coupons.map((c) => ({
      couponId: c.id,
      couponName: c.couponName,
      couponCode: c.couponCode,
      campaignId: c.campaignId,
      couponType: c.couponType,
      discountAmount: c.discountAmount,
      thresholdAmount: c.thresholdAmount,
      agentRewardAmount: c.agentRewardAmount,
      validFrom: c.validFrom,
      validUntil: c.validUntil,
      totalStock: c.totalStock,
      remainingStock: c.remainingStock,
      perCustomerLimit: c.perCustomerLimit,
      status: c.status,
      stats: {
        issued: c.totalIssued,
        redeemed: c.totalRedeemed,
        commissionPaid: Number(c.totalCommissionPaid),
      },
    }))

    return {
      items,
      pagination: {
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        total,
        totalPages: Math.ceil(total / (query.pageSize ?? 20)),
      },
    }
  }

  /**
   * 获取优惠券详情
   */
  async getCoupon(merchantId: string, couponId: string) {
    const coupon = await this.couponRepo.findOne({
      where: { id: couponId, merchantId },
    })

    if (!coupon) {
      throw new NotFoundException({ code: 4011, message: '优惠券不存在' })
    }

    return {
      couponId: coupon.id,
      couponName: coupon.couponName,
      couponCode: coupon.couponCode,
      couponType: coupon.couponType,
      discountAmount: coupon.discountAmount,
      thresholdAmount: coupon.thresholdAmount,
      cashRewardAmount: coupon.cashRewardAmount,
      agentRewardAmount: coupon.agentRewardAmount,
      validFrom: coupon.validFrom,
      validUntil: coupon.validUntil,
      totalStock: coupon.totalStock,
      remainingStock: coupon.remainingStock,
      perCustomerLimit: coupon.perCustomerLimit,
      status: coupon.status,
      stats: {
        issued: coupon.totalIssued,
        redeemed: coupon.totalRedeemed,
        commissionPaid: Number(coupon.totalCommissionPaid),
      },
    }
  }

  /**
   * 更新优惠券
   */
  async updateCoupon(merchantId: string, couponId: string, dto: UpdateCouponDto) {
    const coupon = await this.couponRepo.findOne({
      where: { id: couponId, merchantId },
    })

    if (!coupon) {
      throw new NotFoundException({ code: 4011, message: '优惠券不存在' })
    }

    // 关联活动不能是草稿状态
    const campaign = await this.campaignRepo.findOne({
      where: { id: coupon.campaignId, merchantId },
    })
    if (campaign && campaign.campaignStatus !== 'draft') {
      throw new BadRequestException({
        code: 4002,
        message: '已发布的活动不能修改优惠券',
      })
    }

    const allowed = ['couponName', 'validUntil', 'totalStock', 'agentRewardAmount']
    for (const field of allowed) {
      if (dto[field] !== undefined) {
        if (field === 'validUntil') {
          ;(coupon as any)[field] = new Date(dto[field])
        } else {
          ;(coupon as any)[field] = dto[field]
        }
        if (field === 'totalStock') {
          // 库存不能少于已发放数
          if ((dto.totalStock ?? 0) < coupon.totalIssued) {
            throw new BadRequestException({
              code: 4003,
              message: '库存不能少于已发放数量',
            })
          }
          coupon.remainingStock = (dto.totalStock ?? 0) - coupon.totalIssued
        }
      }
    }

    await this.couponRepo.save(coupon)
    this.logger.log({ event: 'coupon_updated', couponId })
  }

  /**
   * 删除优惠券（仅草稿活动下）
   */
  async deleteCoupon(merchantId: string, couponId: string) {
    const coupon = await this.couponRepo.findOne({
      where: { id: couponId, merchantId },
    })

    if (!coupon) {
      throw new NotFoundException({ code: 4011, message: '优惠券不存在' })
    }

    const campaign = await this.campaignRepo.findOne({
      where: { id: coupon.campaignId, merchantId },
    })

    if (!campaign || campaign.campaignStatus !== 'draft') {
      throw new BadRequestException({
        code: 4002,
        message: '只有草稿活动的优惠券才能删除',
      })
    }

    await this.couponRepo.softDelete(couponId)
    this.logger.log({ event: 'coupon_deleted', couponId })
  }
}
