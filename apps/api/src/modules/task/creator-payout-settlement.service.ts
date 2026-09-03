import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, LessThanOrEqual, Repository } from 'typeorm'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { CreatorTaskPayout } from './entities/creator-task-payout.entity'

@Injectable()
export class CreatorPayoutSettlementService {
  constructor(@InjectRepository(CreatorTaskPayout) private readonly payouts: Repository<CreatorTaskPayout>, private readonly dataSource: DataSource) {}
  @Cron('0 15 0 * * *', { name: 'settle-creator-task-payouts', timeZone: 'Asia/Shanghai' })
  async settleDuePayouts() {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const due = await this.payouts.find({ where: { status: 'verified', settleAt: LessThanOrEqual(today) } })
    await this.dataSource.transaction(async (manager) => {
      for (const payout of due) {
        const amount = Number(payout.verifiedAmount ?? 0)
        const wallet = await manager.findOne(AgentWallet, { where: { agentId: payout.creatorId } })
        if (!wallet) continue
        wallet.pendingSettlementBalance = Math.max(0, Number(wallet.pendingSettlementBalance) - amount)
        wallet.settledBalance = Number(wallet.settledBalance) + amount
        wallet.totalSettled = Number(wallet.totalSettled) + amount
        payout.status = 'settled'; payout.settledAt = new Date()
        await manager.save(wallet); await manager.save(payout)
      }
    })
    return { processed: due.length, totalAmount: due.reduce((sum, item) => sum + Number(item.verifiedAmount ?? 0), 0) }
  }
}
