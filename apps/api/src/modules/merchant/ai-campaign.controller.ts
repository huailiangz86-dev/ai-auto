// ============================================================
// AI auto - AI Campaign Controller
// Natural language → AI parse → auto-create → auto-publish
// ============================================================

import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole } from '@ai-auto/shared'

import { AICampaignService } from './ai-campaign.service'
import { CreateAICampaignDto } from './dto/ai-campaign.dto'

@ApiTags('AI 活动 API')
@Controller('merchant/ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AICampaignController {
  constructor(private readonly aiCampaignService: AICampaignService) {}

  @Post('campaigns')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({
    summary: 'AI 自然语言创建活动（自动解析并发布）',
    description: '商家输入中文描述，AI 自动解析配置并创建发布活动。无需手动确认。',
  })
  @HttpCode(HttpStatus.CREATED)
  async createCampaign(
    @CurrentUser() user: { merchantId: string },
    @Body() dto: CreateAICampaignDto,
  ) {
    return this.aiCampaignService.createCampaignFromDescription(user.merchantId, dto)
  }
}
