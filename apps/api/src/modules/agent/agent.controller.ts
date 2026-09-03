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
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole, PlatformType } from '@ai-auto/shared'

import { PlatformOAuthService } from './platform-oauth.service'
import { AgentPlatformAccount } from './entities/agent-platform-account.entity'
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
@Controller('agent/platforms')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AgentController {
  constructor(
    private readonly oauthService: PlatformOAuthService,
    @InjectRepository(AgentPlatformAccount)
    private readonly platformAccountRepo: Repository<AgentPlatformAccount>,
  ) {}

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

    const now = new Date()
    const platformUserId = userInfo.platformUserId || tokens.platformUserId
    if (!platformUserId) {
      throw new BadRequestException('平台未返回可用于绑定的账号标识')
    }

    const existing = await this.platformAccountRepo.findOne({
      where: { agentId: user.agentId, platformType: body.platformType },
      withDeleted: true,
    })
    const binding = this.platformAccountRepo.create({
      ...(existing ?? {}),
      agentId: user.agentId,
      platformType: body.platformType,
      platformUserId,
      platformNickname: userInfo.nickname || null,
      platformAvatar: userInfo.avatar ?? null,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpireAt: new Date(now.getTime() + tokens.expiresIn * 1000),
      isEnterpriseAccount: userInfo.isEnterpriseAccount,
      status: true,
      boundAt: existing?.boundAt ?? now,
      deactivatedAt: null,
      unbindAt: null,
      deletedAt: null,
    })
    const saved = await this.platformAccountRepo.save(binding)

    return {
      bindingId: saved.id,
      platformType: body.platformType,
      platformNickname: saved.platformNickname ?? '',
      isActive: true,
      tokenExpireAt: saved.tokenExpireAt,
      isEnterpriseAccount: saved.isEnterpriseAccount,
    }
  }

  @Get()
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '查询已绑定的平台账号列表' })
  async listPlatformAccounts(@CurrentUser() user: { agentId: string }) {
    const items = await this.platformAccountRepo.find({
      where: { agentId: user.agentId },
      order: { boundAt: 'DESC' },
    })
    return {
      items: items.map((item) => this.toPlatformAccountDto(item)),
      pagination: { page: 1, pageSize: 20, total: items.length, totalPages: 1 },
    }
  }

  @Get(':bindingId')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '查询单个平台账号详情' })
  async getPlatformAccount(
    @CurrentUser() user: { agentId: string },
    @Param('bindingId') bindingId: string,
  ) {
    const account = await this.findAccount(user.agentId, bindingId)
    return this.toPlatformAccountDto(account)
  }

  @Post(':bindingId/refresh')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '刷新平台 Access Token' })
  async refreshPlatformToken(
    @CurrentUser() user: { agentId: string },
    @Param('bindingId') bindingId: string,
  ) {
    const account = await this.platformAccountRepo.findOne({
      where: { id: bindingId, agentId: user.agentId },
      select: {
        id: true,
        agentId: true,
        platformType: true,
        refreshToken: true,
      },
    })
    if (!account?.refreshToken) {
      throw new NotFoundException({ code: 9001, message: '绑定记录不存在或无法刷新' })
    }
    const tokens = await this.oauthService.refreshToken(account.platformType, account.refreshToken)
    const tokenExpireAt = new Date(Date.now() + tokens.expiresIn * 1000)
    await this.platformAccountRepo.update(
      { id: account.id, agentId: user.agentId },
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpireAt,
        status: true,
        deactivatedAt: null,
      },
    )
    return { bindingId: account.id, tokenExpireAt, isActive: true }
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
    await this.findAccount(user.agentId, bindingId)
    await this.platformAccountRepo.update(
      { id: bindingId, agentId: user.agentId },
      {
        status: false,
        accessToken: null,
        refreshToken: null,
        unbindAt: new Date(),
      },
    )
    return { bindingId, isActive: false, reason: body.reason ?? null }
  }

  @Get('status/:platformType')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: '查询指定平台的授权状态' })
  async getPlatformStatus(
    @CurrentUser() user: { agentId: string },
    @Param('platformType') platformType: PlatformType,
  ): Promise<OAuthStatusDto> {
    const [boundCount, activeAccount] = await Promise.all([
      this.platformAccountRepo.count({ where: { agentId: user.agentId, platformType } }),
      this.platformAccountRepo.findOne({
        where: { agentId: user.agentId, platformType, status: true },
        order: { boundAt: 'DESC' },
        select: {
          id: true,
          agentId: true,
          platformType: true,
          status: true,
          accessToken: true,
          tokenExpireAt: true,
        },
      }),
    ])
    return {
      platformType,
      isAuthorized: Boolean(activeAccount?.accessToken),
      boundCount,
      tokenExpireAt: activeAccount?.tokenExpireAt ?? null,
      needsReauthorize:
        !activeAccount?.accessToken ||
        !activeAccount.tokenExpireAt ||
        this.oauthService.isTokenExpiringSoon(activeAccount.tokenExpireAt),
    }
  }

  private async findAccount(agentId: string, bindingId: string): Promise<AgentPlatformAccount> {
    const account = await this.platformAccountRepo.findOne({ where: { id: bindingId, agentId } })
    if (!account) throw new NotFoundException({ code: 9001, message: '绑定记录不存在' })
    return account
  }

  private toPlatformAccountDto(account: AgentPlatformAccount): PlatformAccountDto {
    return {
      id: account.id,
      platformType: account.platformType,
      platformNickname: account.platformNickname,
      platformAvatar: account.platformAvatar,
      boundAt: account.boundAt,
      tokenExpireAt: account.tokenExpireAt,
      isActive: account.status,
      isEnterpriseAccount: account.isEnterpriseAccount,
      totalImpressions: Number(account.totalImpressions),
      totalClicks: Number(account.totalClicks),
      totalClaims: Number(account.totalClaims),
    }
  }
}
