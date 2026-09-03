import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { PilotInstrumentationQueryDto } from './dto/pilot-instrumentation.dto'
import { PilotWeeklyEvidenceQueryDto } from './dto/pilot-measurement.dto'
import { PilotInstrumentationService } from './pilot-instrumentation.service'
import { PilotMeasurementService } from './pilot-measurement.service'

@ApiTags('V2 试点埋点与指标')
@Controller('admin/pilot-instrumentation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class PilotInstrumentationController {
  constructor(
    private readonly service: PilotInstrumentationService,
    private readonly measurement: PilotMeasurementService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: '试点验收看板：漏斗、运营监测与 10/50/30/100 目标' })
  dashboard(@Query() query: PilotInstrumentationQueryDto) {
    return this.service.getDashboard(query)
  }

  @Get('weekly-evidence')
  @ApiOperation({ summary: '从同意、领券、核销、Creator 报酬聚合周度证据，并返回逐笔差异清单' })
  weeklyEvidence(@Query() query: PilotWeeklyEvidenceQueryDto) {
    return this.measurement.weeklyEvidence(query)
  }

  @Get('operations-metrics')
  @ApiOperation({
    summary: '运营看板：重复 Campaign、预算扩张、有效任务接受率和可测量 Campaign 占比',
  })
  operationsMetrics() {
    return this.measurement.operationsMetrics()
  }
}
