// ============================================================
// Merchant Module
// ============================================================

import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Merchant } from './entities/merchant.entity'
import { Store } from './entities/store.entity'
import { Subscription } from './entities/subscription.entity'
import { SubscriptionPaymentOrder } from './entities/subscription-payment-order.entity'
import { WalletPaymentOrder } from './entities/wallet-payment-order.entity'
import { AuditLog } from '../admin/entities/audit-log.entity'
import { CommissionBudget } from './entities/commission-budget.entity'
import { BudgetTransaction } from './entities/commission-budget.entity'
import { PlatformRevenue } from './entities/platform-revenue.entity'
import { MerchantAgentBinding } from './entities/merchant-agent-binding.entity'
import { MerchantApiKey } from './entities/merchant-api-key.entity'
import { CampaignOptimization } from './entities/campaign-optimization.entity'
import { MerchantOptimizationSetting } from './entities/merchant-optimization-setting.entity'
import { CouponProductMapping } from '../campaign/entities/coupon-product-mapping.entity'
import { Coupon } from '../campaign/entities/coupon.entity'
import { Campaign } from '../campaign/entities/campaign.entity'
import { CustomerCoupon } from '../customer/entities/customer-coupon.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { CreatorTask, GrowthTask } from '../task/entities/growth-task.entity'
import { CreatorTaskPayout } from '../task/entities/creator-task-payout.entity'
import { GrowthPlan } from '../task/entities/growth-plan.entity'
import { CustomerAttribution } from '../customer/entities/customer-attribution.entity'
import { Content } from '../content/entities/content.entity'
import { ContentPublication } from '../content/entities/content-publication.entity'
import { Commission } from '../commission/entities/commission.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'

import { MerchantController } from './merchant.controller'
import { MerchantService } from './merchant.service'
import { SubscriptionPaymentService } from './subscription-payment.service'
import { MerchantWalletController } from './merchant-wallet.controller'
import { MerchantWalletService } from './merchant-wallet.service'
import { WalletPaymentController } from './wallet-payment.controller'
import { WalletPaymentService } from './wallet-payment.service'
import { AICampaignController } from './ai-campaign.controller'
import { AICampaignService } from './ai-campaign.service'
import { MerchantAgentBindingService } from './merchant-agent-binding.service'
import { MerchantAgentBindingController } from './merchant-agent-binding.controller'
import {
  MerchantIntegrationController,
  MerchantCallbackController,
} from './merchant-integration.controller'
import { MerchantIntegrationService } from './merchant-integration.service'
import { CampaignOptimizationController } from './campaign-optimization.controller'
import { CampaignOptimizationService } from './campaign-optimization.service'
import { CampaignRecommendationController } from './campaign-recommendation.controller'
import { CampaignRecommendationService } from './campaign-recommendation.service'
import { MerchantConversionController } from './merchant-conversion.controller'
import { MerchantConversionService } from './merchant-conversion.service'

import { CampaignModule } from '../campaign/campaign.module'
import { AIBridgeModule } from '../ai-bridge/ai-bridge.module'
import { AgentModule } from '../agent/agent.module'
import { CommissionModule } from '../commission/commission.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Merchant,
      Store,
      Subscription,
      SubscriptionPaymentOrder,
      WalletPaymentOrder,
      AuditLog,
      CommissionBudget,
      BudgetTransaction,
      PlatformRevenue,
      MerchantAgentBinding,
      MerchantApiKey,
      CampaignOptimization,
      MerchantOptimizationSetting,
      CouponProductMapping,
      Coupon,
      Campaign,
      CustomerCoupon,
      Redemption,
      CreatorTask,
      CreatorTaskPayout,
      GrowthTask,
      GrowthPlan,
      CustomerAttribution,
      Content,
      ContentPublication,
      Commission,
      SharingAgent,
    ]),
    CampaignModule,
    AIBridgeModule,
    AgentModule,
    CommissionModule,
    AuthModule,
  ],
  controllers: [
    MerchantController,
    MerchantWalletController,
    WalletPaymentController,
    MerchantAgentBindingController,
    AICampaignController,
    MerchantIntegrationController,
    MerchantCallbackController,
    CampaignOptimizationController,
    CampaignRecommendationController,
    MerchantConversionController,
  ],
  providers: [
    MerchantService,
    SubscriptionPaymentService,
    MerchantWalletService,
    WalletPaymentService,
    AICampaignService,
    MerchantAgentBindingService,
    MerchantIntegrationService,
    CampaignOptimizationService,
    CampaignRecommendationService,
    MerchantConversionService,
  ],
  exports: [MerchantService, MerchantWalletService, MerchantAgentBindingService],
})
export class MerchantModule {}
