import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import { Repository } from 'typeorm'

import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { CustomerAttribution } from './entities/customer-attribution.entity'
import { CustomerCoupon } from './entities/customer-coupon.entity'
import { Customer } from './entities/customer.entity'
import { GamificationService } from '../gamification/gamification.service'

const AUTO_AGENT_PASSWORD_ROUNDS = 12

@Injectable()
export class CustomerShareService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(CustomerCoupon)
    private readonly customerCouponRepo: Repository<CustomerCoupon>,
    @InjectRepository(CustomerAttribution)
    private readonly attributionRepo: Repository<CustomerAttribution>,
    @InjectRepository(SharingAgent)
    private readonly agentRepo: Repository<SharingAgent>,
    private readonly gamificationService: GamificationService,
  ) {}

  async prepareShare(
    customerId: string,
    customerCouponId: string,
    platform: 'wechat_friend' | 'wechat_moment' = 'wechat_friend',
  ) {
    const customerCoupon = await this.customerCouponRepo.findOne({
      where: { id: customerCouponId, customerId },
    })
    if (!customerCoupon) {
      throw new NotFoundException({ code: 4001, message: '优惠券不存在或无权分享' })
    }

    const { agent, isNewAgent } = await this.ensureAgent(customerId)
    return {
      agentId: agent.id,
      customerCouponId: customerCoupon.id,
      sharePath: `/pages/coupon-detail/index?couponId=${customerCoupon.couponId}&agentId=${agent.id}`,
      isNewAgent,
    }
  }

  /**
   * C 端创作和分享共用同一套无感转化逻辑：首次操作即成为分享员。
   * 对外暴露这一能力，避免创作入口自行复制账户创建规则。
   */
  async ensureCustomerAgent(
    customerId: string,
  ): Promise<{ agent: SharingAgent; isNewAgent: boolean }> {
    return this.ensureAgent(customerId)
  }

  async recordShare(
    customerId: string,
    customerCouponId: string,
    platform: 'wechat_friend' | 'wechat_moment',
  ) {
    const customerCoupon = await this.customerCouponRepo.findOne({
      where: { id: customerCouponId, customerId },
    })
    if (!customerCoupon) {
      throw new NotFoundException({ code: 4001, message: '优惠券不存在或无权分享' })
    }

    customerCoupon.sharePlatform = platform
    customerCoupon.shareCount += 1
    customerCoupon.lastSharedAt = new Date()
    await this.customerCouponRepo.save(customerCoupon)
    const challengeUpdates = await this.gamificationService.awardForShare(
      customerId,
      `share:${customerCoupon.id}:${customerCoupon.shareCount}`,
    )
    return { shareCount: customerCoupon.shareCount, challengeUpdates }
  }

  async getPromotionPerformance(customerId: string) {
    const agent = await this.findCustomerAgent(customerId)
    if (!agent) {
      return {
        isAgent: false,
        agentId: null,
        shareCount: 0,
        invitedCustomers: 0,
        redemptions: 0,
        estimatedCommission: 0,
        totalEarned: 0,
      }
    }

    const [attributions, coupons] = await Promise.all([
      this.attributionRepo.find({ where: { agentId: agent.id } }),
      this.customerCouponRepo.find({ where: { customerId } }),
    ])

    return {
      isAgent: true,
      agentId: agent.id,
      shareCount: coupons.reduce((total, coupon) => total + coupon.shareCount, 0),
      invitedCustomers: attributions.length,
      redemptions: attributions.reduce(
        (total, attribution) => total + attribution.totalRedemptions,
        0,
      ),
      estimatedCommission: attributions.reduce(
        (total, attribution) => total + Number(attribution.totalCommission),
        0,
      ),
      totalEarned: Number(agent.totalEarned),
    }
  }

  async assertReferralIsNotSelf(customerId: string, agentId: string) {
    const [customer, agent] = await Promise.all([
      this.customerRepo.findOne({ where: { id: customerId } }),
      this.agentRepo.findOne({ where: { id: agentId } }),
    ])
    if (!customer || !agent) {
      throw new NotFoundException({ code: 3004, message: '分享员不存在' })
    }
    if (customer.phone && customer.phone === agent.phone) {
      throw new BadRequestException({ code: 3005, message: '不能记录自己的分享归属' })
    }
  }

  private async ensureAgent(
    customerId: string,
  ): Promise<{ agent: SharingAgent; isNewAgent: boolean }> {
    const customer = await this.customerRepo.findOne({ where: { id: customerId } })
    if (!customer) {
      throw new NotFoundException({ code: 5001, message: '客户不存在' })
    }
    if (!customer.phone) {
      throw new BadRequestException({
        code: 3002,
        message: '请先完成手机号授权，再开始分享推广',
      })
    }

    const existing = await this.agentRepo.findOne({ where: { phone: customer.phone } })
    if (existing) return { agent: existing, isNewAgent: false }

    const passwordHash = await bcrypt.hash(randomUUID(), AUTO_AGENT_PASSWORD_ROUNDS)
    const agent = this.agentRepo.create({
      phone: customer.phone,
      nickname: customer.nickname,
      avatar: customer.avatar,
      passwordHash,
    })
    return { agent: await this.agentRepo.save(agent), isNewAgent: true }
  }

  private async findCustomerAgent(customerId: string): Promise<SharingAgent | null> {
    const customer = await this.customerRepo.findOne({ where: { id: customerId } })
    if (!customer?.phone) return null
    return this.agentRepo.findOne({ where: { phone: customer.phone } })
  }
}
