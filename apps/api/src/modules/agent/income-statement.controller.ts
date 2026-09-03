import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Response } from 'express'
import { UserRole } from '@ai-auto/shared'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { IncomeStatementQueryDto } from './dto/income-statement.dto'
import { IncomeStatementService } from './income-statement.service'

@ApiTags('分享员收入证明')
@Controller('agent/income-statements')
@UseGuards(JwtAuthGuard)
@Roles(UserRole.AGENT)
@ApiBearerAuth()
export class IncomeStatementController {
  constructor(private readonly incomeStatementService: IncomeStatementService) {}
  @Get() @ApiOperation({ summary: '年度或自定义区间佣金收入明细' }) data(
    @CurrentUser() user: { agentId: string },
    @Query() query: IncomeStatementQueryDto,
  ) {
    return this.incomeStatementService.getData(user.agentId, query)
  }
  @Get('pdf') @ApiOperation({ summary: '下载带收入证明章的 PDF' }) async pdf(
    @CurrentUser() user: { agentId: string },
    @Query() query: IncomeStatementQueryDto,
    @Res() response: Response,
  ) {
    const { data, file } = await this.incomeStatementService.renderPdf(user.agentId, query)
    const suffix = query.year ? String(query.year) : 'custom'
    response.setHeader('Content-Type', 'application/pdf')
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="income-statement-${suffix}.pdf"`,
    )
    response.setHeader('X-Income-Period', encodeURIComponent(data.period))
    response.send(file)
  }
}
