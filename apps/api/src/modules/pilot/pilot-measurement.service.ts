import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { RedemptionStatus } from '@ai-auto/shared'
import { In, Repository } from 'typeorm'
import { Campaign } from '../campaign/entities/campaign.entity'
import { Coupon } from '../campaign/entities/coupon.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { CustomerAttribution } from '../customer/entities/customer-attribution.entity'
import { CustomerCoupon } from '../customer/entities/customer-coupon.entity'
import { CreatorTask } from '../task/entities/growth-task.entity'
import { CreatorTaskPayout } from '../task/entities/creator-task-payout.entity'
import { CampaignMeasurementProtocol } from './entities/campaign-measurement-protocol.entity'
import { PilotMetricEvent } from './entities/pilot-metric-event.entity'
import { RegisterCampaignMeasurementProtocolDto } from './dto/pilot-measurement.dto'

@Injectable()
export class PilotMeasurementService {
  constructor(
    @InjectRepository(CampaignMeasurementProtocol)
    private readonly protocols: Repository<CampaignMeasurementProtocol>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @InjectRepository(Coupon) private readonly coupons: Repository<Coupon>,
    @InjectRepository(CustomerCoupon) private readonly customerCoupons: Repository<CustomerCoupon>,
    @InjectRepository(Redemption) private readonly redemptions: Repository<Redemption>,
    @InjectRepository(CustomerAttribution)
    private readonly attributions: Repository<CustomerAttribution>,
    @InjectRepository(CreatorTask) private readonly creatorTasks: Repository<CreatorTask>,
    @InjectRepository(CreatorTaskPayout) private readonly payouts: Repository<CreatorTaskPayout>,
    @InjectRepository(PilotMetricEvent) private readonly events: Repository<PilotMetricEvent>,
  ) {}

  async register(
    merchantId: string,
    campaignId: string,
    dto: RegisterCampaignMeasurementProtocolDto,
  ) {
    const campaign = await this.campaigns.findOne({ where: { id: campaignId, merchantId } })
    if (!campaign) throw new NotFoundException('Campaign 不存在')
    if (campaign.campaignStatus !== 'draft')
      throw new BadRequestException('Campaign 激活后不能修改测量预登记')
    const dates = this.dates(dto)
    const existing = await this.protocols.findOne({ where: { campaignId, merchantId } })
    const protocol =
      existing ??
      this.protocols.create({
        campaignId,
        merchantId,
        registeredAt: new Date(),
        ...dates,
        ...this.copy(dto),
      })
    Object.assign(protocol, dates, this.copy(dto))
    if (!existing) protocol.registeredAt = new Date()
    return this.protocols.save(protocol)
  }

  async assertActivationAllowed(merchantId: string, campaignId: string) {
    const protocol = await this.protocols.findOne({ where: { campaignId, merchantId } })
    if (!protocol)
      throw new BadRequestException(
        'Campaign 激活前必须预登记实验组、对照组、基线/观察期和订单/GMV 口径',
      )
    if (protocol.baselineEndAt > protocol.observationStartAt)
      throw new BadRequestException('测量预登记的基线期必须在观察期之前结束')
  }

  async recordCampaignActivation(campaign: Campaign) {
    await this.events
      .createQueryBuilder()
      .insert()
      .into(PilotMetricEvent)
      .values({
        eventType: 'campaign_activated',
        idempotencyKey: `pilot:campaign:${campaign.id}:activated`,
        subjectType: 'campaign',
        subjectId: campaign.id,
        merchantId: campaign.merchantId,
        campaignId: campaign.id,
        growthTaskId: null,
        creatorId: null,
        creatorTaskId: null,
        occurredAt: campaign.startAt,
        metadata: { source: 'campaign_publish' },
      })
      .orIgnore()
      .execute()
  }

  async weeklyEvidence(input: { campaignId?: string; weekStartAt?: string }) {
    const start = input.weekStartAt
      ? this.startOfWeek(new Date(input.weekStartAt))
      : this.startOfWeek(new Date())
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 7)
    const campaigns = (await this.campaigns.find()).filter(
      (item) =>
        item.campaignStatus !== 'draft' && (!input.campaignId || item.id === input.campaignId),
    )
    const campaignIds = campaigns.map((item) => item.id)
    if (input.campaignId && !campaigns.length) throw new NotFoundException('Campaign 不存在')
    const [protocols, coupons, allClaims, allRedemptions, allTasks, allPayouts] = await Promise.all(
      [
        campaignIds.length ? this.protocols.find({ where: { campaignId: In(campaignIds) } }) : [],
        campaignIds.length ? this.coupons.find({ where: { campaignId: In(campaignIds) } }) : [],
        this.customerCoupons.find(),
        this.redemptions.find(),
        this.creatorTasks.find(),
        this.payouts.find(),
      ],
    )
    const couponIds = new Set(coupons.map((item) => item.id))
    const claims = allClaims.filter(
      (item) => couponIds.has(item.couponId) && this.inWeek(item.claimedAt, start, end),
    )
    const redemptions = allRedemptions.filter(
      (item) =>
        campaignIds.includes(item.campaignId ?? '') &&
        this.verified(item) &&
        this.inWeek(item.verifiedAt ?? item.createdAt, start, end),
    )
    const attributionIds = redemptions.flatMap((item) =>
      item.attributionId ? [item.attributionId] : [],
    )
    const attributions = attributionIds.length
      ? await this.attributions.find({ where: { id: In(attributionIds) } })
      : []
    const attributionById = new Map(attributions.map((item) => [item.id, item]))
    const claimByRedemption = new Map(
      claims.flatMap((item) => (item.redemptionId ? [[item.redemptionId, item] as const] : [])),
    )
    const claimByCode = new Map(claims.map((item) => [item.couponCode, item]))
    const payouts = allPayouts.filter(
      (item) =>
        campaignIds.includes(item.campaignId ?? '') &&
        this.inWeek(item.verifiedAt ?? item.settledAt ?? item.createdAt, start, end),
    )
    const payoutsByCreator = new Map<string, CreatorTaskPayout[]>()
    payouts.forEach((item) =>
      payoutsByCreator.set(item.creatorId, [...(payoutsByCreator.get(item.creatorId) ?? []), item]),
    )
    const discrepancies = redemptions.map((redemption) => {
      const claim = claimByRedemption.get(redemption.id) ?? claimByCode.get(redemption.couponCode)
      const creatorId = redemption.attributionId
        ? attributionById.get(redemption.attributionId)?.agentId
        : null
      const payout = creatorId ? payoutsByCreator.get(creatorId)?.[0] : undefined
      const missingStages = [
        ...(!claim?.trackingConsent ? ['consent'] : []),
        ...(!claim ? ['coupon_claim'] : []),
        ...(!payout && creatorId ? ['creator_payout'] : []),
      ]
      return {
        redemptionId: redemption.id,
        campaignId: redemption.campaignId,
        transactionAmount: Number(redemption.transactionAmount),
        consentedAt: claim?.trackingConsentedAt ?? null,
        claimedAt: claim?.claimedAt ?? null,
        verifiedAt: redemption.verifiedAt ?? redemption.createdAt,
        creatorId,
        creatorPayout: payout
          ? {
              payoutId: payout.id,
              status: payout.status,
              amount: Number(payout.verifiedAmount ?? payout.expectedAmount),
            }
          : null,
        reportIncluded: true,
        missingStages,
      }
    })
    const acceptedTasks = allTasks.filter(
      (item) =>
        campaignIds.includes(item.campaignId ?? '') &&
        !['created', 'matching', 'invited'].includes(item.status) &&
        this.inWeek(item.stateChangedAt ?? item.createdAt, start, end),
    )
    return {
      week: { startAt: start, endAt: end },
      summary: {
        campaigns: campaignIds.length,
        preRegisteredCampaigns: protocols.length,
        consented: claims.filter((item) => item.trackingConsent).length,
        claimed: claims.length,
        redeemed: redemptions.length,
        creatorPayouts: payouts.length,
        reports: campaignIds.length,
        acceptedCreatorTasks: acceptedTasks.length,
        discrepancyCount: discrepancies.filter((item) => item.missingStages.length).length,
      },
      protocols: protocols.map((item) => this.protocol(item)),
      discrepancies,
    }
  }

  async operationsMetrics() {
    const [events, campaigns, protocols] = await Promise.all([
      this.events.find(),
      this.campaigns.find(),
      this.protocols.find(),
    ])
    const activatedIds = new Set(
      events
        .filter((item) => item.eventType === 'campaign_activated' && item.campaignId)
        .map((item) => item.campaignId!),
    )
    const activated = campaigns.filter((item) => activatedIds.has(item.id))
    const byMerchant = new Map<string, Campaign[]>()
    activated.forEach((item) =>
      byMerchant.set(item.merchantId, [...(byMerchant.get(item.merchantId) ?? []), item]),
    )
    const merchantCampaigns = [...byMerchant.values()]
    const repeat = merchantCampaigns.filter((items) => items.length > 1).length
    const expanded = merchantCampaigns.filter((items) =>
      items
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .some(
          (item, index, ordered) =>
            index > 0 &&
            Number(item.maxBudget ?? 0) >
              Math.max(...ordered.slice(0, index).map((prior) => Number(prior.maxBudget ?? 0))),
        ),
    ).length
    const invited = new Set(
      events.filter((item) => item.eventType === 'task_invited').map((item) => item.subjectId),
    ).size
    const accepted = new Set(
      events.filter((item) => item.eventType === 'task_accepted').map((item) => item.subjectId),
    ).size
    const measurable = protocols.filter((item) => activatedIds.has(item.campaignId)).length
    return {
      activatedCampaigns: activated.length,
      merchants: merchantCampaigns.length,
      repeatCampaignRate: this.rate(repeat, merchantCampaigns.length),
      budgetExpansionRate: this.rate(expanded, merchantCampaigns.length),
      validTaskAcceptanceRate: this.rate(accepted, invited),
      measurableCampaignShare: this.rate(measurable, activated.length),
      counts: {
        repeatMerchants: repeat,
        expandedMerchants: expanded,
        invited,
        accepted,
        measurableCampaigns: measurable,
      },
    }
  }

  private dates(dto: RegisterCampaignMeasurementProtocolDto) {
    const baselineStartAt = new Date(dto.baselineStartAt),
      baselineEndAt = new Date(dto.baselineEndAt),
      observationStartAt = new Date(dto.observationStartAt),
      observationEndAt = new Date(dto.observationEndAt)
    if (!(
      baselineStartAt < baselineEndAt &&
      baselineEndAt <= observationStartAt &&
      observationStartAt < observationEndAt
    ))
      throw new BadRequestException('基线期与观察期必须连续有效且不重叠')
    return { baselineStartAt, baselineEndAt, observationStartAt, observationEndAt }
  }
  private copy(dto: RegisterCampaignMeasurementProtocolDto) {
    return {
      method: dto.method,
      experimentGroupDefinition: dto.experimentGroupDefinition.trim(),
      controlGroupDefinition: dto.controlGroupDefinition.trim(),
      ordersDefinition: dto.ordersDefinition.trim(),
      gmvDefinition: dto.gmvDefinition.trim(),
    }
  }
  private protocol(item: CampaignMeasurementProtocol) {
    return {
      campaignId: item.campaignId,
      method: item.method,
      experimentGroupDefinition: item.experimentGroupDefinition,
      controlGroupDefinition: item.controlGroupDefinition,
      baseline: { startAt: item.baselineStartAt, endAt: item.baselineEndAt },
      observation: { startAt: item.observationStartAt, endAt: item.observationEndAt },
      ordersDefinition: item.ordersDefinition,
      gmvDefinition: item.gmvDefinition,
      registeredAt: item.registeredAt,
    }
  }
  private startOfWeek(value: Date) {
    const result = new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    )
    result.setUTCDate(result.getUTCDate() - ((result.getUTCDay() + 6) % 7))
    return result
  }
  private inWeek(value: Date, start: Date, end: Date) {
    const time = new Date(value).getTime()
    return time >= start.getTime() && time < end.getTime()
  }
  private verified(item: Redemption) {
    return [RedemptionStatus.VERIFIED, RedemptionStatus.SETTLED].includes(item.status)
  }
  private rate(numerator: number, denominator: number) {
    return denominator ? Math.round((numerator / denominator) * 10_000) / 10_000 : 0
  }
}
