import { randomUUID } from 'crypto'
import dataSource from '../src/data-source'
import { GrowthTaskService } from '../src/modules/task/growth-task.service'
import { CampaignCreditLedgerEntry, CreatorTask, GrowthTask } from '../src/modules/task/entities/growth-task.entity'
import { GrowthPlan } from '../src/modules/task/entities/growth-plan.entity'
import { CampaignBudgetAllocation } from '../src/modules/task/entities/campaign-budget-allocation.entity'
import { FinancialLedgerEntry } from '../src/modules/admin/entities/financial-ledger-entry.entity'
import { PilotInstrumentationService } from '../src/modules/pilot/pilot-instrumentation.service'
import { PilotMetricEvent } from '../src/modules/pilot/entities/pilot-metric-event.entity'

async function main() {
  await dataSource.initialize()
  const suffix = Date.now().toString()
  let merchantId = ''
  let creatorId = ''
  let growthTaskId = ''
  let creatorTaskId = ''
  try {
    const merchant = await dataSource.query(
      `INSERT INTO merchants (business_name, phone, password_hash) VALUES ($1, $2, $3) RETURNING id`,
      [`State Machine Smoke ${suffix}`, `19${suffix.slice(-9)}`, 'test-hash'],
    )
    merchantId = merchant[0].id
    const creator = await dataSource.query(
      `INSERT INTO sharing_agents (phone, "passwordHash", nickname) VALUES ($1, $2, $3) RETURNING id`,
      [`18${suffix.slice(-9)}`, 'test-hash', 'State Machine Smoke Creator'],
    )
    creatorId = creator[0].id
    const service = new GrowthTaskService(
      dataSource.getRepository(GrowthTask),
      dataSource.getRepository(CreatorTask),
      dataSource.getRepository(CampaignCreditLedgerEntry),
      dataSource.getRepository(GrowthPlan),
      dataSource.getRepository(CampaignBudgetAllocation),
      dataSource,
      new PilotInstrumentationService(
        dataSource.getRepository(PilotMetricEvent),
        dataSource.getRepository(CreatorTask),
        dataSource.getRepository(GrowthTask),
        dataSource.getRepository(CampaignCreditLedgerEntry),
      ),
    )
    const growth = await service.createGrowthTask(merchantId, {
      goalMetric: 'verified_clicks', baselineValue: 0, targetValue: 100, budget: 200,
      startAt: new Date(Date.now() + 60_000).toISOString(),
      endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    growthTaskId = growth.id
    await service.moveGrowthTask(merchantId, growthTaskId, 'ready_for_review')
    await service.moveGrowthTask(merchantId, growthTaskId, 'active')
    const creatorTask = await service.createCreatorTask(merchantId, growthTaskId, {
      creatorId, channel: 'douyin', contentType: 'short_video', brief: 'State machine smoke brief',
      deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), baseReward: 100,
      campaignCredits: 20, performanceReward: { qualityBonus: 20 }, trackingId: `smoke-${suffix}`,
    })
    creatorTaskId = creatorTask.id
    await service.moveCreatorTaskForMerchant(merchantId, creatorTaskId, 'matching')
    await service.moveCreatorTaskForMerchant(merchantId, creatorTaskId, 'invited')
    const accepted = await service.moveCreatorTaskForCreator(creatorId, creatorTaskId, 'accepted')
    if (!accepted.compensationLockedAt || Number(accepted.compensationSnapshot?.baseReward) !== 100) {
      throw new Error('compensation lock was not persisted at acceptance')
    }
    const consumption = await service.consumeCampaignCredits(creatorId, creatorTaskId, 2, `smoke-${suffix}`)
    if (consumption.remaining !== 18 || consumption.idempotent) throw new Error('Campaign Credits consumption mismatch')
    const repeat = await service.consumeCampaignCredits(creatorId, creatorTaskId, 2, `smoke-${suffix}`)
    if (!repeat.idempotent || repeat.remaining !== 18) throw new Error('Campaign Credits idempotency mismatch')
    await service.moveCreatorTaskForCreator(creatorId, creatorTaskId, 'creating')
    await service.moveCreatorTaskForCreator(creatorId, creatorTaskId, 'submitted')
    await service.holdForRisk(creatorTaskId, randomUUID(), 'smoke risk review')
    const resumed = await service.resolveRiskHold(creatorTaskId, randomUUID(), 'resume', 'smoke cleared')
    if (resumed.status !== 'submitted') throw new Error('risk hold did not resume previous submitted state')
    const approved = await service.reviewCreatorTask(creatorTaskId, randomUUID(), 'approve', 'smoke approved')
    if (approved.status !== 'approved') throw new Error('review approval failed')
    const creditEntries = await dataSource.getRepository(CampaignCreditLedgerEntry).count({ where: { creatorTaskId } })
    const financialEntries = await dataSource.getRepository(FinancialLedgerEntry).count({ where: { creatorTaskId } })
    if (creditEntries !== 2 || financialEntries !== 1) throw new Error('ledger evidence mismatch')
    console.log(JSON.stringify({ ok: true, creatorStatus: approved.status, creditsRemaining: consumption.remaining, creditEntries, financialEntries }))
  } finally {
    if (creatorTaskId) {
      await dataSource.query(`DELETE FROM campaign_credit_ledger WHERE creator_task_id = $1`, [creatorTaskId])
      await dataSource.query(`DELETE FROM financial_ledger_entries WHERE creator_task_id = $1`, [creatorTaskId])
      await dataSource.query(`DELETE FROM audit_logs WHERE target_id = $1`, [creatorTaskId])
      await dataSource.query(`DELETE FROM creator_tasks WHERE id = $1`, [creatorTaskId])
    }
    if (growthTaskId) {
      await dataSource.query(`DELETE FROM audit_logs WHERE target_id = $1`, [growthTaskId])
      await dataSource.query(`DELETE FROM growth_tasks WHERE id = $1`, [growthTaskId])
    }
    if (creatorId) await dataSource.query(`DELETE FROM sharing_agents WHERE id = $1`, [creatorId])
    if (merchantId) await dataSource.query(`DELETE FROM merchants WHERE id = $1`, [merchantId])
    await dataSource.destroy()
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
