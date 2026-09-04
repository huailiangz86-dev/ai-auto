import { BadRequestException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

import { RiskRule } from './entities/risk-rule.entity'
import { AuditLog } from './entities/audit-log.entity'
import { RiskRuleService } from './risk-rule.service'

const createRepo = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  create: jest.fn((value) => value),
})

describe('RiskRuleService', () => {
  let service: RiskRuleService
  let repo: ReturnType<typeof createRepo>
  let manager: { save: jest.Mock; softRemove: jest.Mock }

  beforeEach(async () => {
    repo = createRepo()
    manager = {
      save: jest.fn((_: unknown, value?: unknown) => Promise.resolve(value ?? _)),
      softRemove: jest.fn().mockResolvedValue(undefined),
    }
    const module = await Test.createTestingModule({
      providers: [
        RiskRuleService,
        { provide: getRepositoryToken(RiskRule), useValue: repo },
        { provide: DataSource, useValue: { transaction: jest.fn((fn) => fn(manager)) } },
      ],
    }).compile()
    service = module.get(RiskRuleService)
  })

  it('creates a normalized rule, preserves only supported conditions, and audits it', async () => {
    repo.findOne.mockResolvedValueOnce(null)
    const created = await service.create(
      {
        name: '高频核销',
        ruleKey: 'High_Frequency_Redemption',
        triggerType: 'redemption_frequency',
        severity: 'warning',
        conditionConfig: { windowMinutes: 15, threshold: 10, ignored: 'nope' } as any,
        actions: ['create_alert', 'manual_review'],
      },
      { id: 'admin-1', name: '运营管理员' },
    )

    expect(created).toMatchObject({
      ruleKey: 'high_frequency_redemption',
      conditionConfig: { windowMinutes: 15, threshold: 10 },
      version: 1,
    })
    expect(manager.save).toHaveBeenCalledWith(
      RiskRule,
      expect.objectContaining({ ruleKey: 'high_frequency_redemption' }),
    )
    expect(manager.save).toHaveBeenCalledWith(
      AuditLog,
      expect.objectContaining({
        actionDescription: '风控规则已创建',
        targetType: 'risk_rule',
      }),
    )
  })

  it('rejects a duplicate rule key before creating a policy', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'rule-1' })

    await expect(
      service.create(
        {
          name: '高频核销',
          ruleKey: 'high_frequency_redemption',
          triggerType: 'redemption_frequency',
          severity: 'warning',
          conditionConfig: { threshold: 10 },
          actions: ['create_alert'],
        },
        { id: 'admin-1' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('rejects a rule whose condition has no supported values', async () => {
    repo.findOne.mockResolvedValueOnce(null)

    await expect(
      service.create(
        {
          name: '无效条件',
          ruleKey: 'invalid_condition',
          triggerType: 'redemption_frequency',
          severity: 'warning',
          conditionConfig: { ignored: 'value' } as any,
          actions: ['create_alert'],
        },
        { id: 'admin-1' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
