import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { CampaignType } from '@ai-auto/shared'

import { AIBridgeService } from '../ai-bridge/ai-bridge.service'
import { Campaign } from '../campaign/entities/campaign.entity'
import { Coupon } from '../campaign/entities/coupon.entity'
import { CampaignService } from '../campaign/campaign.service'
import { CustomerCoupon } from '../customer/entities/customer-coupon.entity'
import { CampaignRecommendationService } from './campaign-recommendation.service'

const repo = () => ({ find: jest.fn() })

describe('CampaignRecommendationService', () => {
  let service: CampaignRecommendationService
  let campaignRepo: ReturnType<typeof repo>
  let couponRepo: ReturnType<typeof repo>
  let customerCouponRepo: ReturnType<typeof repo>
  let campaignService: any
  let aiBridge: any

  beforeEach(async () => {
    campaignRepo = repo()
    couponRepo = repo()
    customerCouponRepo = repo()
    campaignService = {
      createCampaign: jest.fn(),
      createCoupon: jest.fn(),
      publishCampaign: jest.fn(),
    }
    aiBridge = { recommendCampaigns: jest.fn() }
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignRecommendationService,
        { provide: getRepositoryToken(Campaign), useValue: campaignRepo },
        { provide: getRepositoryToken(Coupon), useValue: couponRepo },
        { provide: getRepositoryToken(CustomerCoupon), useValue: customerCouponRepo },
        { provide: CampaignService, useValue: campaignService },
        { provide: AIBridgeService, useValue: aiBridge },
      ],
    }).compile()
    service = module.get(CampaignRecommendationService)
  })

  it('combines the maintained calendar, history and customer profile into launchable recommendations', async () => {
    campaignRepo.find
      .mockResolvedValueOnce([
        {
          id: 'campaign-1',
          campaignName: '老客满减',
          campaignType: CampaignType.DISCOUNT,
          campaignStatus: 'ended',
          totalClaims: 100,
          totalRedemptions: 30,
        },
      ])
      .mockResolvedValueOnce([])
    couponRepo.find.mockResolvedValueOnce([])
    customerCouponRepo.find.mockResolvedValueOnce([
      { customerId: 'customer-1', customer: { totalRedemptions: 2 } },
      { customerId: 'customer-2', customer: { totalRedemptions: 1 } },
    ])
    aiBridge.recommendCampaigns.mockRejectedValueOnce(new Error('AI offline'))

    const result = await service.list('merchant-1')

    expect(result.calendar.length).toBeGreaterThan(0)
    expect(result.customerProfile.returningCustomerRate).toBe(50)
    expect(result.recommendations[0]).toEqual(
      expect.objectContaining({
        recommendationId: expect.stringMatching(/^holiday:/),
        rationale: expect.stringContaining('核销率 30%'),
        expectedImpact: expect.objectContaining({ expectedRoi: expect.any(Number) }),
      }),
    )
    expect(result.recommendations[0].campaign.campaignType).toBe(CampaignType.DISCOUNT)
  })

  it('launches only the server-generated campaign configuration', async () => {
    const context = {
      holidays: [{ id: 'test-holiday', name: '测试节日', date: '2026-09-01', daysAway: 4 }],
      history: {
        campaignCount: 0,
        totalClaims: 0,
        totalRedemptions: 0,
        redemptionRate: 0,
        preferredCampaignType: CampaignType.DISCOUNT,
        bestCampaignName: null,
        bestRedemptionRate: 0,
      },
      customerProfile: {
        totalCustomers: 0,
        returningCustomerRate: 0,
        newCustomerRate: 100,
        preferredCampaignType: CampaignType.DISCOUNT,
        insight: 'test',
      },
      peerBenchmark: { sampleSize: 0, redemptionRate: 12, description: 'benchmark' },
    }
    jest.spyOn(service as any, 'buildContext').mockResolvedValue(context)
    campaignService.createCampaign.mockResolvedValueOnce({ campaignId: 'campaign-1' })
    campaignService.createCoupon.mockResolvedValueOnce({
      couponId: 'coupon-1',
      couponCode: 'CPN-1',
    })
    campaignService.publishCampaign.mockResolvedValueOnce({ code: 0 })

    const result = await service.launch('merchant-1', 'holiday:test-holiday:discount')

    expect(campaignService.createCampaign).toHaveBeenCalledWith(
      'merchant-1',
      expect.objectContaining({ campaignName: '测试节日满减活动' }),
    )
    expect(campaignService.createCoupon).toHaveBeenCalledWith(
      'merchant-1',
      'campaign-1',
      expect.objectContaining({ discountAmount: 20 }),
    )
    expect(campaignService.publishCampaign).toHaveBeenCalledWith('merchant-1', 'campaign-1')
    expect(result).toEqual(
      expect.objectContaining({ campaignId: 'campaign-1', campaignStatus: 'active' }),
    )
  })
})
