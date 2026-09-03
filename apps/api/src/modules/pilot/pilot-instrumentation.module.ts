import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { CampaignCreditLedgerEntry, CreatorTask, GrowthTask } from '../task/entities/growth-task.entity'
import { PilotInstrumentationController } from './pilot-instrumentation.controller'
import { PilotMetricEvent } from './entities/pilot-metric-event.entity'
import { PilotInstrumentationService } from './pilot-instrumentation.service'
@Module({ imports: [TypeOrmModule.forFeature([PilotMetricEvent, CreatorTask, GrowthTask, CampaignCreditLedgerEntry])], controllers: [PilotInstrumentationController], providers: [PilotInstrumentationService], exports: [PilotInstrumentationService] })
export class PilotInstrumentationModule {}