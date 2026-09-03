import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import * as bcrypt from 'bcrypt'

import { CustomerShareService } from './customer-share.service'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { CustomerAttribution } from './entities/customer-attribution.entity'
import { CustomerCoupon } from './entities/customer-coupon.entity'
import { Customer } from './entities/customer.entity'
import { GamificationService } from '../gamification/gamification.service'

jest.mock('bcrypt', () => ({ hash: jest.fn() }))

function createRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  }
}

describe('CustomerShareService', () => {
  let service: CustomerShareService
  let customerRepo: ReturnType<typeof createRepo>
  let customerCouponRepo: ReturnType<typeof createRepo>
  let attributionRepo: ReturnType<typeof createRepo>
  let agentRepo: ReturnType<typeof createRepo>

  beforeEach(async () => {
    customerRepo = createRepo()
    customerCouponRepo = createRepo()
    attributionRepo = createRepo()
    agentRepo = createRepo()

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerShareService,
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(CustomerCoupon), useValue: customerCouponRepo },
        { provide: getRepositoryToken(CustomerAttribution), useValue: attributionRepo },
        { provide: getRepositoryToken(SharingAgent), useValue: agentRepo },
        {
          provide: GamificationService,
          useValue: { awardForShare: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile()
    service = module.get(CustomerShareService)
  })

  it('首次分享会自动创建分享员并返回带 agentId 的落地路径', async () => {
    const customerCoupon = { id: 'cc-1', customerId: 'customer-1', couponId: 'coupon-1' }
    customerCouponRepo.findOne.mockResolvedValue(customerCoupon)
    customerRepo.findOne.mockResolvedValue({ id: 'customer-1', phone: '13800138000' })
    agentRepo.findOne.mockResolvedValue(null)
    ;(bcrypt.hash as jest.Mock).mockResolvedValue('random-password-hash')
    agentRepo.create.mockReturnValue({ id: 'agent-1', phone: '13800138000' })
    agentRepo.save.mockResolvedValue({ id: 'agent-1', phone: '13800138000' })

    await expect(service.prepareShare('customer-1', 'cc-1')).resolves.toEqual({
      agentId: 'agent-1',
      customerCouponId: 'cc-1',
      sharePath: '/pages/coupon-detail/index?couponId=coupon-1&agentId=agent-1',
      isNewAgent: true,
    })
  })

  it('仅在微信分享成功后递增分享次数', async () => {
    const customerCoupon: {
      id: string
      customerId: string
      shareCount: number
      sharePlatform?: string
    } = { id: 'cc-1', customerId: 'customer-1', shareCount: 2 }
    customerCouponRepo.findOne.mockResolvedValue(customerCoupon)
    customerCouponRepo.save.mockResolvedValue(customerCoupon)

    await expect(service.recordShare('customer-1', 'cc-1', 'wechat_moment')).resolves.toEqual({
      shareCount: 3,
      challengeUpdates: [],
    })
    expect(customerCoupon.sharePlatform).toBe('wechat_moment')
    expect(customerCouponRepo.save).toHaveBeenCalledWith(customerCoupon)
  })

  it('汇总当前客户分享员的推广效果', async () => {
    customerRepo.findOne.mockResolvedValue({ id: 'customer-1', phone: '13800138000' })
    agentRepo.findOne.mockResolvedValue({ id: 'agent-1', totalEarned: 18.5 })
    attributionRepo.find.mockResolvedValue([
      { totalRedemptions: 2, totalCommission: 6.5 },
      { totalRedemptions: 1, totalCommission: 3 },
    ])
    customerCouponRepo.find.mockResolvedValue([{ shareCount: 2 }, { shareCount: 3 }])

    await expect(service.getPromotionPerformance('customer-1')).resolves.toMatchObject({
      isAgent: true,
      agentId: 'agent-1',
      shareCount: 5,
      invitedCustomers: 2,
      redemptions: 3,
      estimatedCommission: 9.5,
      totalEarned: 18.5,
    })
  })
})
