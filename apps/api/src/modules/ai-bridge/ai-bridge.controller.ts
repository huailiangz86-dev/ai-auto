// ============================================================
// AI Bridge Controller - Proxies requests to AI Agent service
// ============================================================

import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { AIBridgeService } from './ai-bridge.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AIBridgeController {
  constructor(private aiBridge: AIBridgeService) {}

  @Post('campaign/configure')
  async configureCampaign(@Body() dto: any) {
    return this.aiBridge.configureCampaign(dto)
  }

  @Post('campaign/optimize')
  async optimizeCampaign(@Body() dto: any) {
    return this.aiBridge.optimizeCampaign(dto)
  }

  @Post('content/copywriting')
  async generateCopywriting(@Body() dto: any) {
    return this.aiBridge.generateCopywriting(dto)
  }

  @Post('content/video')
  async generateVideo(@Body() dto: any) {
    return this.aiBridge.generateVideo(dto)
  }

  @Post('content/poster')
  async generatePoster(@Body() dto: any) {
    return this.aiBridge.generatePoster(dto)
  }

  @Post('moderation/check')
  async moderateContent(@Body() dto: any) {
    return this.aiBridge.moderateContent(dto)
  }
}
