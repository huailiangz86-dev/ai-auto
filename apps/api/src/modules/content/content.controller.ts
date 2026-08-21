// ============================================================
// AI auto - Content Controller
// STORY-AI-020: AI 文案生成端点
// ============================================================

import { Controller, Get, Post, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole } from '@ai-auto/shared'

import { CopywritingService } from './copywriting.service'
import {
  GenerateCopywritingDto,
  ConfirmCopywritingDto,
  ListCopywritingDto,
} from './dto/copywriting.dto'

@ApiTags('AI 文案 API')
@Controller('v1/content')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContentController {
  constructor(private readonly copywritingService: CopywritingService) {}

  // ========================
  // AI 文案（STORY-AI-020）
  // ========================

  @Get('copywriting/estimate')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '预估 AI 文案 Token 费用' })
  async estimateCopywriting(@CurrentUser() user: { agentId: string }, @Query('count') count = 3) {
    return this.copywritingService.estimateCostAsync(user.agentId, count)
  }

  @Post('copywriting/generate')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '生成 AI 文案（创建草稿）' })
  @HttpCode(HttpStatus.CREATED)
  async generateCopywriting(
    @CurrentUser() user: { agentId: string },
    @Body() dto: GenerateCopywritingDto,
  ) {
    return this.copywritingService.generateCopywriting(user.agentId, dto)
  }

  @Post('copywriting/confirm')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '确认文案选择（正式发布+扣费）' })
  @HttpCode(HttpStatus.OK)
  async confirmCopywriting(
    @CurrentUser() user: { agentId: string },
    @Body() dto: ConfirmCopywritingDto,
  ) {
    return this.copywritingService.confirmCopywriting(user.agentId, dto)
  }

  @Get('copywriting')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: 'AI 文案历史列表' })
  async listCopywriting(
    @CurrentUser() user: { agentId: string },
    @Query() query: ListCopywritingDto,
  ) {
    return this.copywritingService.listCopywriting(user.agentId, query)
  }
}
