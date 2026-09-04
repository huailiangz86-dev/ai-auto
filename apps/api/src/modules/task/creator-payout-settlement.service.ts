import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, LessThanOrEqual, Repository } from 'typeorm'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { CreatorTaskPayout } from './entities/creator-task-payout.entity'

@Injectable()
export class CreatorPayoutSettlementService {
  constructor(
    @InjectRepository(CreatorTaskPayout)
    private readonly payouts: Repository<CreatorTaskPayout>,
    private readonly dataSource: DataSource,
  ) {}

  @Cron('0 15 0 * * *', { name: 'settle-creator-task-payouts', timeZone: 'Asia/Shanghai' })
  async settleDuePayouts() {
    const today = this.shanghaiDate(new Date())
    if (!today) return { processed: 0, totalAmount: 0 }
    const todayDate = new Date(`${today}T00:00:00.000Z`)
    const candidates = await this.payouts.find({
      where: {
        status: 'verified',
        settleAt: LessThanOrEqual(todayDate),
      },
      order: { id: 'ASC' },
    })
    let processed = 0
    let totalAmount = 0
    await this.dataSource.transaction(async (manager) => {
      for (const candidate of candidates) {
        const payout = await manager.findOne(CreatorTaskPayout, {
          where: { id: candidate.id },
          lock: { mode: 'pessimistic_write' },
        })
        const settleAt = this.shanghaiDate(payout?.settleAt)
        if (!payout || payout.status !== 'verified' || !settleAt || settleAt > today) continue
        const wallet = await manager.findOne(AgentWallet, {
          where: { agentId: payout.creatorId },
          lock: { mode: 'pessimistic_write' },
        })
        if (!wallet) continue
        const amount = Number(payout.verifiedAmount ?? 0)
        const pending = Number(wallet.pendingSettlementBalance)
        const settled = Number(wallet.settledBalance)
        const totalSettled = Number(wallet.totalSettled)
        if (
          ![amount, pending, settled, totalSettled].every(Number.isFinite) ||
          amount < 0 ||
          pending < amount
        )
          continue
        wallet.pendingSettlementBalance = this.money(pending - amount)
        wallet.settledBalance = this.money(settled + amount)
        wallet.totalSettled = this.money(totalSettled + amount)
        wallet.lastSettlementAt = new Date()
        payout.status = 'settled'
        payout.settledAt = new Date()
        await manager.save(wallet)
        await manager.save(payout)
        processed++
        totalAmount = this.money(totalAmount + amount)
      }
    })
    return { processed, totalAmount }
  }

  private shanghaiDate(value: unknown) {
    if (!value) return null
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    const date = value instanceof Date ? value : new Date(String(value))
    if (Number.isNaN(date.getTime())) return null
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .reduce<Record<string, string>>((result, part) => {
        if (part.type !== 'literal') result[part.type] = part.value
        return result
      }, {})
    return `${parts.year}-${parts.month}-${parts.day}`
  }

  private money(value: number) {
    return Math.round(value * 100) / 100
  }
}
