// ============================================================
// AI auto - Merchant campaign idea recommendations
// ============================================================

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { CampaignRecommendationService } from './campaign-recommendation.service'
import { ListCampaignRecommendationsDto } from './dto/campaign-recommendation.dto'

@ApiTags('AI 活动创意推荐 API')
@Controller('merchant/ai/campaign-recommendations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT_ADMIN)
@ApiBearerAuth()
export class CampaignRecommendationController {
  constructor(private readonly recommendationService: CampaignRecommendationService) {}

  @Get()
  @ApiOperation({ summary: '获取基于节假日、历史活动和客户画像的 AI 活动创意' })
  async list(@CurrentUser() user: { id: string }, @Query() query: ListCampaignRecommendationsDto) {
    return this.recommendationService.list(user.id, query.limit)
  }

  @Post(':recommendationId/launch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '一键创建并发布 AI 推荐活动' })
  async launch(
    @CurrentUser() user: { id: string },
    @Param('recommendationId') recommendationId: string,
  ) {
    return this.recommendationService.launch(user.id, recommendationId)
  }
}
