import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { PilotInstrumentationQueryDto } from './dto/pilot-instrumentation.dto'
import { PilotInstrumentationService } from './pilot-instrumentation.service'
@ApiTags('V2 试点埋点与指标')
@Controller('admin/pilot-instrumentation') @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN) @ApiBearerAuth()
export class PilotInstrumentationController {
  constructor(private readonly service: PilotInstrumentationService) {}
  @Get('dashboard') @ApiOperation({ summary: '试点验收看板：漏斗、运营监测与 10/50/30/100 目标' })
  dashboard(@Query() query: PilotInstrumentationQueryDto) { return this.service.getDashboard(query) }
}