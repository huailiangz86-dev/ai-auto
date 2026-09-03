// ============================================================
// Campaign Module
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Campaign } from './entities/campaign.entity'
import { Coupon } from './entities/coupon.entity'
import { CouponProductMapping } from './entities/coupon-product-mapping.entity'
import { MarketingProduct, MarketingProductSku } from './entities/marketing-product.entity'
import { Merchant } from '../merchant/entities/merchant.entity'
import { PilotInstrumentationModule } from '../pilot/pilot-instrumentation.module'

import { CampaignController } from './campaign.controller'
import { MarketingProductController } from './marketing-product.controller'
import { CampaignService } from './campaign.service'
import { MarketingProductService } from './marketing-product.service'

@Module({
  imports: [
    PilotInstrumentationModule,
    TypeOrmModule.forFeature([
      Campaign,
      Coupon,
      CouponProductMapping,
      MarketingProduct,
      MarketingProductSku,
      Merchant,
    ]),
  ],
  controllers: [CampaignController, MarketingProductController],
  providers: [CampaignService, MarketingProductService],
  exports: [CampaignService],
})
export class CampaignModule {}
