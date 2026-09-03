import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { GrowthPlan } from './entities/growth-plan.entity'
import {
  IncrementalityInputs,
  IncrementalityMeasurement,
} from './entities/incrementality-measurement.entity'
import { RecordIncrementalityMeasurementDto } from './dto/incrementality-measurement.dto'

@Injectable()
export class IncrementalityMeasurementService {
  constructor(
    @InjectRepository(IncrementalityMeasurement)
    private readonly measurements: Repository<IncrementalityMeasurement>,
  ) {}

  async record(merchantId: string, plan: GrowthPlan, dto: RecordIncrementalityMeasurementDto) {
    if (!plan.campaignId) throw new BadRequestException('增长计划尚未关联 Campaign')
    const windowStartAt = new Date(dto.windowStartAt)
    const windowEndAt = new Date(dto.windowEndAt)
    if (windowEndAt <= windowStartAt) throw new BadRequestException('测量结束时间必须晚于开始时间')
    const inputs: IncrementalityInputs = {
      treatmentBaselineOrders: dto.treatmentBaselineOrders,
      controlBaselineOrders: dto.controlBaselineOrders,
      treatmentObservedOrders: dto.treatmentObservedOrders,
      controlObservedOrders: dto.controlObservedOrders,
      treatmentBaselineGmv: dto.treatmentBaselineGmv,
      controlBaselineGmv: dto.controlBaselineGmv,
      treatmentObservedGmv: dto.treatmentObservedGmv,
      controlObservedGmv: dto.controlObservedGmv,
    }
    const existing = await this.measurements.findOne({ where: { growthPlanId: plan.id, merchantId } })
    const measurement = existing ?? this.measurements.create({
      growthPlanId: plan.id,
      merchantId,
      campaignId: plan.campaignId,
      method: dto.method,
      windowStartAt,
      windowEndAt,
      inputs,
      assumptions: [],
      recordedAt: new Date(),
    })
    measurement.method = dto.method
    measurement.windowStartAt = windowStartAt
    measurement.windowEndAt = windowEndAt
    measurement.inputs = inputs
    measurement.assumptions = this.assumptions(dto)
    measurement.recordedAt = new Date()
    return this.present(await this.measurements.save(measurement))
  }

  async result(merchantId: string, growthPlanId: string) {
    const measurement = await this.measurements.findOne({ where: { growthPlanId, merchantId } })
    return measurement ? this.present(measurement) : this.notMeasured()
  }

  private present(measurement: IncrementalityMeasurement) {
    const input = measurement.inputs
    const incrementalOrders = this.differenceInDifferences(
      input.treatmentBaselineOrders,
      input.treatmentObservedOrders,
      input.controlBaselineOrders,
      input.controlObservedOrders,
    )
    const incrementalGmv = this.differenceInDifferences(
      input.treatmentBaselineGmv,
      input.treatmentObservedGmv,
      input.controlBaselineGmv,
      input.controlObservedGmv,
    )
    return {
      status: 'measured',
      orders: incrementalOrders,
      gmv: incrementalGmv,
      label: '经对照组测量的增量结果',
      method: measurement.method === 'geo_holdout' ? '地域对照组双重差分' : '受众对照组双重差分',
      assumptions: measurement.assumptions,
      measurement: {
        measurementId: measurement.id,
        method: measurement.method,
        windowStartAt: measurement.windowStartAt,
        windowEndAt: measurement.windowEndAt,
        recordedAt: measurement.recordedAt,
        inputs: input,
        calculation: '增量 =（实验组观察期 − 实验组基线期）−（对照组观察期 − 对照组基线期）',
      },
    }
  }

  private notMeasured() {
    return {
      status: 'not_measured',
      orders: null,
      gmv: null,
      label: '增量结果尚未测量',
      method: '尚未配置对照组、地域实验或经批准的因果模型。',
      assumptions: [
        '已验证归因不等同于增量效果。',
        '在记录对照基线前，系统不会估算或宣称增量订单、GMV 或 ROI。',
      ],
      measurement: null,
    }
  }

  private assumptions(dto: RecordIncrementalityMeasurementDto) {
    return [
      '实验组与对照组在基线期具有可比性，且窗口内未发生只影响其中一组的重大外部干预。',
      '订单和 GMV 的统计口径在实验组、对照组及两个时间窗口中保持一致。',
      ...(dto.assumptions ?? []).map((item) => item.trim()).filter(Boolean),
    ]
  }

  private differenceInDifferences(
    treatmentBaseline: number,
    treatmentObserved: number,
    controlBaseline: number,
    controlObserved: number,
  ) {
    return this.round((treatmentObserved - treatmentBaseline) - (controlObserved - controlBaseline))
  }

  private round(value: number) { return Math.round(value * 100) / 100 }
}