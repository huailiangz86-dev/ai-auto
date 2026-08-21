// ============================================================
// AI auto - Content Controller
// STORY-AI-020: AI 文案生成端点
// STORY-AI-021: AI 短视频生成端点
// ============================================================

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole } from '@ai-auto/shared'

import { CopywritingService } from './copywriting.service'
import { VideoService } from './video.service'
import { PosterService } from './poster.service'
import {
  GenerateCopywritingDto,
  ConfirmCopywritingDto,
  ListCopywritingDto,
} from './dto/copywriting.dto'

@ApiTags('AI 内容 API')
@Controller('v1/content')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContentController {
  constructor(
    private readonly copywritingService: CopywritingService,
    private readonly videoService: VideoService,
    private readonly posterService: PosterService,
  ) {}

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

  // ========================
  // AI 视频（STORY-AI-021）
  // ========================

  @Post('video/generate')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '创建 AI 视频生成任务（异步）' })
  @HttpCode(HttpStatus.CREATED)
  async generateVideo(
    @CurrentUser() user: { agentId: string },
    @Body()
    body: {
      couponId?: string
      campaignId?: string
      platform: string
      durationSeconds?: number
    },
  ) {
    return this.videoService.generateVideo(user.agentId, {
      couponId: body.couponId,
      campaignId: body.campaignId,
      platform: body.platform as any,
      durationSeconds: body.durationSeconds,
    })
  }

  @Get('video/:contentId/status')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '查询视频生成进度' })
  async getVideoStatus(@Param('contentId') contentId: string) {
    return this.videoService.getJobStatus(contentId)
  }

  @Get('video/:contentId/sse')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '视频生成进度 SSE 订阅（用于 EventSource）' })
  async getVideoSseChannel(@Param('contentId') contentId: string) {
    // 返回 SSE 频道名称，前端用此 channel 订阅 Redis pub/sub 或 SSE
    return { channel: this.videoService.getSseChannel(contentId) }
  }

  @Get('video')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: 'AI 视频历史列表' })
  async listVideos(
    @CurrentUser() user: { agentId: string },
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.videoService.listVideos(user.agentId, page, pageSize)
  }

  // ========================
  // AI 海报（STORY-AI-022）
  // ========================

  @Post('poster/generate')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '生成 AI 海报' })
  @HttpCode(HttpStatus.CREATED)
  async generatePoster(
    @CurrentUser() user: { agentId: string },
    @Body()
    body: {
      couponId?: string
      campaignId?: string
      platform: string
      style?: string
      colorScheme?: string
      variantCount?: number
    },
  ) {
    return this.posterService.generatePoster(user.agentId, {
      couponId: body.couponId,
      campaignId: body.campaignId,
      platform: body.platform as any,
      style: body.style,
      colorScheme: body.colorScheme,
      variantCount: body.variantCount,
    })
  }

  @Get('poster')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: 'AI 海报历史列表' })
  async listPosters(
    @CurrentUser() user: { agentId: string },
    @Query('page') page = 1,
    @Query('pageSize') pageSize = 20,
  ) {
    return this.posterService.listPosters(user.agentId, page, pageSize)
  }
}
