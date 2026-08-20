// ============================================================
// Campaign Module
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Campaign } from './entities/campaign.entity'
import { Coupon } from './entities/coupon.entity'
import { Merchant } from '../merchant/entities/merchant.entity'

import { CampaignController } from './campaign.controller'
import { CampaignService } from './campaign.service'

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, Coupon, Merchant])],
  controllers: [CampaignController],
  providers: [CampaignService],
  exports: [CampaignService],
})
export class CampaignModule {}
