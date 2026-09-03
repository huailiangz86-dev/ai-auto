// ============================================================
// AI auto - Settlement & Withdrawal Service
// T+3 settlement batch + withdrawal requests
// ============================================================

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource, LessThanOrEqual, MoreThanOrEqual } from 'typeorm'
import { Cron } from '@nestjs/schedule'

import { Withdrawal } from './entities/withdrawal.entity'
import { Commission } from './entities/commission.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { WithdrawalStatus } from '@ai-auto/shared'

import { CreateWithdrawalDto, ListWithdrawalsDto } from './dto/withdrawal.dto'

// Minimum withdrawal amount (¥10)
const MIN_WITHDRAWAL_AMOUNT = 10
// Maximum retry attempts
const MAX_RETRY_COUNT = 3

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name)

  constructor(
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepo: Repository<Withdrawal>,
    @InjectRepository(Commission)
    private readonly commissionRepo: Repository<Commission>,
    @InjectRepository(AgentWallet)
    private readonly walletRepo: Repository<AgentWallet>,
    private readonly dataSource: DataSource,
  ) {}

  // ========================
  // T+3 结算批处理
  // ========================

  /**
   * T+3 结算批处理（每日凌晨调用）
   * 将所有已到期（settleAt <= 今天）的 pending 佣金从待结算移到可提现
   * 同时更新钱包余额
   */
  async settleOverdueCommissions(): Promise<{ processed: number; totalAmount: number }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 查找所有已到结算日且状态为 pending 的佣金记录
    const commissions = await this.commissionRepo.find({
      where: {
        status: 'pending',
        settleAt: LessThanOrEqual(today),
      },
    })

    if (commissions.length === 0) {
      this.logger.log({ event: 'settlement_no_pending', date: today })
      return { processed: 0, totalAmount: 0 }
    }

    // 按钱包分组聚合
    const walletAmounts = new Map<string, number>()
    for (const c of commissions) {
      const current = walletAmounts.get(c.walletId) ?? 0
      walletAmounts.set(c.walletId, current + Number(c.agentFinalPayout))
    }

    let totalAmount = 0
    const walletIds = Array.from(walletAmounts.keys())

    // 批量更新：佣金状态 + 钱包余额
    await this.dataSource.transaction(async (manager) => {
      // 更新佣金状态为 settled
      await manager
        .createQueryBuilder()
        .update(Commission)
        .set({
          status: 'settled',
          settledAt: new Date(),
        })
        .where('id IN (:...ids)', { ids: commissions.map((c) => c.id) })
        .execute()

      // 更新各钱包余额
      for (const walletId of walletIds) {
        const amount = walletAmounts.get(walletId)
        const wallet = await manager.findOne(AgentWallet, { where: { id: walletId } })
        if (wallet) {
          const newPending = Number(wallet.pendingSettlementBalance) - amount
          const newSettled = Number(wallet.settledBalance) + amount
          await manager.update(AgentWallet, walletId, {
            pendingSettlementBalance: Math.max(0, newPending),
            settledBalance: newSettled,
            lastSettlementAt: new Date(),
          })
          totalAmount += amount
        }
      }
    })

    this.logger.log({
      event: 'settlement_completed',
      processed: commissions.length,
      totalAmount,
    })

    return { processed: commissions.length, totalAmount }
  }

  @Cron('0 10 0 * * *', { name: 'settle-overdue-commissions', timeZone: 'Asia/Shanghai' })
  async runDailySettlement(): Promise<void> {
    await this.settleOverdueCommissions()
  }
  // ========================
  // 提现申请
  // ========================

  /**
   * 申请提现
   * 幂等：同一 idempotencyKey 只处理一次
   */
  async createWithdrawal(
    agentId: string,
    dto: CreateWithdrawalDto,
    idempotencyKey?: string,
  ): Promise<{ withdrawalId: string; status: string }> {
    const key = idempotencyKey ?? `${agentId}-${Date.now()}`

    // 幂等检查
    const existing = await this.withdrawalRepo.findOne({ where: { idempotencyKey: key } })
    if (existing) {
      return { withdrawalId: existing.id, status: existing.status }
    }

    // 获取钱包
    const wallet = await this.walletRepo.findOne({ where: { agentId } })
    if (!wallet) {
      throw new NotFoundException({ code: 7001, message: '钱包不存在' })
    }

    // 校验余额
    const available = Number(wallet.settledBalance)
    if (available < dto.amount) {
      throw new BadRequestException({
        code: 7002,
        message: `可提现余额不足（${available.toFixed(2)}元），最低提现 ${MIN_WITHDRAWAL_AMOUNT} 元`,
      })
    }

    // 校验最低金额
    if (dto.amount < MIN_WITHDRAWAL_AMOUNT) {
      throw new BadRequestException({
        code: 7003,
        message: `最低提现金额为 ¥${MIN_WITHDRAWAL_AMOUNT}`,
      })
    }

    // 计算实际到账金额（无手续费）
    const actualAmount = dto.amount
    const platformFee = 0

    const balanceBefore = available
    const balanceAfter = available - dto.amount

    // 冻结金额 + 创建提现记录
    await this.dataSource.transaction(async (manager) => {
      // 冻结可提现余额
      await manager.update(AgentWallet, wallet.id, {
        settledBalance: balanceAfter,
        frozenBalance: Number(wallet.frozenBalance) + dto.amount,
      })

      // 创建提现记录
      const withdrawal = manager.create(Withdrawal, {
        idempotencyKey: key,
        walletId: wallet.id,
        agentId,
        amount: dto.amount,
        platformFee,
        actualAmount,
        method: dto.method,
        accountNo: dto.accountNo,
        accountName: dto.accountName,
        accountIdentifier: dto.accountIdentifier ?? null,
        status: WithdrawalStatus.PENDING,
        walletBalanceBefore: balanceBefore,
        walletBalanceAfter: balanceAfter,
      })
      await manager.save(withdrawal)

      this.logger.log({
        event: 'withdrawal_requested',
        withdrawalId: (withdrawal as any).id ?? key,
        agentId,
        amount: dto.amount,
        method: dto.method,
      })
    })

    // 查询刚创建的记录
    const saved = await this.withdrawalRepo.findOne({ where: { idempotencyKey: key } })

    return { withdrawalId: saved?.id ?? key, status: WithdrawalStatus.PENDING }
  }

  /**
   * 查询提现记录
   */
  async listWithdrawals(agentId: string, query: ListWithdrawalsDto) {
    const where: any = { agentId }
    if (query.status) {
      where.status = query.status
    }

    const [withdrawals, total] = await this.withdrawalRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: ((query.page ?? 1) - 1) * (query.pageSize ?? 20),
      take: query.pageSize ?? 20,
    })

    return {
      items: withdrawals.map((w) => ({
        withdrawalId: w.id,
        amount: Number(w.amount),
        actualAmount: Number(w.actualAmount),
        method: w.method,
        accountNo: this.maskAccountNo(w.accountNo),
        status: w.status,
        processStartedAt: w.processStartedAt,
        processCompletedAt: w.processCompletedAt,
        processError: w.processError,
        retryCount: w.retryCount,
        paymentTransactionId: w.paymentTransactionId,
        createdAt: w.createdAt,
      })),
      pagination: {
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 20,
        total,
        totalPages: Math.ceil(total / (query.pageSize ?? 20)),
      },
    }
  }

  /**
   * 查询提现详情
   */
  async getWithdrawal(agentId: string, withdrawalId: string) {
    const w = await this.withdrawalRepo.findOne({
      where: { id: withdrawalId, agentId },
    })
    if (!w) {
      throw new NotFoundException({ code: 7004, message: '提现记录不存在' })
    }

    return {
      withdrawalId: w.id,
      amount: Number(w.amount),
      platformFee: Number(w.platformFee),
      actualAmount: Number(w.actualAmount),
      method: w.method,
      accountNo: this.maskAccountNo(w.accountNo),
      accountName: w.accountName,
      status: w.status,
      processStartedAt: w.processStartedAt,
      processCompletedAt: w.processCompletedAt,
      processError: w.processError,
      retryCount: w.retryCount,
      paymentTransactionId: w.paymentTransactionId,
      createdAt: w.createdAt,
    }
  }

  /**
   * 私有工具：账号脱敏
   */
  private maskAccountNo(accountNo: string): string {
    if (!accountNo || accountNo.length < 4) return accountNo
    return accountNo.slice(0, 3) + '****' + accountNo.slice(-4)
  }
}
