import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Campaign } from '../campaign/entities/campaign.entity'
import { Coupon } from '../campaign/entities/coupon.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { CustomerAttribution } from '../customer/entities/customer-attribution.entity'
import { CustomerCoupon } from '../customer/entities/customer-coupon.entity'
import { CreatorTaskPayout } from '../task/entities/creator-task-payout.entity'
import {
  CampaignCreditLedgerEntry,
  CreatorTask,
  GrowthTask,
} from '../task/entities/growth-task.entity'
import { PilotInstrumentationController } from './pilot-instrumentation.controller'
import { CampaignMeasurementProtocol } from './entities/campaign-measurement-protocol.entity'
import { PilotMetricEvent } from './entities/pilot-metric-event.entity'
import { PilotInstrumentationService } from './pilot-instrumentation.service'
import { PilotMeasurementService } from './pilot-measurement.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PilotMetricEvent,
      CampaignMeasurementProtocol,
      Campaign,
      Coupon,
      CustomerCoupon,
      Redemption,
      CustomerAttribution,
      CreatorTask,
      GrowthTask,
      CreatorTaskPayout,
      CampaignCreditLedgerEntry,
    ]),
  ],
  controllers: [PilotInstrumentationController],
  providers: [PilotInstrumentationService, PilotMeasurementService],
  exports: [PilotInstrumentationService, PilotMeasurementService],
})
export class PilotInstrumentationModule {}
