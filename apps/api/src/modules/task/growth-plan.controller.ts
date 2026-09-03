import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import {
  ApproveGrowthPlanDto,
  CreateGrowthPlanDto,
  ListGrowthPlansDto,
} from './dto/growth-plan.dto'
import { RecordIncrementalityMeasurementDto } from './dto/incrementality-measurement.dto'
import { FundGrowthPlanDto } from './dto/campaign-budget.dto'
import { GrowthPlanService } from './growth-plan.service'
import { CampaignFundingService } from './campaign-funding.service'
import { GrowthReportService } from './growth-report.service'
import { IncrementalityMeasurementService } from './incrementality-measurement.service'

@ApiTags('V2 Merchant AI Growth Plans')
@Controller('merchant/growth-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT_ADMIN)
@ApiBearerAuth()
export class MerchantGrowthPlanController {
  constructor(
    private readonly service: GrowthPlanService,
    private readonly funding: CampaignFundingService,
    private readonly reports: GrowthReportService,
    private readonly incrementality: IncrementalityMeasurementService,
  ) {}
  @Post()
  @ApiOperation({ summary: 'Submit a growth goal and generate reviewable AI alternatives' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateGrowthPlanDto) {
    return this.service.create(user.merchantId!, dto)
  }
  @Get()
  @ApiOperation({ summary: 'List Growth Plans' })
  list(@CurrentUser() user: CurrentUserPayload, @Query() query: ListGrowthPlansDto) {
    return this.service.list(user.merchantId!, query)
  }
  @Get(':planId')
  @ApiOperation({ summary: 'Get Growth Plan assumptions and options' })
  get(@CurrentUser() user: CurrentUserPayload, @Param('planId') planId: string) {
    return this.service.get(user.merchantId!, planId)
  }
  @Get(':planId/economics')
  @ApiOperation({ summary: 'Get funded Campaign unit economics and goal progress' })
  economics(@CurrentUser() user: CurrentUserPayload, @Param('planId') planId: string) {
    return this.funding.economics(user.merchantId!, planId)
  }
  @Get(':planId/report')
  @ApiOperation({
    summary: 'Get traceable merchant ROI, verified attribution, and incremental measurement report',
  })
  report(@CurrentUser() user: CurrentUserPayload, @Param('planId') planId: string) {
    return this.reports.report(user.merchantId!, planId)
  }
  @Get(':planId/incrementality')
  @ApiOperation({ summary: 'Get disclosed incrementality measurement or its unmeasured state' })
  incrementalityResult(@CurrentUser() user: CurrentUserPayload, @Param('planId') planId: string) {
    return this.incrementality.result(user.merchantId!, planId)
  }
  @Post(':planId/incrementality')
  @ApiOperation({ summary: 'Record holdout inputs and calculate disclosed incremental orders and GMV' })
  async recordIncrementality(
    @CurrentUser() user: CurrentUserPayload,
    @Param('planId') planId: string,
    @Body() dto: RecordIncrementalityMeasurementDto,
  ) {
    const plan = await this.service.getEntity(user.merchantId!, planId)
    return this.incrementality.record(user.merchantId!, plan, dto)
  }
  @Post(':planId/fund')
  @ApiOperation({
    summary: 'Confirm the approved plan budget and atomically freeze its Campaign funds',
  })
  fund(
    @CurrentUser() user: CurrentUserPayload,
    @Param('planId') planId: string,
    @Body() dto: FundGrowthPlanDto,
  ) {
    return this.funding.fund(user.merchantId!, planId, dto)
  }
  @Post(':planId/approve')
  @ApiOperation({ summary: 'Approve an option and create the linked Campaign work item' })
  approve(
    @CurrentUser() user: CurrentUserPayload,
    @Param('planId') planId: string,
    @Body() dto: ApproveGrowthPlanDto,
  ) {
    return this.service.approve(user.merchantId!, planId, dto)
  }
}
