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
      generateMarketingProduct: jest.fn(),
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
  // previewCampaign()
  // ========================

  describe('previewCampaign()', () => {
    it('将 AI 返回的三套活动与优惠券方案转换为统一预览模型', async () => {
      aiBridge.configureCampaign.mockResolvedValueOnce({
        request_id: 'request-1',
        parsed_intent: { activity_type: 'discount' },
        options: [
          {
            option_id: 1,
            campaign_type: 'DISCOUNT',
            discount_amount: 20,
            min_purchase: 100,
            target_audience: '新客',
            duration_days: 7,
            budget: 10000,
            description: '低门槛拉新',
            confidence: 0.9,
          },
          {
            option_id: 2,
            campaign_type: 'CASH_REWARD',
            cash_reward: 10,
            target_audience: '新客',
            duration_days: 7,
            budget: 10000,
            description: '现金激励',
            confidence: 0.8,
          },
          {
            option_id: 3,
            campaign_type: 'COMBO',
            discount_amount: 30,
            min_purchase: 200,
            target_audience: '全部人群',
            duration_days: 14,
            budget: 15000,
            description: '套餐转化',
            confidence: 0.7,
          },
        ],
      })

      const result = await service.previewCampaign('merchant-1', {
        description: '中秋做一个拉新活动',
      })

      expect(result.source).toBe('ai')
      expect(result.requestId).toBe('request-1')
      expect(result.options).toHaveLength(3)
      expect(result.options[0]).toMatchObject({
        campaignType: CampaignType.DISCOUNT,
        thresholdAmount: 100,
        discountAmount: 20,
        couponValidityDays: 7,
        estimatedBudget: 10000,
      })
    })

    it('AI 不可用时仍返回三套可审阅的降级方案', async () => {
      aiBridge.configureCampaign.mockRejectedValueOnce(new Error('unavailable'))

      const result = await service.previewCampaign('merchant-1', {
        description: '做一个满100减20活动',
      })

      expect(result.source).toBe('fallback')
      expect(result.options).toHaveLength(3)
      expect(result.options[0].thresholdAmount).toBe(100)
    })
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

    it('支持 Markdown JSON 代码块解析', () => {
      const plan = (service as any).parseAIResponse(
        '```json\n{"plan_id":"plan-5","title":"代码块方案","campaign_type":"DISCOUNT"}\n```',
      )

      expect(plan.planId).toBe('plan-5')
      expect(plan.title).toBe('代码块方案')
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

    it('从套餐描述中识别套餐价、原价和活动日期', () => {
      const plan = (service as any).buildDefaultPlan(
        '我想做一个活动在中秋节，一个28元的套餐优惠活动，原价是56元，时间从9月13日到9月21日',
      )

      expect(plan).toMatchObject({
        campaignType: CampaignType.COMBO,
        offerPrice: 28,
        originalPrice: 56,
        discountAmount: 28,
        couponValidityDays: 9,
      })
      expect(new Date(plan.startAt).getMonth()).toBe(8)
      expect(new Date(plan.startAt).getDate()).toBe(13)
      expect(new Date(plan.endAt).getMonth()).toBe(8)
      expect(new Date(plan.endAt).getDate()).toBe(21)
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

    it('确认预览方案时创建草稿且不绕过测量预登记直接发布', async () => {
      campaignService.createCampaign.mockResolvedValueOnce({ campaignId: 'campaign-draft' })
      campaignService.createCoupon.mockResolvedValueOnce({
        couponId: 'coupon-draft',
        couponCode: 'CPN-DRAFT',
      })

      const result = await service.createCampaignFromDescription('merchant-1', {
        description: '做一个拉新活动',
        autoPublish: false,
        selectedOption: {
          optionId: 2,
          title: '均衡拉新方案',
          campaignType: 'discount',
          targetAudience: '新客',
          thresholdAmount: 100,
          discountAmount: 20,
          agentRewardAmount: 5,
          couponValidityDays: 7,
        },
      })

      expect(result.campaignStatus).toBe('draft')
      expect(campaignService.publishCampaign).not.toHaveBeenCalled()
      expect(campaignService.createCoupon).toHaveBeenCalledWith(
        'merchant-1',
        'campaign-draft',
        expect.objectContaining({ thresholdAmount: 100, discountAmount: 20 }),
      )
    })

    it('达人内容任务创建内容执行活动与活动转化优惠券', async () => {
      aiBridge.configureCampaign.mockResolvedValueOnce({
        options: [
          {
            option_id: 1,
            task_type: 'creator_content',
            campaign_type: 'DISCOUNT',
            target_audience: '本地美食兴趣人群',
            duration_days: 7,
            budget: 10000,
            content_brief: '发布门店探店图文并通过专属链接引导到店',
            content_types: ['graphic'],
            channels: ['xiaohongshu'],
            call_to_action: '点击专属链接到店',
            description: '内容引流',
            confidence: 0.9,
          },
        ],
      })
      campaignService.createCampaign.mockResolvedValueOnce({ campaignId: 'campaign-creator' })
      campaignService.createCoupon.mockResolvedValueOnce({
        couponId: 'coupon-creator',
        couponCode: 'CPN-CREATOR',
      })

      const result = await service.createCampaignFromDescription('merchant-1', {
        description: '请找达人发布探店图文，完成内容引流',
        autoPublish: false,
      })

      expect(result).toMatchObject({
        campaignId: 'campaign-creator',
        couponId: 'coupon-creator',
        taskType: 'creator_content',
        campaignStatus: 'draft',
      })
      expect(campaignService.createCampaign).toHaveBeenCalledWith(
        'merchant-1',
        expect.objectContaining({ purpose: 'creator_content' }),
      )
      expect(campaignService.createCoupon).toHaveBeenCalledWith(
        'merchant-1',
        'campaign-creator',
        expect.objectContaining({ agentRewardAmount: expect.any(Number) }),
      )
    })

    it('创建组合套餐时沿用套餐价和明确的活动时间', async () => {
      campaignService.createCampaign.mockResolvedValueOnce({ campaignId: 'campaign-combo' })
      campaignService.createCoupon.mockResolvedValueOnce({
        couponId: 'coupon-combo',
        couponCode: 'CPN-COMBO',
      })

      await service.createCampaignFromDescription('merchant-1', {
        description: '中秋 28 元套餐，原价 56 元，9 月 13 日至 9 月 21 日',
        autoPublish: false,
        selectedOption: {
          title: '中秋套餐优惠',
          campaignType: 'combo',
          offerPrice: 28,
          originalPrice: 56,
          startAt: '2026-09-13T00:00:00.000Z',
          endAt: '2026-09-21T23:59:59.999Z',
          agentRewardAmount: 5,
        },
      })

      expect(campaignService.createCampaign).toHaveBeenCalledWith(
        'merchant-1',
        expect.objectContaining({
          campaignType: CampaignType.COMBO,
          startAt: '2026-09-13T00:00:00.000Z',
          endAt: '2026-09-21T23:59:59.999Z',
        }),
      )
      expect(campaignService.createCoupon).toHaveBeenCalledWith(
        'merchant-1',
        'campaign-combo',
        expect.objectContaining({
          discountAmount: 28,
          validFrom: '2026-09-13T00:00:00.000Z',
          validUntil: '2026-09-21T23:59:59.999Z',
        }),
      )
    })
  })

  describe('generateMarketingProduct()', () => {
    it('将 AI 商品草稿转换为保存接口使用的 camelCase 结构', async () => {
      aiBridge.generateMarketingProduct.mockResolvedValueOnce({
        request_id: 'product-request-1',
        product: {
          product_name: '双人套餐券',
          category: '团购套餐券',
          description: '适合两人到店使用',
          skus: [
            {
              sku_name: '默认规格',
              sku_code: 'SET-2P',
              spec: '双人',
              price: 198,
              market_price: 298,
              attributes: { people: '2' },
            },
          ],
        },
        usage: { model: 'test' },
      })

      const result = await service.generateMarketingProduct('merchant-1', {
        prompt: '生成双人套餐券，售价198，原价298',
      })

      expect(result.requestId).toBe('product-request-1')
      expect(result.product).toMatchObject({ productName: '双人套餐券', category: '团购套餐券' })
      expect(result.product.skus[0]).toMatchObject({ skuName: '默认规格', price: 198 })
    })
  })
})
