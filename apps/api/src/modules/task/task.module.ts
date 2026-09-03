import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AIBridgeModule } from '../ai-bridge/ai-bridge.module'
import { AuditLog } from '../admin/entities/audit-log.entity'
import { FinancialLedgerEntry } from '../admin/entities/financial-ledger-entry.entity'
import { Content } from '../content/entities/content.entity'
import { ContentPublication } from '../content/entities/content-publication.entity'
import { Notification } from '../notification/entities/notification.entity'
import { AgentPlatformAccount } from '../agent/entities/agent-platform-account.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { Coupon } from '../campaign/entities/coupon.entity'
import { Store } from '../merchant/entities/store.entity'
import { BudgetTransaction, CommissionBudget } from '../merchant/entities/commission-budget.entity'
import { Campaign } from '../campaign/entities/campaign.entity'
import { MerchantAgentBinding } from '../merchant/entities/merchant-agent-binding.entity'
import { PilotInstrumentationModule } from '../pilot/pilot-instrumentation.module'
import {
  AdminCreatorTaskController,
  CreatorTaskController,
  MerchantGrowthTaskController,
} from './growth-task.controller'
import { MerchantGrowthPlanController } from './growth-plan.controller'
import { GrowthTaskService } from './growth-task.service'
import { GrowthPlanService } from './growth-plan.service'
import { CampaignFundingService } from './campaign-funding.service'
import { GrowthReportService } from './growth-report.service'
import { IncrementalityMeasurementService } from './incrementality-measurement.service'
import { OperationsWorkbenchService } from './operations-workbench.service'
import { CreatorMatchingService } from './creator-matching.service'
import { AgentTaskController, MerchantTaskController } from './sharing-task.controller'
import { SharingTaskService } from './sharing-task.service'
import { CampaignCreditLedgerEntry, CreatorTask, GrowthTask } from './entities/growth-task.entity'
import { GrowthPlan } from './entities/growth-plan.entity'
import { CampaignBudgetAllocation } from './entities/campaign-budget-allocation.entity'
import { IncrementalityMeasurement } from './entities/incrementality-measurement.entity'
import { SharingTask, SharingTaskAssignment } from './entities/sharing-task.entity'
import { Redemption } from '../commission/entities/redemption.entity'
import { Commission } from '../commission/entities/commission.entity'
import { CustomerAttribution } from '../customer/entities/customer-attribution.entity'
@Module({
  imports: [
    PilotInstrumentationModule,
    AIBridgeModule,
    TypeOrmModule.forFeature([
      SharingTask,
      SharingTaskAssignment,
      Coupon,
      Store,
      CommissionBudget,
      BudgetTransaction,
      Campaign,
      SharingAgent,
      AgentPlatformAccount,
      MerchantAgentBinding,
      AgentWallet,
      GrowthTask,
      GrowthPlan,
      CampaignBudgetAllocation,
      IncrementalityMeasurement,
      CreatorTask,
      CampaignCreditLedgerEntry,
      AuditLog,
      FinancialLedgerEntry,
      Content,
      ContentPublication,
      Redemption,
      Commission,
      CustomerAttribution,
      Notification,
    ]),
  ],
  controllers: [
    MerchantTaskController,
    AgentTaskController,
    MerchantGrowthTaskController,
    MerchantGrowthPlanController,
    CreatorTaskController,
    AdminCreatorTaskController,
  ],
  providers: [
    SharingTaskService,
    GrowthTaskService,
    GrowthPlanService,
    CampaignFundingService,
    GrowthReportService,
    IncrementalityMeasurementService,
    OperationsWorkbenchService,
    CreatorMatchingService,
  ],
  exports: [SharingTaskService, GrowthTaskService],
})
export class TaskModule {}
