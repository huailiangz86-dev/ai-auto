// ============================================================
// Analytics Module
// Attribution chain tracking, funnel, ROI, and reporting
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AnalyticsController } from './analytics.controller'
import { AnalyticsService } from './analytics.service'

import { CustomerAttribution } from '../customer/entities/customer-attribution.entity'
import { CustomerCoupon } from '../customer/entities/customer-coupon.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { Commission } from '../commission/entities/commission.entity'
import { Campaign } from '../campaign/entities/campaign.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerAttribution,
      CustomerCoupon,
      Redemption,
      Commission,
      Campaign,
      SharingAgent,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
