import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { MerchantCrmService } from './merchant-crm.service'
import { MerchantCustomerLock } from '../customer/entities/merchant-customer-lock.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { RedemptionStatus } from '@ai-auto/shared'
import { NotFoundException } from '@nestjs/common'

describe('MerchantCrmService', () => {
  let service: MerchantCrmService
  let lockRepo: any
  let redemptionRepo: any

  const now = Date.now()
  const activeLock = {
    merchantId: 'merchant-a',
    customerId: 'customer-12345678',
    source: 'agent',
    isActive: true,
    acquiredAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
    lockExpiredAt: new Date(now + 20 * 24 * 60 * 60 * 1000),
    customer: { phone: '13812345678', nickname: '不应输出' },
  }

  beforeEach(async () => {
    lockRepo = { find: jest.fn() }
    redemptionRepo = { find: jest.fn() }
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantCrmService,
        { provide: getRepositoryToken(MerchantCustomerLock), useValue: lockRepo },
        { provide: getRepositoryToken(Redemption), useValue: redemptionRepo },
      ],
    }).compile()
    service = module.get(MerchantCrmService)
  })

  it('only returns unexpired merchant-scoped locks and merchant-local verified spend', async () => {
    lockRepo.find.mockResolvedValue([
      activeLock,
      { ...activeLock, customerId: 'expired-customer', lockExpiredAt: new Date(now - 1) },
    ])
    redemptionRepo.find.mockResolvedValue([
      {
        customerId: activeLock.customerId,
        status: RedemptionStatus.VERIFIED,
        transactionAmount: '128.50',
        createdAt: new Date(now - 1_000),
      },
      {
        customerId: activeLock.customerId,
        status: RedemptionStatus.VERIFIED,
        transactionAmount: '999.99',
        createdAt: new Date(now - 10 * 24 * 60 * 60 * 1000),
      },
    ])

    const result = await service.listCustomers('merchant-a', { page: 1, pageSize: 20 })

    expect(lockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ merchantId: 'merchant-a', isActive: true }),
      }),
    )
    expect(result.items).toEqual([
      expect.objectContaining({
        customerReference: 'CUST-CUSTOMER',
        phone: '138****5678',
        redemptionCount: 1,
        totalSpend: 128.5,
      }),
    ])
  })

  it('exports a masked, reduced customer projection rather than raw profile data', async () => {
    lockRepo.find.mockResolvedValue([activeLock])
    redemptionRepo.find.mockResolvedValue([])

    const file = await service.exportCustomers('merchant-a')

    expect(file.content).toContain('138****5678')
    expect(file.content).not.toContain('13812345678')
    expect(file.content).not.toContain('不应输出')
  })

  it('resolves a customer reference only inside the requested merchant scope', async () => {
    lockRepo.find.mockImplementation(({ where }: { where: { merchantId: string } }) =>
      Promise.resolve(where.merchantId === 'merchant-a' ? [activeLock] : []),
    )
    redemptionRepo.find.mockResolvedValue([])

    await expect(service.getCustomerDetail('merchant-a', 'CUST-CUSTOMER')).resolves.toEqual(
      expect.objectContaining({ phone: '138****5678' }),
    )
    await expect(service.getCustomerDetail('merchant-b', 'CUST-CUSTOMER')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})
