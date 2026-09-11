import { Injectable } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, LessThanOrEqual, Repository } from 'typeorm'
import { UserRole } from '@ai-auto/shared'
import { FinancialLedgerEntry } from '../admin/entities/financial-ledger-entry.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { Notification } from '../notification/entities/notification.entity'
import { CreatorTaskAppeal, CreatorTaskPayout } from './entities/creator-task-payout.entity'

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
        const grossAmount = Number(payout.verifiedAmount ?? 0)
        const pending = Number(wallet.pendingSettlementBalance)
        const settled = Number(wallet.settledBalance)
        const totalSettled = Number(wallet.totalSettled)
        const recoveryReceivable = Number(wallet.recoveryReceivableBalance ?? 0)
        const totalRecovered = Number(wallet.totalRecovered ?? 0)
        if (
          ![grossAmount, pending, settled, totalSettled, recoveryReceivable, totalRecovered].every(
            Number.isFinite,
          ) ||
          grossAmount < 0 ||
          recoveryReceivable < 0 ||
          pending < grossAmount
        )
          continue
        // Allocate each withheld yuan to one adjudication. This is deliberately
        // not an opaque wallet-only deduction: a payout can clear several
        // recoveries, and an appeal can be cleared over several payouts.
        const recoveryOffset = await this.applyRecoveryOffsets(manager, payout, recoveryReceivable)
        const payableAmount = this.money(grossAmount - recoveryOffset)
        wallet.pendingSettlementBalance = this.money(pending - grossAmount)
        wallet.settledBalance = this.money(settled + payableAmount)
        wallet.totalSettled = this.money(totalSettled + payableAmount)
        wallet.recoveryReceivableBalance = this.money(recoveryReceivable - recoveryOffset)
        wallet.totalRecovered = this.money(totalRecovered + recoveryOffset)
        wallet.lastSettlementAt = new Date()
        payout.status = 'settled'
        payout.settledAt = new Date()
        payout.recoveryOffsetAmount = recoveryOffset
        await manager.save(wallet)
        await manager.save(payout)
        processed++
        totalAmount = this.money(totalAmount + payableAmount)
      }
    })
    return { processed, totalAmount }
  }

  private async applyRecoveryOffsets(
    manager: any,
    payout: CreatorTaskPayout,
    recoveryReceivable: number,
  ) {
    if (recoveryReceivable <= 0) return 0
    const recoveries = await manager.find(CreatorTaskAppeal, {
      where: {
        creatorId: payout.creatorId,
        status: 'accepted',
        adjudicationDecision: 'reverse_settlement',
      },
      order: { resolvedAt: 'ASC', id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    })
    let remainingPayout = this.money(Number(payout.verifiedAmount ?? 0))
    let offsetTotal = 0
    for (const appeal of recoveries) {
      if (remainingPayout <= 0) break
      const due = this.money(Number(appeal.recoveryAmount ?? 0) - Number(appeal.recoveryRecoveredAmount ?? 0))
      if (due <= 0) continue
      const applied = this.money(Math.min(remainingPayout, due, recoveryReceivable - offsetTotal))
      if (applied <= 0) continue
      const recoveredBefore = this.money(Number(appeal.recoveryRecoveredAmount ?? 0))
      const recoveredAfter = this.money(recoveredBefore + applied)
      const completed = recoveredAfter >= this.money(Number(appeal.recoveryAmount ?? 0))
      const occurredAt = new Date()
      const entry = await manager.save(
        FinancialLedgerEntry,
        manager.create(FinancialLedgerEntry, {
          classification: 'cogs',
          entryType: 'recovery_auto_offset',
          // The gross payout COGS is retained separately. This negative entry
          // makes its net cost equal the amount actually payable to the creator.
          amount: -applied,
          currency: 'CNY',
          merchantId: appeal.merchantId,
          campaignId: payout.campaignId ?? null,
          creatorId: payout.creatorId,
          creatorTaskId: payout.creatorTaskId,
          sourceReference: `appeal:${appeal.id}`,
          idempotencyKey: `recovery-auto-offset:${payout.id}:${appeal.id}`,
          occurredAt,
          description: '后续结算自动抵扣待追回款',
          metadata: {
            appealId: appeal.id,
            originalPayoutId: appeal.payoutId ?? null,
            settlementPayoutId: payout.id,
            recoveryAmount: Number(appeal.recoveryAmount ?? 0),
            recoveredBefore,
            recoveredAfter,
            remainingRecoveryAmount: this.money(Number(appeal.recoveryAmount ?? 0) - recoveredAfter),
          },
        }),
      )
      appeal.recoveryRecoveredAmount = recoveredAfter
      if (completed) appeal.recoveryCompletedAt = occurredAt
      appeal.financialLedgerEntryIds = [...(appeal.financialLedgerEntryIds ?? []), entry.id]
      await manager.save(appeal)
      await manager.save(Notification, {
        recipientId: payout.creatorId,
        recipientRole: UserRole.AGENT,
        type: 'creator_recovery_auto_offset',
        title: completed ? '待追回款已全部抵扣' : '后续结算已自动抵扣待追回款',
        body: `本次结算已抵扣 ¥${applied.toFixed(2)}；该裁决尚待追回 ¥${Math.max(0, Number(appeal.recoveryAmount) - recoveredAfter).toFixed(2)}。`,
        targetType: 'creator_task_appeal',
        targetId: appeal.id,
        metadata: { appealId: appeal.id, settlementPayoutId: payout.id, applied, recoveredAfter, completed },
      })
      await manager.save(Notification, {
        recipientId: appeal.merchantId,
        recipientRole: UserRole.MERCHANT_ADMIN,
        type: 'merchant_recovery_progress',
        title: completed ? '创作者待追回款已完成' : '创作者待追回款有新进度',
        body: `后续结算已追回 ¥${applied.toFixed(2)}；该裁决累计已追回 ¥${recoveredAfter.toFixed(2)}。`,
        targetType: 'creator_task_appeal',
        targetId: appeal.id,
        metadata: { appealId: appeal.id, settlementPayoutId: payout.id, applied, recoveredAfter, completed },
      })
      remainingPayout = this.money(remainingPayout - applied)
      offsetTotal = this.money(offsetTotal + applied)
    }
    return offsetTotal
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
