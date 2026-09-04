import { AdminController } from './admin.controller'
import { CreateRiskRuleDto } from './dto/risk-rule.dto'
import { LifecycleController } from './lifecycle.controller'
import { RiskRuleController } from './risk-rule.controller'

describe('Admin operations controllers', () => {
  const user: any = { id: 'admin-1', username: 'ops-admin' }

  it('passes the authenticated operator to risk rule mutations', async () => {
    const service: any = {
      create: jest.fn().mockResolvedValue({ id: 'rule-1' }),
      update: jest.fn().mockResolvedValue({ id: 'rule-1' }),
      toggle: jest.fn().mockResolvedValue({ id: 'rule-1', enabled: false }),
      remove: jest.fn().mockResolvedValue({ code: 0 }),
    }
    const controller = new RiskRuleController(service)
    const dto: CreateRiskRuleDto = {
      name: '高频核销',
      ruleKey: 'high_frequency_redemption',
      triggerType: 'redemption_frequency',
      severity: 'warning',
      conditionConfig: { threshold: 10 },
      actions: ['create_alert'],
    }

    await controller.create(user, dto)
    await controller.update(user, 'rule-1', dto)
    await controller.toggle(user, 'rule-1', { enabled: false })
    await controller.remove(user, 'rule-1')

    expect(service.create).toHaveBeenCalledWith(dto, { id: 'admin-1', name: 'ops-admin' })
    expect(service.update).toHaveBeenCalledWith('rule-1', dto, { id: 'admin-1', name: 'ops-admin' })
    expect(service.toggle).toHaveBeenCalledWith('rule-1', false, {
      id: 'admin-1',
      name: 'ops-admin',
    })
    expect(service.remove).toHaveBeenCalledWith('rule-1', { id: 'admin-1', name: 'ops-admin' })
  })

  it('keeps risk rule list query and result unchanged', async () => {
    const query = { enabled: true, triggerType: 'self_redemption' }
    const service: any = { list: jest.fn().mockResolvedValue({ items: [] }) }
    const controller = new RiskRuleController(service)

    await expect(controller.list(query as any)).resolves.toEqual({ items: [] })
    expect(service.list).toHaveBeenCalledWith(query)
  })

  it('passes operator identity to relationship restriction, release and unbind actions', async () => {
    const service: any = {
      restrictRelationship: jest.fn().mockResolvedValue({ code: 0 }),
      releaseRelationship: jest.fn().mockResolvedValue({ code: 0 }),
      unbindRelationship: jest.fn().mockResolvedValue({ code: 0 }),
    }
    const controller = new LifecycleController(service)
    const reason = { reason: '风控复核' }

    await controller.restrictRelationship(user, 'binding-1', reason)
    await controller.releaseRelationship(user, 'binding-1', { reason: '复核通过' })
    await controller.unbindRelationship(user, 'binding-1', reason)

    expect(service.restrictRelationship).toHaveBeenCalledWith('binding-1', reason, {
      id: 'admin-1',
      name: 'ops-admin',
    })
    expect(service.releaseRelationship).toHaveBeenCalledWith(
      'binding-1',
      { reason: '复核通过' },
      {
        id: 'admin-1',
        name: 'ops-admin',
      },
    )
    expect(service.unbindRelationship).toHaveBeenCalledWith('binding-1', reason, {
      id: 'admin-1',
      name: 'ops-admin',
    })
  })

  it('passes creator quota updates through the lifecycle controller', async () => {
    const service: any = { setCreatorTaskLimit: jest.fn().mockResolvedValue({ code: 0 }) }
    const controller = new LifecycleController(service)
    const dto = { limit: 5 }

    await controller.setCreatorTaskLimit(user, 'creator-1', dto)

    expect(service.setCreatorTaskLimit).toHaveBeenCalledWith('creator-1', dto, {
      id: 'admin-1',
      name: 'ops-admin',
    })
  })

  it('wraps economics reads and ledger writes in the admin response envelope', async () => {
    const adminService: any = {}
    const financialLedgerService: any = {
      getEconomics: jest.fn().mockResolvedValue({ totals: { grossProfit: 10 } }),
      record: jest.fn().mockResolvedValue({ entryId: 'entry-1' }),
    }
    const controller = new AdminController(adminService, financialLedgerService)
    const query = { campaignId: 'campaign-1' }
    const dto = { classification: 'operating_cost', amount: 10, idempotencyKey: 'cost-1' }

    await expect(controller.getCampaignEconomics(query as any)).resolves.toEqual({
      code: 0,
      data: { totals: { grossProfit: 10 } },
    })
    await expect(controller.recordCampaignEntry(user, dto as any)).resolves.toEqual({
      code: 0,
      data: { entryId: 'entry-1' },
    })
    expect(financialLedgerService.getEconomics).toHaveBeenCalledWith(query)
    expect(financialLedgerService.record).toHaveBeenCalledWith(dto, { id: 'admin-1' })
  })
})
