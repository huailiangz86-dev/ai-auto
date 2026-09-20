import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { Campaign } from '../campaign/entities/campaign.entity'
import { Coupon } from '../campaign/entities/coupon.entity'
import { Commission } from '../commission/entities/commission.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { Content } from '../content/entities/content.entity'
import {
  ContentPublication,
  PublicationStatus,
} from '../content/entities/content-publication.entity'
import { CustomerAttribution } from '../customer/entities/customer-attribution.entity'
import { CustomerCoupon } from '../customer/entities/customer-coupon.entity'
import { CreatorTaskPayout } from '../task/entities/creator-task-payout.entity'
import { CreatorTask } from '../task/entities/growth-task.entity'
import { GrowthPlan } from '../task/entities/growth-plan.entity'
import { MerchantConversionCenterQueryDto } from './dto/merchant-conversion.dto'

/**
 * Merchant-facing read model for the content → coupon → redemption chain.
 * It deliberately excludes customer identities and raw device/click metadata.
 */
@Injectable()
export class MerchantConversionService {
  constructor(
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(Coupon) private readonly coupons: Repository<Coupon>,
    @InjectRepository(CustomerCoupon)
    private readonly customerCoupons: Repository<CustomerCoupon>,
    @InjectRepository(Redemption) private readonly redemptions: Repository<Redemption>,
    @InjectRepository(Commission) private readonly commissions: Repository<Commission>,
    @InjectRepository(CreatorTask) private readonly creatorTasks: Repository<CreatorTask>,
    @InjectRepository(CreatorTaskPayout)
    private readonly creatorPayouts: Repository<CreatorTaskPayout>,
    @InjectRepository(GrowthPlan) private readonly growthPlans: Repository<GrowthPlan>,
    @InjectRepository(CustomerAttribution)
    private readonly attributions: Repository<CustomerAttribution>,
    @InjectRepository(Content) private readonly contents: Repository<Content>,
    @InjectRepository(ContentPublication)
    private readonly publications: Repository<ContentPublication>,
    @InjectRepository(SharingAgent) private readonly creators: Repository<SharingAgent>,
  ) {}

  async dashboard(merchantId: string, query: MerchantConversionCenterQueryDto) {
    const campaignWhere = query.campaignId ? { id: query.campaignId, merchantId } : { merchantId }
    const [campaigns, coupons, creatorTasks, customerCoupons, redemptions, commissions, payouts] =
      await Promise.all([
        this.campaigns.find({ where: campaignWhere, order: { createdAt: 'DESC' } }),
        this.coupons.find({ where: { merchantId }, order: { createdAt: 'DESC' } }),
        this.creatorTasks.find({
          where: query.campaignId ? { merchantId, campaignId: query.campaignId } : { merchantId },
          order: { updatedAt: 'DESC' },
        }),
        this.customerCoupons.find({ where: { merchantId }, order: { claimedAt: 'DESC' } }),
        this.redemptions.find({
          where: { merchantId },
          order: { verifiedAt: 'DESC', createdAt: 'DESC' },
        }),
        this.commissions.find({ where: { merchantId }, order: { createdAt: 'DESC' } }),
        this.creatorPayouts.find({ where: { merchantId }, order: { createdAt: 'DESC' } }),
      ])

    const campaignIds = new Set(campaigns.map((campaign) => campaign.id))
    const scopedCoupons = coupons.filter((coupon) => campaignIds.has(coupon.campaignId))
    const couponIds = new Set(scopedCoupons.map((coupon) => coupon.id))
    const scopedCustomerCoupons = customerCoupons.filter((coupon) => couponIds.has(coupon.couponId))
    const scopedRedemptions = redemptions.filter(
      (redemption) =>
        couponIds.has(redemption.couponId) &&
        (!query.campaignId || redemption.campaignId === query.campaignId),
    )
    const taskIds = new Set(creatorTasks.map((task) => task.id))
    const taskIdList = [...taskIds]
    const growthTaskIds = [...new Set(creatorTasks.map((task) => task.growthTaskId))]
    const growthPlans = growthTaskIds.length
      ? await this.growthPlans.find({ where: { merchantId, growthTaskId: In(growthTaskIds) } })
      : []
    const taskContents = taskIdList.length
      ? await this.contents.find({
          where: { creatorTaskId: In(taskIdList) },
          order: { createdAt: 'DESC' },
        })
      : []
    const contentIds = taskContents.map((content) => content.id)
    const publications = contentIds.length
      ? await this.publications.find({ where: { contentId: In(contentIds) } })
      : []
    const taskAttributions = taskIdList.length
      ? await this.attributions.find({ where: { creatorTaskId: In(taskIdList) } })
      : []
    const taskAttributionIds = new Set(taskAttributions.map((attribution) => attribution.id))
    const creatorIds = [...new Set(creatorTasks.map((task) => task.creatorId))]
    const creators = creatorIds.length
      ? await this.creators.find({ where: { id: In(creatorIds) } })
      : []

    const campaignById = new Map(campaigns.map((campaign) => [campaign.id, campaign]))
    const couponById = new Map(scopedCoupons.map((coupon) => [coupon.id, coupon]))
    const planByGrowthTaskId = new Map(growthPlans.map((plan) => [plan.growthTaskId, plan]))
    const creatorById = new Map(creators.map((creator) => [creator.id, creator]))
    const attributionById = new Map(
      taskAttributions.map((attribution) => [attribution.id, attribution]),
    )
    const commissionByRedemptionId = new Map(
      commissions.map((commission) => [commission.redemptionId, commission]),
    )
    const scopedPayouts = payouts.filter((payout) => taskIds.has(payout.creatorTaskId))
    const payoutByTaskId = new Map(scopedPayouts.map((payout) => [payout.creatorTaskId, payout]))
    const contentsByTaskId = this.group(taskContents, (content) => content.creatorTaskId ?? '')
    const publicationsByContentId = this.group(publications, (publication) => publication.contentId)
    const claimsByCouponId = this.group(scopedCustomerCoupons, (coupon) => coupon.couponId)
    const redemptionsByCouponId = this.group(scopedRedemptions, (redemption) => redemption.couponId)
    const claimsByAttributionId = this.group(
      scopedCustomerCoupons.filter((coupon) =>
        Boolean(
          coupon.trackingConsent &&
          coupon.attributionId &&
          taskAttributionIds.has(coupon.attributionId),
        ),
      ),
      (coupon) => coupon.attributionId ?? '',
    )
    const redemptionsByAttributionId = this.group(
      scopedRedemptions.filter((redemption) =>
        Boolean(redemption.attributionId && taskAttributionIds.has(redemption.attributionId)),
      ),
      (redemption) => redemption.attributionId ?? '',
    )
    const attributionsByTaskId = this.group(
      taskAttributions,
      (attribution) => attribution.creatorTaskId ?? '',
    )

    const conversionRedemptions = scopedRedemptions.filter(
      (redemption) =>
        Boolean(redemption.attributionId && taskAttributionIds.has(redemption.attributionId)) &&
        this.isVerified(redemption),
    )
    const conversionClaims = scopedCustomerCoupons.filter((coupon) =>
      Boolean(
        coupon.trackingConsent &&
        coupon.attributionId &&
        taskAttributionIds.has(coupon.attributionId),
      ),
    )
    const publishedPublications = publications.filter((publication) =>
      [PublicationStatus.PUBLISHED, PublicationStatus.MANUAL].includes(publication.status),
    )
    const reviewedPayouts = scopedPayouts.filter((payout) =>
      ['verified', 'settled', 'risk_hold'].includes(payout.status),
    )
    const conversionCommissions = this.commissionsFor(
      conversionRedemptions,
      commissionByRedemptionId,
    )

    return {
      filters: {
        campaignId: query.campaignId ?? null,
        campaigns: campaigns.map((campaign) => ({
          campaignId: campaign.id,
          campaignName: campaign.campaignName,
          purpose: campaign.purpose,
        })),
      },
      summary: {
        content: {
          pendingMerchantReview: creatorTasks.filter((task) => task.status === 'submitted').length,
          approved: creatorTasks.filter((task) => task.status === 'approved').length,
          published: creatorTasks.filter((task) =>
            ['published', 'tracking', 'completed', 'settled'].includes(task.status),
          ).length,
          publications: publishedPublications.length,
        },
        funnel: {
          impressions: this.sum(publishedPublications, 'impressions'),
          clicks: this.sum(publishedPublications, 'clicks'),
          claims: conversionClaims.length,
          verifiedRedemptions: conversionRedemptions.length,
          redemptionRate: this.rate(conversionRedemptions.length, conversionClaims.length),
          gmv: this.sum(conversionRedemptions, 'transactionAmount'),
          discountCost: this.sum(conversionRedemptions, 'discountValue'),
        },
        settlement: {
          expectedContentReward: this.sum(scopedPayouts, 'expectedAmount'),
          pendingContentReward: this.sum(
            reviewedPayouts.filter((payout) => payout.status !== 'settled'),
            'verifiedAmount',
          ),
          settledContentReward: this.sum(
            scopedPayouts.filter((payout) => payout.status === 'settled'),
            'verifiedAmount',
          ),
          creatorConversionPayout: this.sum(conversionCommissions, 'agentFinalPayout'),
          platformFee: this.sum(conversionCommissions, 'platformFee'),
        },
      },
      coupons: scopedCoupons.map((coupon) => {
        const couponClaims = claimsByCouponId.get(coupon.id) ?? []
        const couponRedemptions = redemptionsByCouponId.get(coupon.id) ?? []
        return {
          couponId: coupon.id,
          campaignId: coupon.campaignId,
          campaignName: campaignById.get(coupon.campaignId)?.campaignName ?? '未命名活动',
          couponName: coupon.couponName,
          couponCode: coupon.couponCode,
          status: coupon.status,
          offer: {
            thresholdAmount: this.number(coupon.thresholdAmount),
            discountAmount: this.number(coupon.discountAmount),
            cashRewardAmount: this.number(coupon.cashRewardAmount),
            grossRewardPerRedemption: this.number(coupon.agentRewardAmount),
          },
          performance: {
            claims: couponClaims.length,
            active: couponClaims.filter((item) => item.status === 'active').length,
            redeemed: couponClaims.filter((item) => item.status === 'redeemed').length,
            expired: couponClaims.filter((item) => item.status === 'expired').length,
            verifiedRedemptions: couponRedemptions.filter((item) => this.isVerified(item)).length,
            gmv: this.sum(
              couponRedemptions.filter((item) => this.isVerified(item)),
              'transactionAmount',
            ),
            discountCost: this.sum(
              couponRedemptions.filter((item) => this.isVerified(item)),
              'discountValue',
            ),
          },
        }
      }),
      creatorTasks: creatorTasks.map((task) => {
        const taskContents = contentsByTaskId.get(task.id) ?? []
        const taskPublications = taskContents.flatMap(
          (content) => publicationsByContentId.get(content.id) ?? [],
        )
        const taskAttributions = attributionsByTaskId.get(task.id) ?? []
        const taskClaims = taskAttributions.flatMap(
          (attribution) => claimsByAttributionId.get(attribution.id) ?? [],
        )
        const taskRedemptions = taskAttributions.flatMap(
          (attribution) => redemptionsByAttributionId.get(attribution.id) ?? [],
        )
        const verifiedTaskRedemptions = taskRedemptions.filter((item) => this.isVerified(item))
        const taskCommissions = this.commissionsFor(
          verifiedTaskRedemptions,
          commissionByRedemptionId,
        )
        const payout = payoutByTaskId.get(task.id)
        const creator = creatorById.get(task.creatorId)
        // A plan pins the one coupon intended for conversion. The campaign
        // fallback only serves older direct-created tasks without a plan.
        const growthPlan = planByGrowthTaskId.get(task.growthTaskId)
        const conversionCoupon = growthPlan?.couponId
          ? couponById.get(growthPlan.couponId)
          : scopedCoupons.find((coupon) => coupon.campaignId === task.campaignId)
        const claimPath =
          conversionCoupon && task.trackingId
            ? `/pages/coupon-detail/index?couponId=${encodeURIComponent(conversionCoupon.id)}&trackingId=${encodeURIComponent(task.trackingId)}`
            : null
        return {
          creatorTaskId: task.id,
          campaignId: task.campaignId ?? null,
          campaignName: task.campaignId
            ? (campaignById.get(task.campaignId)?.campaignName ?? '未命名活动')
            : '未关联活动',
          creator: {
            creatorId: task.creatorId,
            nickname: creator?.nickname ?? `达人 ${task.creatorId.slice(0, 8)}`,
          },
          channel: task.channel,
          contentType: task.contentType,
          brief: task.brief,
          deadline: task.deadline,
          status: task.status,
          review: {
            reason: task.reviewReason ?? null,
            reviewedAt: task.reviewedAt ?? null,
            submittedAt: task.submissionEvidence?.submittedAt ?? null,
            draftUrl: task.submissionEvidence?.draftUrl ?? null,
            note: task.submissionEvidence?.note ?? null,
            contentIds: task.submissionEvidence?.contentIds ?? [],
          },
          publishing: {
            trackingId: task.trackingId ?? null,
            conversionCoupon: conversionCoupon
              ? { couponId: conversionCoupon.id, couponName: conversionCoupon.couponName }
              : null,
            claimPath,
            publishedUrl: task.publishedUrl ?? null,
            contents: taskContents.map((content) => ({
              contentId: content.id,
              type: content.contentType,
              platform: content.targetPlatform ?? null,
              status: content.status,
              moderationStatus: content.moderationStatus,
            })),
            publications: taskPublications.map((publication) => ({
              publicationId: publication.id,
              platform: publication.platform,
              status: publication.status,
              postUrl: publication.platformPostUrl ?? null,
              impressions: this.number(publication.impressions),
              clicks: this.number(publication.clicks),
              publishedAt: publication.publishedAt ?? null,
            })),
          },
          conversion: {
            attributionLocks: taskAttributions.length,
            claims: taskClaims.length,
            verifiedRedemptions: verifiedTaskRedemptions.length,
            gmv: this.sum(verifiedTaskRedemptions, 'transactionAmount'),
            discountCost: this.sum(verifiedTaskRedemptions, 'discountValue'),
          },
          rewards: {
            baseReward: this.number(task.baseReward),
            performanceReward: task.performanceReward ?? {},
            contentPayout: payout
              ? {
                  expectedAmount: this.number(payout.expectedAmount),
                  verifiedAmount: this.number(payout.verifiedAmount),
                  status: payout.status,
                  settleAt: payout.settleAt ?? null,
                }
              : null,
            creatorConversionPayout: this.sum(taskCommissions, 'agentFinalPayout'),
            platformFee: this.sum(taskCommissions, 'platformFee'),
          },
        }
      }),
      transactions: conversionRedemptions.slice(0, 100).map((redemption) => {
        const attribution = redemption.attributionId
          ? attributionById.get(redemption.attributionId)
          : undefined
        const commission = commissionByRedemptionId.get(redemption.id)
        return {
          redemptionId: redemption.id,
          verifiedAt: redemption.verifiedAt ?? null,
          campaignName: redemption.campaignId
            ? (campaignById.get(redemption.campaignId)?.campaignName ?? '未命名活动')
            : '未关联活动',
          couponName: couponById.get(redemption.couponId)?.couponName ?? '优惠券',
          creatorTaskId: attribution?.creatorTaskId ?? null,
          trackingId: attribution?.trackingId ?? null,
          transactionAmount: this.number(redemption.transactionAmount),
          discountValue: this.number(redemption.discountValue),
          creatorPayout: this.number(commission?.agentFinalPayout),
          platformFee: this.number(commission?.platformFee),
          commissionStatus: commission?.status ?? null,
        }
      }),
    }
  }

  private group<T>(items: T[], key: (item: T) => string) {
    const groups = new Map<string, T[]>()
    for (const item of items) {
      const id = key(item)
      if (!id) continue
      groups.set(id, [...(groups.get(id) ?? []), item])
    }
    return groups
  }

  private commissionsFor(redemptions: Redemption[], byRedemptionId: Map<string, Commission>) {
    return redemptions.flatMap((redemption) => {
      const commission = byRedemptionId.get(redemption.id)
      return commission ? [commission] : []
    })
  }

  private sum<T extends Record<string, any>>(items: T[], field: keyof T) {
    return this.money(items.reduce((total, item) => total + this.number(item[field]), 0))
  }

  private number(value: unknown) {
    const result = Number(value ?? 0)
    return Number.isFinite(result) ? result : 0
  }

  private money(value: number) {
    return Math.round(value * 100) / 100
  }

  private rate(numerator: number, denominator: number) {
    return denominator > 0 ? this.money((numerator / denominator) * 100) : 0
  }

  private isVerified(redemption: Redemption) {
    return ['verified', 'settled'].includes(redemption.status) && !redemption.fraudFlagged
  }
}
