import { Injectable, Optional } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, Repository } from 'typeorm'
import { Commission } from '../commission/entities/commission.entity'
import { PlatformRevenue } from '../merchant/entities/platform-revenue.entity'
import { CreatorTaskPayout } from '../task/entities/creator-task-payout.entity'

import { CreateFinancialLedgerEntryDto } from './dto/financial-ledger.dto'
import {
  FinancialClassification,
  FinancialLedgerEntry,
} from './entities/financial-ledger-entry.entity'

export interface LedgerActor {
  id: string
}

interface EconomicsScope {
  campaignId?: string
  merchantId?: string
}

@Injectable()
export class FinancialLedgerService {
  constructor(
    @InjectRepository(FinancialLedgerEntry)
    private readonly ledgerRepo: Repository<FinancialLedgerEntry>,
    @Optional()
    @InjectRepository(PlatformRevenue)
    private readonly platformRevenueRepo?: Repository<PlatformRevenue>,
    @Optional()
    @InjectRepository(Commission)
    private readonly commissionRepo?: Repository<Commission>,
    @Optional()
    @InjectRepository(CreatorTaskPayout)
    private readonly creatorTaskPayoutRepo?: Repository<CreatorTaskPayout>,
  ) {}

  async record(dto: CreateFinancialLedgerEntryDto, actor: LedgerActor) {
    const existing = await this.ledgerRepo.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
    })
    if (existing) return this.toEntry(existing)

    const entry = this.ledgerRepo.create({
      classification: dto.classification,
      entryType: dto.entryType,
      amount: dto.amount,
      currency: dto.currency?.toUpperCase() ?? 'CNY',
      merchantId: dto.merchantId ?? null,
      campaignId: dto.campaignId ?? null,
      creatorId: dto.creatorId ?? null,
      creatorTaskId: dto.creatorTaskId ?? null,
      sourceReference: dto.sourceReference ?? null,
      idempotencyKey: dto.idempotencyKey,
      recordedByAdminId: actor.id,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      description: dto.description ?? null,
      metadata: dto.metadata ?? {},
    })
    return this.toEntry(await this.ledgerRepo.save(entry))
  }

  async getEconomics(input: EconomicsScope) {
    const where: FindOptionsWhere<FinancialLedgerEntry> = {}
    if (input.campaignId) where.campaignId = input.campaignId
    if (input.merchantId) where.merchantId = input.merchantId
    const ledgerEntries = await this.ledgerRepo.find({
      where,
      order: { occurredAt: 'DESC', createdAt: 'DESC' },
    })
    const [platformRevenueRows, commissionRows, creatorTaskPayoutRows] = await Promise.all([
      this.platformRevenueRows(input),
      this.commissionRows(input),
      this.creatorTaskPayoutRows(input),
    ])
    const entries = [
      ...ledgerEntries.map((entry) => this.toEntry(entry)),
      ...this.derivedPlatformRevenue(input, ledgerEntries, platformRevenueRows, commissionRows),
      ...this.derivedCommissionRevenue(input, ledgerEntries, platformRevenueRows, commissionRows),
      ...this.derivedCreatorPayouts(input, ledgerEntries, commissionRows),
      ...this.derivedCreatorTaskPayouts(input, ledgerEntries, creatorTaskPayoutRows),
    ].sort(
      (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
    )

    const totals: Record<FinancialClassification, number> = {
      revenue: 0,
      cogs: 0,
      operating_cost: 0,
      reserve: 0,
    }
    for (const entry of entries) totals[entry.classification] += Number(entry.amount)

    const grossProfit = totals.revenue - totals.cogs - totals.operating_cost - totals.reserve
    const byEntryType = entries.reduce<Record<string, number>>((result, entry) => {
      result[entry.entryType] = (result[entry.entryType] ?? 0) + Number(entry.amount)
      return result
    }, {})
    return {
      scope: { campaignId: input.campaignId ?? null, merchantId: input.merchantId ?? null },
      totals: {
        merchantGrowthRevenue: totals.revenue,
        creatorPayoutCogs: totals.cogs,
        operatingCost: totals.operating_cost,
        riskReserve: totals.reserve,
        grossProfit,
        grossMargin:
          totals.revenue === 0 ? null : Number((grossProfit / totals.revenue).toFixed(4)),
      },
      summary: {
        entryCount: entries.length,
        totalCost: totals.cogs + totals.operating_cost + totals.reserve,
        netResult: grossProfit,
        byEntryType,
      },
      entries,
    }
  }

  private async platformRevenueRows(input: EconomicsScope) {
    if (!this.platformRevenueRepo) return []
    const where: FindOptionsWhere<PlatformRevenue> = {}
    if (input.merchantId) where.merchantId = input.merchantId
    return this.platformRevenueRepo.find({ where, order: { revenueDate: 'DESC' } })
  }

  private async commissionRows(input: EconomicsScope) {
    if (!this.commissionRepo) return []
    const where: FindOptionsWhere<Commission> = {}
    if (input.merchantId) where.merchantId = input.merchantId
    return this.commissionRepo.find({ where, order: { createdAt: 'DESC' } })
  }

  private async creatorTaskPayoutRows(input: EconomicsScope) {
    if (!this.creatorTaskPayoutRepo) return []
    const where: FindOptionsWhere<CreatorTaskPayout> = {}
    if (input.merchantId) where.merchantId = input.merchantId
    return this.creatorTaskPayoutRepo.find({ where, order: { createdAt: 'DESC' } })
  }

  private derivedPlatformRevenue(
    input: EconomicsScope,
    ledgerEntries: FinancialLedgerEntry[],
    rows: PlatformRevenue[],
    commissions: Commission[],
  ) {
    const commissionById = new Map(commissions.map((commission) => [commission.id, commission]))
    return rows
      .map((row) => ({
        row,
        commission: row.commissionId ? commissionById.get(row.commissionId) : undefined,
      }))
      .filter(({ row, commission }) => {
        const campaignId = this.platformRevenueCampaignId(row, commission)
        return (
          (!input.campaignId || campaignId === input.campaignId) &&
          !this.hasRevenueLedgerForPlatformRevenue(row, commission, ledgerEntries)
        )
      })
      .map((row) => ({
        entryId: `platform-revenue:${row.row.id}`,
        classification: 'revenue' as const,
        entryType: row.row.revenueType,
        amount: Number(row.row.amount),
        currency: 'CNY',
        merchantId: row.row.merchantId ?? null,
        campaignId: this.platformRevenueCampaignId(row.row, row.commission),
        creatorId: row.row.agentId ?? row.commission?.agentId ?? null,
        creatorTaskId: null,
        sourceReference: row.row.id,
        occurredAt: row.row.revenueDate,
        description: row.row.description ?? '平台收入流水（兼容旧账本）',
        metadata: row.row.metadata ?? null,
        recordedByAdminId: null,
      }))
  }

  private derivedCommissionRevenue(
    input: EconomicsScope,
    ledgerEntries: FinancialLedgerEntry[],
    platformRevenueRows: PlatformRevenue[],
    commissions: Commission[],
  ) {
    const linkedCommissionIds = new Set(
      platformRevenueRows.map((row) => row.commissionId).filter(Boolean),
    )
    return commissions
      .filter(
        (row) =>
          Number(row.platformFee) > 0 &&
          (!input.campaignId || row.campaignId === input.campaignId) &&
          !linkedCommissionIds.has(row.id) &&
          !this.hasRevenueLedgerForCommission(row, ledgerEntries),
      )
      .map((row) => ({
        entryId: `commission-revenue:${row.id}`,
        classification: 'revenue' as const,
        entryType: 'commission_royalty',
        amount: Number(row.platformFee),
        currency: 'CNY',
        merchantId: row.merchantId,
        campaignId: row.campaignId ?? null,
        creatorId: row.agentId,
        creatorTaskId: null,
        sourceReference: row.id,
        occurredAt: row.createdAt,
        description: '平台佣金收入（由旧佣金流水补齐）',
        metadata: { commissionId: row.id, status: row.status },
        recordedByAdminId: null,
      }))
  }

  private derivedCreatorPayouts(
    input: EconomicsScope,
    ledgerEntries: FinancialLedgerEntry[],
    rows: Commission[],
  ) {
    return rows
      .filter(
        (row) =>
          (!input.campaignId || row.campaignId === input.campaignId) &&
          !this.hasCogsLedgerForCommission(row, ledgerEntries),
      )
      .map((row) => ({
        entryId: `creator-payout:${row.id}`,
        classification: 'cogs' as const,
        entryType: 'creator_payout',
        amount: Number(row.agentFinalPayout),
        currency: 'CNY',
        merchantId: row.merchantId,
        campaignId: row.campaignId ?? null,
        creatorId: row.agentId,
        creatorTaskId: null,
        sourceReference: row.id,
        occurredAt: row.createdAt,
        description: '创作者履约报酬（由佣金流水补齐）',
        metadata: { commissionId: row.id, status: row.status },
        recordedByAdminId: null,
      }))
  }

  private derivedCreatorTaskPayouts(
    input: EconomicsScope,
    ledgerEntries: FinancialLedgerEntry[],
    rows: CreatorTaskPayout[],
  ) {
    return rows
      .filter(
        (row) =>
          ['verified', 'settled', 'risk_hold'].includes(row.status) &&
          (!input.campaignId || row.campaignId === input.campaignId) &&
          !this.hasCogsLedgerForCreatorTaskPayout(row, ledgerEntries),
      )
      .map((row) => ({
        entryId: `creator-task-payout:${row.id}`,
        classification: 'cogs' as const,
        entryType: 'creator_task_payout',
        amount: Number(row.verifiedAmount ?? row.expectedAmount),
        currency: 'CNY',
        merchantId: row.merchantId,
        campaignId: row.campaignId ?? null,
        creatorId: row.creatorId,
        creatorTaskId: row.creatorTaskId,
        sourceReference: row.id,
        occurredAt: row.verifiedAt ?? row.createdAt,
        description: 'Creator Task 履约报酬',
        metadata: { payoutId: row.id, status: row.status, settleAt: row.settleAt ?? null },
        recordedByAdminId: null,
      }))
  }

  private platformRevenueCampaignId(row: PlatformRevenue, commission?: Commission) {
    return (row.metadata?.campaignId ??
      row.metadata?.campaign_id ??
      commission?.campaignId ??
      null) as string | null
  }

  private hasRevenueLedgerForPlatformRevenue(
    row: PlatformRevenue,
    commission: Commission | undefined,
    ledgerEntries: FinancialLedgerEntry[],
  ) {
    return ledgerEntries.some(
      (entry) =>
        entry.classification === 'revenue' &&
        (entry.sourceReference === row.id ||
          entry.metadata?.platformRevenueId === row.id ||
          (commission ? this.isCommissionLedgerReference(entry, commission) : false)),
    )
  }

  private hasRevenueLedgerForCommission(row: Commission, ledgerEntries: FinancialLedgerEntry[]) {
    return ledgerEntries.some(
      (entry) => entry.classification === 'revenue' && this.isCommissionLedgerReference(entry, row),
    )
  }

  private hasCogsLedgerForCommission(row: Commission, ledgerEntries: FinancialLedgerEntry[]) {
    return ledgerEntries.some(
      (entry) => entry.classification === 'cogs' && this.isCommissionLedgerReference(entry, row),
    )
  }

  private hasCogsLedgerForCreatorTaskPayout(
    payout: CreatorTaskPayout,
    ledgerEntries: FinancialLedgerEntry[],
  ) {
    return ledgerEntries.some(
      (entry) =>
        entry.classification === 'cogs' &&
        (entry.sourceReference === payout.id ||
          entry.creatorTaskId === payout.creatorTaskId ||
          entry.metadata?.payoutId === payout.id),
    )
  }

  private isCommissionLedgerReference(entry: FinancialLedgerEntry, commission: Commission) {
    return (
      entry.sourceReference === commission.id ||
      entry.sourceReference === `commission:${commission.id}` ||
      entry.metadata?.commissionId === commission.id
    )
  }

  private toEntry(entry: FinancialLedgerEntry) {
    return {
      entryId: entry.id,
      classification: entry.classification,
      entryType: entry.entryType,
      amount: Number(entry.amount),
      currency: entry.currency,
      merchantId: entry.merchantId ?? null,
      campaignId: entry.campaignId ?? null,
      creatorId: entry.creatorId ?? null,
      creatorTaskId: entry.creatorTaskId ?? null,
      sourceReference: entry.sourceReference ?? null,
      occurredAt: entry.occurredAt,
      description: entry.description ?? null,
      metadata: entry.metadata,
      recordedByAdminId: entry.recordedByAdminId ?? null,
    }
  }
}
