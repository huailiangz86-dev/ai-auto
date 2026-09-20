import { MerchantConversionService } from './merchant-conversion.service'

function repository(items: any[] = []) {
  return { find: jest.fn().mockResolvedValue(items) }
}

describe('MerchantConversionService', () => {
  it('按任务快照统计归因，并排除风控或未验证核销', async () => {
    const service = new MerchantConversionService(
      repository([
        {
          id: 'campaign-1',
          merchantId: 'merchant-1',
          campaignName: '秋日探店',
          purpose: 'creator_content',
        },
      ]) as any,
      repository([
        {
          id: 'coupon-1',
          merchantId: 'merchant-1',
          campaignId: 'campaign-1',
          couponName: '秋日转化券',
          status: 'active',
        },
      ]) as any,
      repository([
        {
          id: 'claim-1',
          merchantId: 'merchant-1',
          couponId: 'coupon-1',
          attributionId: 'attr-1',
          trackingConsent: true,
          status: 'active',
        },
        {
          id: 'claim-other-task',
          merchantId: 'merchant-1',
          couponId: 'coupon-1',
          attributionId: 'attr-2',
          trackingConsent: true,
          status: 'active',
        },
      ]) as any,
      repository([
        {
          id: 'redemption-1',
          merchantId: 'merchant-1',
          couponId: 'coupon-1',
          campaignId: 'campaign-1',
          attributionId: 'attr-1',
          status: 'verified',
          fraudFlagged: false,
          transactionAmount: 150,
          discountValue: 20,
        },
        {
          id: 'redemption-fraud',
          merchantId: 'merchant-1',
          couponId: 'coupon-1',
          campaignId: 'campaign-1',
          attributionId: 'attr-1',
          status: 'verified',
          fraudFlagged: true,
          transactionAmount: 999,
          discountValue: 99,
        },
        {
          id: 'redemption-other-task',
          merchantId: 'merchant-1',
          couponId: 'coupon-1',
          campaignId: 'campaign-1',
          attributionId: 'attr-2',
          status: 'verified',
          fraudFlagged: false,
          transactionAmount: 300,
          discountValue: 30,
        },
      ]) as any,
      repository([{ redemptionId: 'redemption-1', agentFinalPayout: 12, platformFee: 3 }]) as any,
      repository([
        {
          id: 'task-1',
          merchantId: 'merchant-1',
          growthTaskId: 'growth-1',
          campaignId: 'campaign-1',
          creatorId: 'creator-1',
          trackingId: 'tracking-1',
          status: 'published',
          channel: 'xiaohongshu',
          contentType: 'note',
          brief: '探店内容',
          deadline: new Date(),
          baseReward: 200,
          performanceReward: {},
          submissionEvidence: {},
        },
      ]) as any,
      repository([
        { creatorTaskId: 'task-1', expectedAmount: 200, verifiedAmount: 150, status: 'verified' },
      ]) as any,
      repository([
        { growthTaskId: 'growth-1', merchantId: 'merchant-1', couponId: 'coupon-1' },
      ]) as any,
      repository([
        { id: 'attr-1', creatorTaskId: 'task-1', trackingId: 'tracking-1' },
        { id: 'attr-2', creatorTaskId: 'task-outside-scope', trackingId: 'tracking-other' },
      ]) as any,
      repository() as any,
      repository() as any,
      repository([{ id: 'creator-1', nickname: '小林' }]) as any,
    )

    const result = await service.dashboard('merchant-1', { campaignId: 'campaign-1' })

    expect(result.summary.funnel).toMatchObject({ claims: 1, verifiedRedemptions: 1, gmv: 150 })
    expect(result.summary.settlement).toMatchObject({ creatorConversionPayout: 12, platformFee: 3 })
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0]).toMatchObject({
      redemptionId: 'redemption-1',
      creatorTaskId: 'task-1',
    })
    expect(result.creatorTasks[0]).toMatchObject({
      creatorTaskId: 'task-1',
      conversion: { claims: 1, verifiedRedemptions: 1, gmv: 150 },
      publishing: {
        claimPath: '/pages/coupon-detail/index?couponId=coupon-1&trackingId=tracking-1',
        conversionCoupon: { couponId: 'coupon-1', couponName: '秋日转化券' },
      },
    })
  })
})
