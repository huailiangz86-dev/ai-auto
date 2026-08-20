// ============================================================
// AI auto - Merchant Wallet Service
// Commission budget: topup / freeze / unfreeze / spend
// Three-state balance: total - frozen = available
// ============================================================

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm'

import { CommissionBudget } from './entities/commission-budget.entity'
import { BudgetTransaction } from './entities/commission-budget.entity'
import { PlatformRevenue } from './entities/platform-revenue.entity'
import { Merchant } from './entities/merchant.entity'
import { WalletTransactionType } from '@ai-auto/shared'

import {
  TopupBudgetDto,
  FreezeBudgetDto,
  UnfreezeBudgetDto,
  ListTransactionsDto,
} from './dto/wallet.dto'

@Injectable()
export class MerchantWalletService {
  private readonly logger = new Logger(MerchantWalletService.name)

  constructor(
    @InjectRepository(CommissionBudget)
    private readonly budgetRepo: Repository<CommissionBudget>,
    @InjectRepository(BudgetTransaction)
    private readonly txRepo: Repository<BudgetTransaction>,
    @InjectRepository(PlatformRevenue)
    private readonly revenueRepo: Repository<PlatformRevenue>,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    private readonly dataSource: DataSource,
  ) {}

  // ========================
  // 钱包查询
  // ========================

  /**
   * 获取商家钱包（不存在则自动创建）
   */
  async getWallet(merchantId: string) {
    let budget = await this.budgetRepo.findOne({ where: { merchantId } })
    if (!budget) {
      budget = this.budgetRepo.create({
        merchantId,
        totalBalance: 0,
        availableBalance: 0,
        frozenBalance: 0,
        totalSpent: 0,
        totalTopup: 0,
        status: true,
        lowBalanceThreshold: 100,
      })
      budget = await this.budgetRepo.save(budget)
    }

    return {
      budgetId: budget.id,
      merchantId: budget.merchantId,
      totalBalance: Number(budget.totalBalance),
      availableBalance: Number(budget.availableBalance),
      frozenBalance: Number(budget.frozenBalance),
      totalSpent: Number(budget.totalSpent),
      totalTopup: Number(budget.totalTopup),
      lowBalanceThreshold: Number(budget.lowBalanceThreshold),
      isLowBalance: Number(budget.availableBalance) <= Number(budget.lowBalanceThreshold),
      status: budget.status,
    }
  }

  /**
   * 检查钱包是否足以支持活动预算
   */
  async checkBudget(merchantId: string, requiredAmount: number): Promise<boolean> {
    const wallet = await this.getWallet(merchantId)
    return wallet.availableBalance >= requiredAmount
  }

  // ========================
  // 充值
  // ========================

  /**
   * 充值佣金预算
   * 幂等：同一 paymentTransactionId 不重复充值
   */
  async topupBudget(
    merchantId: string,
    dto: TopupBudgetDto,
  ): Promise<{ budgetId: string; transactionId: string }> {
    const { amount, method, paymentTransactionId, description } = dto

    // 幂等检查
    if (paymentTransactionId) {
      const existing = await this.txRepo.findOne({
        where: { id: paymentTransactionId },
      })
      if (existing) {
        const budget = await this.budgetRepo.findOne({ where: { merchantId } })
        return { budgetId: budget?.id ?? '', transactionId: existing.id }
      }
    }

    // 获取或创建钱包
    let budget = await this.budgetRepo.findOne({ where: { merchantId } })
    if (!budget) {
      budget = this.budgetRepo.create({
        merchantId,
        totalBalance: 0,
        availableBalance: 0,
        frozenBalance: 0,
        totalSpent: 0,
        totalTopup: 0,
        status: true,
        lowBalanceThreshold: 100,
      })
      budget = await this.budgetRepo.save(budget)
    }

    const balanceBefore = Number(budget.totalBalance)
    const balanceAfter = this.roundMoney(balanceBefore + amount)

    // 原子充值
    await this.dataSource.transaction(async (manager) => {
      await manager.update(CommissionBudget, budget.id, {
        totalBalance: balanceAfter,
        availableBalance: this.roundMoney(Number(budget.availableBalance) + amount),
        totalTopup: this.roundMoney(Number(budget.totalTopup) + amount),
      })

      const tx = manager.create(BudgetTransaction, {
        id: paymentTransactionId ?? undefined,
        budgetId: budget.id,
        type: WalletTransactionType.RECHARGE,
        amount,
        balanceBefore,
        balanceAfter,
        description: description ?? `充值 ${amount} 元（${method}）`,
      })
      await manager.save(tx)
    })

    const savedTx = await this.txRepo.findOne({
      where: paymentTransactionId ? { id: paymentTransactionId } : { id: undefined },
    })

    this.logger.log({
      event: 'budget_topup',
      merchantId,
      amount,
      method,
      transactionId: paymentTransactionId ?? savedTx?.id,
    })

    return { budgetId: budget.id, transactionId: savedTx?.id ?? '' }
  }

  // ========================
  // 冻结/解冻/扣减
  // ========================

  /**
   * 发布活动前冻结预算
   */
  async freezeBudget(
    merchantId: string,
    dto: FreezeBudgetDto,
  ): Promise<{ transactionId: string; frozenBalance: number }> {
    const { amount, campaignId, description } = dto

    const budget = await this.budgetRepo.findOne({ where: { merchantId } })
    if (!budget) {
      throw new NotFoundException({ code: 8001, message: '钱包不存在' })
    }

    const available = Number(budget.availableBalance)
    if (available < amount) {
      throw new BadRequestException({
        code: 8002,
        message: `可用余额不足（${available.toFixed(2)}元），需冻结 ${amount.toFixed(2)}元`,
      })
    }

    const balanceBefore = Number(budget.totalBalance)
    const frozenBefore = Number(budget.frozenBalance)
    const availableBefore = Number(budget.availableBalance)
    const frozenAfter = this.roundMoney(frozenBefore + amount)
    const availableAfter = this.roundMoney(availableBefore - amount)

    // 原子冻结
    const tx = await this.dataSource.transaction(async (manager) => {
      await manager.update(CommissionBudget, budget.id, {
        frozenBalance: frozenAfter,
        availableBalance: availableAfter,
      })

      const record = manager.create(BudgetTransaction, {
        budgetId: budget.id,
        type: WalletTransactionType.FREEZE,
        amount,
        balanceBefore,
        balanceAfter: balanceBefore,
        description: description ?? `冻结活动预算（活动ID: ${campaignId}）`,
        campaignId,
      })
      return manager.save(record)
    })

    this.logger.log({
      event: 'budget_freeze',
      merchantId,
      campaignId,
      amount,
    })

    return { transactionId: (tx as any).id, frozenBalance: frozenAfter }
  }

  /**
   * 解冻预算（活动取消时）或扣减（实际佣金）
   * @param amount 正数=解冻（加回可用），负数=扣减（减少总额）
   */
  async unfreezeBudget(
    merchantId: string,
    campaignId: string,
    amount: number,
    isSpend = false,
    description?: string,
  ): Promise<{ transactionId: string }> {
    const budget = await this.budgetRepo.findOne({ where: { merchantId } })
    if (!budget) {
      throw new NotFoundException({ code: 8001, message: '钱包不存在' })
    }

    const frozenBefore = Number(budget.frozenBalance)
    const totalBefore = Number(budget.totalBalance)

    let type: WalletTransactionType
    let frozenAfter: number
    let totalAfter: number
    let availableAfter: number

    if (isSpend) {
      // 扣减：从冻结中扣实际佣金
      type = WalletTransactionType.DEDUCT
      const spendAmount = Math.min(Math.abs(amount), frozenBefore)
      frozenAfter = this.roundMoney(frozenBefore - spendAmount)
      totalAfter = this.roundMoney(totalBefore - spendAmount)
      availableAfter = Number(budget.availableBalance) // 不变
    } else {
      // 解冻：返还冻结金额
      type = WalletTransactionType.UNFREEZE
      const unfreezeAmount = Math.min(Math.abs(amount), frozenBefore)
      frozenAfter = this.roundMoney(frozenBefore - unfreezeAmount)
      totalAfter = totalBefore // 不变
      availableAfter = this.roundMoney(Number(budget.availableBalance) + unfreezeAmount)
    }

    const tx = await this.dataSource.transaction(async (manager) => {
      await manager.update(CommissionBudget, budget.id, {
        frozenBalance: frozenAfter,
        totalBalance: totalAfter,
        availableBalance: availableAfter,
        totalSpent: isSpend
          ? this.roundMoney(Number(budget.totalSpent) + Math.abs(amount))
          : Number(budget.totalSpent),
      })

      const record = manager.create(BudgetTransaction, {
        budgetId: budget.id,
        type,
        amount: Math.abs(amount),
        balanceBefore: totalBefore,
        balanceAfter: totalAfter,
        description:
          description ??
          (isSpend ? `核销佣金（活动ID: ${campaignId}）` : `解冻预算（活动ID: ${campaignId}）`),
        campaignId,
      })
      return manager.save(record)
    })

    this.logger.log({
      event: isSpend ? 'budget_spend' : 'budget_unfreeze',
      merchantId,
      campaignId,
      amount,
      type,
    })

    return { transactionId: (tx as any).id }
  }

  // ========================
  // 流水查询
  // ========================

  /**
   * 查询钱包流水
   */
  async listTransactions(merchantId: string, query: ListTransactionsDto) {
    const budget = await this.budgetRepo.findOne({ where: { merchantId } })
    if (!budget) {
      return { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }
    }

    const where: any = { budgetId: budget.id }
    if (query.type) {
      where.type = query.type
    }
    if (query.campaignId) {
      where.campaignId = query.campaignId
    }
    if (query.startDate && query.endDate) {
      where.createdAt = Between(new Date(query.startDate), new Date(query.endDate))
    }

    const [txs, total] = await this.txRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
      take: query.pageSize ?? 20,
    })

    return {
      items: txs.map((t) => ({
        transactionId: t.id,
        type: t.type,
        amount: Number(t.amount),
        balanceBefore: Number(t.balanceBefore),
        balanceAfter: Number(t.balanceAfter),
        campaignId: t.campaignId,
        description: t.description,
        createdAt: t.createdAt,
      })),
      pagination: {
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        total,
        totalPages: Math.ceil(total / (query.pageSize ?? 20)),
      },
    }
  }

  // ========================
  // 统计
  // ========================

  /**
   * 获取商家收入统计（平台侧，佣金20%）
   */
  async getRevenueStats(merchantId: string, startDate?: string, endDate?: string) {
    const where: any = { merchantId }
    if (startDate && endDate) {
      where.revenueDate = Between(new Date(startDate), new Date(endDate))
    } else if (startDate) {
      where.revenueDate = MoreThanOrEqual(new Date(startDate))
    } else if (endDate) {
      where.revenueDate = LessThanOrEqual(new Date(endDate))
    }

    const revenues = await this.revenueRepo.find({ where })

    const totalCommission = revenues
      .filter((r) => r.revenueType === 'commission_royalty')
      .reduce((sum, r) => sum + Number(r.amount), 0)

    const totalSubscription = revenues
      .filter((r) => r.revenueType === 'subscription')
      .reduce((sum, r) => sum + Number(r.amount), 0)

    return {
      merchantId,
      period: { startDate: startDate ?? null, endDate: endDate ?? null },
      totalCommissionRoyalty: this.roundMoney(totalCommission),
      totalSubscription: this.roundMoney(totalSubscription),
      totalRevenue: this.roundMoney(totalCommission + totalSubscription),
      transactionCount: revenues.length,
    }
  }

  // ========================
  // 私有工具
  // ========================

  private roundMoney(amount: number): number {
    return Math.round(amount * 100) / 100
  }
}
