// ============================================================
// AI auto - AICampaignService Unit Tests
// Natural language → AI parse → auto-create → auto-publish
// ============================================================

import { Test, TestingModule } from '@nestjs/testing'

import { AICampaignService } from './ai-campaign.service'
import { AIBridgeService } from '../ai-bridge/ai-bridge.service'
import { CampaignService } from '../campaign/campaign.service'
import { CampaignType } from '@ai-auto/shared'

describe('AICampaignService', () => {
  let service: AICampaignService
  let aiBridge: any
  let campaignService: any

  beforeEach(async () => {
    aiBridge = {
      configureCampaign: jest.fn(),
    }
    campaignService = {
      createCampaign: jest.fn(),
      createCoupon: jest.fn(),
      publishCampaign: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AICampaignService,
        { provide: AIBridgeService, useValue: aiBridge },
        { provide: CampaignService, useValue: campaignService },
      ],
    }).compile()

    service = module.get<AICampaignService>(AICampaignService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ========================
  // parseAIResponse()
  // ========================

  describe('parseAIResponse()', () => {
    it('支持 data 包装格式', () => {
      const aiResult = {
        data: {
          plan_id: 'plan-1',
          title: '七夕满减',
          campaign_type: 'DISCOUNT',
          discount_amount: 20,
          threshold_amount: 100,
          agent_reward: 5,
          estimated_budget: 5000,
        },
      }

      const plan = (service as any).parseAIResponse(aiResult)

      expect(plan.planId).toBe('plan-1')
      expect(plan.title).toBe('七夕满减')
      expect(plan.discountAmount).toBe(20)
      expect(plan.thresholdAmount).toBe(100)
    })

    it('支持扁平 snake_case 格式', () => {
      const aiResult = {
        plan_id: 'plan-2',
        title: '新客专享',
        campaign_type: 'CASH_REWARD',
        cash_reward: 10,
        threshold_amount: 0,
        agent_reward: 5,
      }

      const plan = (service as any).parseAIResponse(aiResult)

      expect(plan.campaignType).toBe(CampaignType.CASH_REWARD)
      expect(plan.cashRewardAmount).toBe(10)
    })

    it('支持 camelCase 格式', () => {
      const aiResult = {
        planId: 'plan-3',
        title: '组合套餐',
        campaignType: 'COMBO',
        discountAmount: 50,
        thresholdAmount: 200,
        agentRewardAmount: 10,
      }

      const plan = (service as any).parseAIResponse(aiResult)

      expect(plan.planId).toBe('plan-3')
      expect(plan.campaignType).toBe(CampaignType.COMBO)
      expect(plan.discountAmount).toBe(50)
    })

    it('支持纯文本 JSON 块解析', () => {
      const aiResult =
        '{"plan_id":"plan-4","title":"限时折扣","campaign_type":"DISCOUNT","discount_amount":15}'

      const plan = (service as any).parseAIResponse(aiResult)

      expect(plan.planId).toBe('plan-4')
      expect(plan.title).toBe('限时折扣')
    })

    it('纯文本非 JSON 时降级到默认', () => {
      const aiResult = '这是一段无法解析的描述文本'

      const plan = (service as any).parseAIResponse(aiResult)

      expect(plan.planId).toMatch(/^default-\d+$/)
      expect(plan.campaignType).toBe(CampaignType.DISCOUNT)
    })

    it('无法解析时使用默认配置', () => {
      const aiResult = { invalid: 'data' }

      const plan = (service as any).parseAIResponse(aiResult)

      expect(plan.title).toBe('AI智能活动')
    })

    it('normalizeCampaignType 正确识别返现类型', () => {
      const aiResult = { campaign_type: 'cash_reward' }
      const plan = (service as any).parseAIResponse(aiResult)
      expect(plan.campaignType).toBe(CampaignType.CASH_REWARD)
    })

    it('normalizeCampaignType 正确识别组合类型', () => {
      const aiResult = { campaign_type: 'combo_bundle' }
      const plan = (service as any).parseAIResponse(aiResult)
      expect(plan.campaignType).toBe(CampaignType.COMBO)
    })
  })

  // ========================
  // buildDefaultPlan()
  // ========================

  describe('buildDefaultPlan()', () => {
    it('默认返回满减活动', () => {
      const plan = (service as any).buildDefaultPlan('帮我做一个促销活动')

      expect(plan.campaignType).toBe(CampaignType.DISCOUNT)
      expect(plan.discountAmount).toBe(20)
      expect(plan.thresholdAmount).toBe(100)
      expect(plan.agentRewardAmount).toBeGreaterThan(0)
    })

    it('识别返现关键词', () => {
      const plan = (service as any).buildDefaultPlan('做一个现金返现活动')

      expect(plan.campaignType).toBe(CampaignType.CASH_REWARD)
      expect(plan.thresholdAmount).toBe(0)
    })

    it('识别组合关键词', () => {
      const plan = (service as any).buildDefaultPlan('做一个组合套餐优惠')

      expect(plan.campaignType).toBe(CampaignType.COMBO)
    })

    it('识别满减金额', () => {
      const plan = (service as any).buildDefaultPlan('满200减50活动')

      expect(plan.thresholdAmount).toBe(200)
    })

    it('识别折扣百分比', () => {
      // "8折" → 满100减20（100*(10-8)/10）
      const plan = (service as any).buildDefaultPlan('全场8折优惠')

      expect(plan.discountAmount).toBe(20)
      expect(plan.thresholdAmount).toBe(100)
    })

    it('默认值设置正确', () => {
      const plan = (service as any).buildDefaultPlan('')

      expect(plan.couponValidityDays).toBe(30)
      expect(plan.totalStock).toBe(1000)
      expect(plan.perCustomerLimit).toBe(1)
    })
  })

  // ========================
  // createCampaignFromDescription()
  // ========================

  describe('createCampaignFromDescription()', () => {
    it('AI 解析成功时创建并发布活动', async () => {
      aiBridge.configureCampaign.mockResolvedValueOnce({
        data: {
          plan_id: 'plan-ai-1',
          title: '七夕满减',
          campaign_type: 'DISCOUNT',
          discount_amount: 20,
          threshold_amount: 100,
          agent_reward: 5,
        },
      })
      campaignService.createCampaign.mockResolvedValueOnce({
        campaignId: 'campaign-1',
      })
      campaignService.createCoupon.mockResolvedValueOnce({
        couponId: 'coupon-1',
        couponCode: 'CPN-123',
      })
      campaignService.publishCampaign.mockResolvedValueOnce({
        code: 0,
      })

      const result = await service.createCampaignFromDescription('merchant-1', {
        description: '帮我做一个七夕满减活动',
      })

      expect(result.campaignId).toBe('campaign-1')
      expect(result.couponId).toBe('coupon-1')
      expect(result.couponCode).toBe('CPN-123')
      expect(result.campaignStatus).toBe('active')
      expect(campaignService.publishCampaign).toHaveBeenCalledWith('merchant-1', 'campaign-1')
    })

    it('AI 失败时使用默认配置继续创建', async () => {
      aiBridge.configureCampaign.mockRejectedValueOnce(new Error('AI service unavailable'))
      campaignService.createCampaign.mockResolvedValueOnce({
        campaignId: 'campaign-default',
      })
      campaignService.createCoupon.mockResolvedValueOnce({
        couponId: 'coupon-default',
        couponCode: 'CPN-DEF',
      })
      campaignService.publishCampaign.mockResolvedValueOnce({})

      const result = await service.createCampaignFromDescription('merchant-1', {
        description: '做活动',
      })

      expect(result.campaignId).toBe('campaign-default')
      expect(campaignService.publishCampaign).toHaveBeenCalled()
    })

    it('合并商家自定义参数', async () => {
      aiBridge.configureCampaign.mockResolvedValueOnce({
        data: { plan_id: 'p1', title: '默认', campaign_type: 'DISCOUNT' },
      })
      campaignService.createCampaign.mockImplementation((mid: string, dto: any) => {
        return Promise.resolve({ campaignId: 'campaign-1' })
      })
      campaignService.createCoupon.mockResolvedValueOnce({
        couponId: 'coupon-1',
        couponCode: 'CPN-1',
      })
      campaignService.publishCampaign.mockResolvedValueOnce({})

      await service.createCampaignFromDescription('merchant-1', {
        description: '满减',
        campaignName: '自定义名称',
        maxBudget: 10000,
      })

      expect(campaignService.createCampaign).toHaveBeenCalledWith(
        'merchant-1',
        expect.objectContaining({
          campaignName: '自定义名称',
        }),
      )
    })

    it('有效期自动计算（30天）', async () => {
      aiBridge.configureCampaign.mockResolvedValueOnce({
        data: { plan_id: 'p1', campaign_type: 'DISCOUNT' },
      })
      campaignService.createCampaign.mockResolvedValueOnce({
        campaignId: 'campaign-1',
      })
      campaignService.createCoupon.mockImplementation(
        async (mid: string, cid: string, dto: any) => {
          const validUntil = new Date(dto.validUntil)
          const diff = validUntil.getTime() - Date.now()
          // 应该在 30 天左右（允许误差 1 小时）
          const daysDiff = diff / (24 * 60 * 60 * 1000)
          expect(daysDiff).toBeGreaterThan(29)
          expect(daysDiff).toBeLessThan(31)
          return { couponId: 'coupon-1', couponCode: 'CPN-1' }
        },
      )
      campaignService.publishCampaign.mockResolvedValueOnce({})

      await service.createCampaignFromDescription('merchant-1', {
        description: '活动',
      })
    })
  })
})
