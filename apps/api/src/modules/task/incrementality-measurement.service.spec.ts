import { IncrementalityMeasurementService } from './incrementality-measurement.service'

describe('IncrementalityMeasurementService', () => {
  const merchantId = 'merchant-1'
  const plan: any = { id: 'plan-1', merchantId, campaignId: 'campaign-1' }

  it('does not fabricate an incremental result before a holdout is recorded', async () => {
    const repo: any = { findOne: jest.fn().mockResolvedValue(null) }
    const service = new IncrementalityMeasurementService(repo)

    await expect(service.result(merchantId, plan.id)).resolves.toMatchObject({
      status: 'not_measured', orders: null, gmv: null,
    })
  })

  it('calculates incremental orders and GMV with disclosed difference-in-differences inputs', async () => {
    const repo: any = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => ({ id: 'measurement-1', ...value })),
      save: jest.fn(async (value) => ({ id: value.id ?? 'measurement-1', ...value })),
    }
    const service = new IncrementalityMeasurementService(repo)

    const result = await service.record(merchantId, plan, {
      method: 'geo_holdout',
      windowStartAt: '2026-09-01T00:00:00.000Z',
      windowEndAt: '2026-09-15T00:00:00.000Z',
      treatmentBaselineOrders: 100,
      treatmentObservedOrders: 145,
      controlBaselineOrders: 80,
      controlObservedOrders: 105,
      treatmentBaselineGmv: 10000,
      treatmentObservedGmv: 15400,
      controlBaselineGmv: 8000,
      controlObservedGmv: 10500,
      assumptions: ['门店营业时间不变'],
    })

    expect(result).toMatchObject({ status: 'measured', orders: 20, gmv: 2900 })
    expect(result.assumptions).toContain('门店营业时间不变')
    expect(result.measurement.calculation).toContain('实验组观察期')
  })
})