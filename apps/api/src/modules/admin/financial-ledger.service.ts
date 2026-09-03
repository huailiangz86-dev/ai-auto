import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, Repository } from 'typeorm'

import { CreateFinancialLedgerEntryDto } from './dto/financial-ledger.dto'
import { FinancialClassification, FinancialLedgerEntry } from './entities/financial-ledger-entry.entity'

export interface LedgerActor {
  id: string
}

@Injectable()
export class FinancialLedgerService {
  constructor(
    @InjectRepository(FinancialLedgerEntry)
    private readonly ledgerRepo: Repository<FinancialLedgerEntry>,
  ) {}

  async record(dto: CreateFinancialLedgerEntryDto, actor: LedgerActor) {
    const existing = await this.ledgerRepo.findOne({ where: { idempotencyKey: dto.idempotencyKey } })
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

  async getEconomics(input: { campaignId?: string; merchantId?: string }) {
    const where: FindOptionsWhere<FinancialLedgerEntry> = {}
    if (input.campaignId) where.campaignId = input.campaignId
    if (input.merchantId) where.merchantId = input.merchantId
    const entries = await this.ledgerRepo.find({
      where,
      order: { occurredAt: 'DESC', createdAt: 'DESC' },
    })

    const totals: Record<FinancialClassification, number> = {
      revenue: 0,
      cogs: 0,
      operating_cost: 0,
      reserve: 0,
    }
    for (const entry of entries) totals[entry.classification] += Number(entry.amount)

    const grossProfit = totals.revenue - totals.cogs - totals.operating_cost - totals.reserve
    return {
      scope: { campaignId: input.campaignId ?? null, merchantId: input.merchantId ?? null },
      totals: {
        merchantGrowthRevenue: totals.revenue,
        creatorPayoutCogs: totals.cogs,
        operatingCost: totals.operating_cost,
        riskReserve: totals.reserve,
        grossProfit,
        grossMargin: totals.revenue === 0 ? null : Number((grossProfit / totals.revenue).toFixed(4)),
      },
      entries: entries.map((entry) => this.toEntry(entry)),
    }
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