import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'
import { CurrentUser, CurrentUserPayload } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import {
  CreateRiskRuleDto,
  ListRiskRulesDto,
  ToggleRiskRuleDto,
  UpdateRiskRuleDto,
} from './dto/risk-rule.dto'
import { RiskRuleService } from './risk-rule.service'

@ApiTags('运营风控规则')
@Controller(['admin/risk-rules', 'admin/fraud/rules'])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class RiskRuleController {
  constructor(private readonly service: RiskRuleService) {}
  private actor(user: CurrentUserPayload) {
    return { id: user.id, name: user.username }
  }

  @Get()
  @ApiOperation({ summary: '风控规则配置列表' })
  list(@Query() query: ListRiskRulesDto) {
    return this.service.list(query)
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '新增风控规则' })
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateRiskRuleDto) {
    return this.service.create(dto, this.actor(user))
  }

  @Patch(':ruleId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '编辑风控规则' })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('ruleId') id: string,
    @Body() dto: UpdateRiskRuleDto,
  ) {
    return this.service.update(id, dto, this.actor(user))
  }

  @Post(':ruleId/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '启用或停用风控规则' })
  toggle(
    @CurrentUser() user: CurrentUserPayload,
    @Param('ruleId') id: string,
    @Body() dto: ToggleRiskRuleDto,
  ) {
    return this.service.toggle(id, dto.enabled, this.actor(user))
  }

  @Delete(':ruleId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '删除风控规则（软删除）' })
  remove(@CurrentUser() user: CurrentUserPayload, @Param('ruleId') id: string) {
    return this.service.remove(id, this.actor(user))
  }
}
