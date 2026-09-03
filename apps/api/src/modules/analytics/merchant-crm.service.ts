// ============================================================
// Merchant CRM service (STORY-AI-040)
// ============================================================

import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, MoreThan, Repository } from 'typeorm'
import { RedemptionStatus } from '@ai-auto/shared'

import { MerchantCustomerLock } from '../customer/entities/merchant-customer-lock.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { ListMerchantCrmCustomersDto } from './dto/merchant-crm.dto'

export interface CrmCustomer {
  customerReference: string
  phone: string | null
  firstAcquiredAt: Date
  redemptionCount: number
  totalSpend: number
  lockExpiresAt: Date
  acquisitionSource: string
}

@Injectable()
export class MerchantCrmService {
  constructor(
    @InjectRepository(MerchantCustomerLock)
    private readonly lockRepo: Repository<MerchantCustomerLock>,
    @InjectRepository(Redemption)
    private readonly redemptionRepo: Repository<Redemption>,
  ) {}

  async listCustomers(merchantId: string, query: ListMerchantCrmCustomersDto) {
    const page = Math.max(1, Number(query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20))
    const customers = await this.getLockedCustomers(merchantId)
    const total = customers.length

    return {
      items: customers.slice((page - 1) * pageSize, page * pageSize),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }

  /**
   * Resolves a list-issued CRM reference only within the requesting merchant's
   * active locks. A reference from another merchant therefore behaves as not
   * found instead of revealing whether that customer exists on the platform.
   */
  async getCustomerDetail(merchantId: string, customerReference: string): Promise<CrmCustomer> {
    const customer = (await this.getLockedCustomers(merchantId)).find(
      (item) => item.customerReference === customerReference,
    )
    if (!customer) {
      throw new NotFoundException('CRM customer not found')
    }
    return customer
  }

  /** CSV deliberately contains only the CRM projection, never raw profile data. */
  async exportCustomers(merchantId: string) {
    const customers = await this.getLockedCustomers(merchantId)
    const header = [
      '客户标识',
      '脱敏手机号',
      '首次获取日期',
      '核销次数',
      '累计消费',
      '锁客到期日',
      '获客来源',
    ]
    const rows = customers.map((customer) => [
      customer.customerReference,
      customer.phone ?? '',
      customer.firstAcquiredAt.toISOString(),
      customer.redemptionCount,
      customer.totalSpend.toFixed(2),
      customer.lockExpiresAt.toISOString(),
      customer.acquisitionSource === 'agent' ? '分享员' : '平台',
    ])
    const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`

    return {
      filename: `merchant-crm-customers-${new Date().toISOString().slice(0, 10)}.csv`,
      content: `\uFEFF${[header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')}`,
    }
  }

  private async getLockedCustomers(merchantId: string): Promise<CrmCustomer[]> {
    const now = new Date()
    // Merchant ID and an unexpired lock are both mandatory predicates. This is
    // the isolation boundary; a global Customer record is never queried first.
    const locks = (
      await this.lockRepo.find({
        where: { merchantId, isActive: true, lockExpiredAt: MoreThan(now) },
        relations: ['customer'],
        order: { acquiredAt: 'DESC' },
      })
    ).filter((lock) => lock.lockExpiredAt > now)

    if (locks.length === 0) return []

    const locksByCustomerId = new Map(locks.map((lock) => [lock.customerId, lock]))
    const redemptions = await this.redemptionRepo.find({
      where: {
        merchantId,
        customerId: In(locks.map((lock) => lock.customerId)),
        status: In([RedemptionStatus.VERIFIED, RedemptionStatus.SETTLED]),
      },
    })

    const totals = new Map<string, { redemptionCount: number; totalSpend: number }>()
    for (const redemption of redemptions) {
      const lock = locksByCustomerId.get(redemption.customerId)
      if (
        !lock ||
        redemption.createdAt < lock.acquiredAt ||
        redemption.createdAt >= lock.lockExpiredAt
      ) {
        continue
      }
      const current = totals.get(redemption.customerId) ?? { redemptionCount: 0, totalSpend: 0 }
      current.redemptionCount += 1
      current.totalSpend += Number(redemption.transactionAmount)
      totals.set(redemption.customerId, current)
    }

    return locks.map((lock) => {
      const total = totals.get(lock.customerId) ?? { redemptionCount: 0, totalSpend: 0 }
      return {
        // Stable only inside this CRM response; it does not disclose the platform UUID.
        customerReference: `CUST-${lock.customerId.slice(0, 8).toUpperCase()}`,
        phone: lock.customer?.phone ? this.maskPhone(lock.customer.phone) : null,
        firstAcquiredAt: lock.acquiredAt,
        redemptionCount: total.redemptionCount,
        totalSpend: this.roundMoney(total.totalSpend),
        lockExpiresAt: lock.lockExpiredAt,
        acquisitionSource: lock.source,
      }
    })
  }

  private maskPhone(phone: string): string {
    if (phone.length < 7) return '****'
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`
  }

  private roundMoney(amount: number): number {
    return Math.round(amount * 100) / 100
  }
}
