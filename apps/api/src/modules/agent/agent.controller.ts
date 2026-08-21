// ============================================================
// AI auto - Agent Controller
// Platform account binding via OAuth 2.0
// STORY-AI-015: OAuth 授权接入
// STORY-AI-024: 抖音企业号接入
// ============================================================

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Res,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Response } from 'express'

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole, PlatformType } from '@ai-auto/shared'

import { PlatformOAuthService } from './platform-oauth.service'
import {
  GetOAuthUrlDto,
  OAuthCallbackDto,
  BindingResultDto,
  PlatformAccountDto,
  RefreshTokenDto,
  UnbindPlatformDto,
  OAuthStatusDto,
} from './dto/platform-binding.dto'

@ApiTags('分享员平台账号')
@Controller('v1/agent/platforms')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgentController {
  constructor(private readonly oauthService: PlatformOAuthService) {}

  // ========================
  // OAuth 授权
  // ========================

  @Get('authorize')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '获取平台 OAuth 授权 URL' })
  async getAuthorizeUrl(@CurrentUser() user: { agentId: string }, @Query() query: GetOAuthUrlDto) {
    const state = `agent_${user.agentId}_${Date.now()}`
    const redirectUri =
      query.redirectUri ??
      `${process.env['API_BASE_URL'] ?? 'https://api.ai-auto.example.com'}/v1/agent/platforms/callback`

    const authorizeUrl = this.oauthService.buildAuthorizeUrl(query.platformType, redirectUri, state)

    return {
      authorizeUrl,
      platformType: query.platformType,
      state,
    }
  }

  @Get('callback')
  @ApiOperation({ summary: 'OAuth 回调（平台重定向到此）' })
  async handleCallback(@Query() query: OAuthCallbackDto, @Res() res: Response) {
    // 有错误直接跳转回前端错误页
    if (query.error) {
      const errorMsg = encodeURIComponent(query.errorDescription ?? query.error)
      return res.redirect(
        `${process.env['FRONTEND_URL'] ?? 'https://ai-auto.example.com'}/bind/failed?reason=${errorMsg}`,
      )
    }

    // 返回 code 给前端（前端再调用 /bind 完成绑定）
    return res.redirect(
      `${process.env['FRONTEND_URL'] ?? 'https://ai-auto.example.com'}/bind/success?code=${query.code}&state=${query.state ?? ''}`,
    )
  }

  // ========================
  // 账号绑定管理
  // ========================

  @Post('bind')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '完成平台账号绑定（交换 token）' })
  @HttpCode(HttpStatus.CREATED)
  async bindPlatform(
    @CurrentUser() user: { agentId: string },
    @Body() body: { code: string; platformType: PlatformType; state?: string },
  ): Promise<BindingResultDto> {
    const redirectUri = `${process.env['API_BASE_URL'] ?? 'https://api.ai-auto.example.com'}/v1/agent/platforms/callback`

    // 交换 token
    const tokens = await this.oauthService.exchangeCodeForToken(
      body.platformType,
      body.code,
      redirectUri,
    )

    // 获取用户信息
    const userInfo = await this.oauthService.getUserInfo(body.platformType, tokens.accessToken)

    // TODO: 保存到 AgentPlatformAccount
    // const binding = await this.platformAccountRepo.save({ ... })

    return {
      bindingId: 'pending-implementation',
      platformType: body.platformType,
      platformNickname: userInfo.nickname,
      isActive: true,
      tokenExpireAt: new Date(Date.now() + tokens.expiresIn * 1000),
      isEnterpriseAccount: userInfo.isEnterpriseAccount,
    }
  }

  @Get()
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '查询已绑定的平台账号列表' })
  async listPlatformAccounts(@CurrentUser() user: { agentId: string }) {
    // TODO: 从 AgentPlatformAccount 查询
    return { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }
  }

  @Get(':bindingId')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '查询单个平台账号详情' })
  async getPlatformAccount(
    @CurrentUser() user: { agentId: string },
    @Param('bindingId') bindingId: string,
  ) {
    // TODO: 从 AgentPlatformAccount 查询
    throw new NotFoundException({ code: 9001, message: '绑定记录不存在' })
  }

  @Post(':bindingId/refresh')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '刷新平台 Access Token' })
  async refreshPlatformToken(
    @CurrentUser() user: { agentId: string },
    @Param('bindingId') bindingId: string,
  ) {
    // TODO: 从 AgentPlatformAccount 获取 refresh token 并刷新
    throw new NotFoundException({ code: 9001, message: '绑定记录不存在' })
  }

  @Delete(':bindingId')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '解除平台账号绑定' })
  @HttpCode(HttpStatus.OK)
  async unbindPlatform(
    @CurrentUser() user: { agentId: string },
    @Param('bindingId') bindingId: string,
    @Body() body: UnbindPlatformDto,
  ) {
    // TODO: 解除绑定
    throw new NotFoundException({ code: 9001, message: '绑定记录不存在' })
  }

  @Get('status/:platformType')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '查询指定平台的授权状态' })
  async getPlatformStatus(
    @CurrentUser() user: { agentId: string },
    @Param('platformType') platformType: PlatformType,
  ): Promise<OAuthStatusDto> {
    // TODO: 查询 AgentPlatformAccount
    return {
      platformType,
      isAuthorized: false,
    }
  }
}
