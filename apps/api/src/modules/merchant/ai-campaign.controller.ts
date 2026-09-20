// ============================================================
// AI auto - AI Campaign Controller
// Natural language → AI parse → reviewable campaign draft
// ============================================================

import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole } from '@ai-auto/shared'

import { AICampaignService } from './ai-campaign.service'
import { CreateAICampaignDto, GenerateAIMarketingProductDto } from './dto/ai-campaign.dto'

@ApiTags('AI 活动 API')
@Controller('merchant/ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AICampaignController {
  constructor(private readonly aiCampaignService: AICampaignService) {}

  @Post('campaigns/preview')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({
    summary: 'AI 预览活动与优惠券方案',
    description: '商家输入自然语言，AI 返回可审阅的客户优惠或达人内容执行方案，不会写入数据。',
  })
  @HttpCode(HttpStatus.OK)
  async previewCampaign(
    @CurrentUser() user: { merchantId: string },
    @Body() dto: CreateAICampaignDto,
  ) {
    return this.aiCampaignService.previewCampaign(user.merchantId, dto)
  }

  @Post('campaigns')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({
    summary: 'AI 自然语言创建活动草稿',
    description:
      '商家确认 AI 方案后创建活动草稿；每个活动都会创建转化优惠券，达人内容通过专属链接引导用户领取。',
  })
  @HttpCode(HttpStatus.CREATED)
  async createCampaign(
    @CurrentUser() user: { merchantId: string },
    @Body() dto: CreateAICampaignDto,
  ) {
    return this.aiCampaignService.createCampaignFromDescription(user.merchantId, dto)
  }

  @Post('products/preview')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({
    summary: 'AI 生成营销商品草稿',
    description: '根据自然语言生成商品名称、说明和 SKU 建议；确认保存前不会写入商品目录。',
  })
  @HttpCode(HttpStatus.OK)
  async previewMarketingProduct(
    @CurrentUser() user: { merchantId: string },
    @Body() dto: GenerateAIMarketingProductDto,
  ) {
    return this.aiCampaignService.generateMarketingProduct(user.merchantId, dto)
  }
}
