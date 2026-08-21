// ============================================================
// AI auto - Platform OAuth Service
// OAuth 2.0 authorization flow for Douyin / Xiaohongshu / WeChat Video
// ============================================================

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { lastValueFrom } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { PlatformType } from '@ai-auto/shared'

export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface PlatformUserInfo {
  platformUserId: string
  nickname: string
  avatar?: string
  isEnterpriseAccount: boolean
}

interface PlatformOAuthConfig {
  authorizeUrl: string
  tokenUrl: string
  userInfoUrl: string
  scope: string
}

const PLATFORM_CONFIGS: Record<PlatformType, PlatformOAuthConfig | null> = {
  [PlatformType.DOUYIN]: {
    authorizeUrl: 'https://open.douyin.com/oauth/authorize',
    tokenUrl: 'https://open.douyin.com/oauth/access_token',
    userInfoUrl: 'https://open.douyin.com/oauth/userinfo',
    scope: 'user_info,video_list',
  },
  [PlatformType.XIAOHONGSHU]: {
    authorizeUrl: 'https://api.xiaohongshu.com/oauth2/authorize',
    tokenUrl: 'https://api.xiaohongshu.com/oauth2/access_token',
    userInfoUrl: 'https://api.xiaohongshu.com/oauth2/userinfo',
    scope: 'user.basic_info',
  },
  [PlatformType.VIDEO_ACCOUNT]: {
    authorizeUrl: 'https://open.weixin.qq.com/connect/qrconnect',
    tokenUrl: 'https://api.weixin.qq.com/sns/oauth2/access_token',
    userInfoUrl: 'https://api.weixin.qq.com/sns/userinfo',
    scope: 'snsapi_login',
  },
  [PlatformType.WECHAT]: null,
  [PlatformType.KUAISHOU]: null,
}

@Injectable()
export class PlatformOAuthService {
  private readonly logger = new Logger(PlatformOAuthService.name)

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  // ========================
  // 授权 URL 生成
  // ========================

  buildAuthorizeUrl(platformType: PlatformType, redirectUri: string, state: string): string {
    const cfg = PLATFORM_CONFIGS[platformType]
    if (!cfg) {
      throw new Error(`Unsupported platform: ${platformType}`)
    }

    const clientId = this.getClientId(platformType)

    if (platformType === PlatformType.DOUYIN) {
      const params = new URLSearchParams({
        client_key: clientId,
        redirect_uri: redirectUri,
        scope: cfg.scope,
        response_type: 'code',
        state,
      })
      return `${cfg.authorizeUrl}?${params.toString()}`
    }

    if (platformType === PlatformType.VIDEO_ACCOUNT) {
      const params = new URLSearchParams({
        appid: clientId,
        redirect_uri: redirectUri,
        scope: cfg.scope,
        response_type: 'code',
        state,
      })
      return `${cfg.authorizeUrl}?${params.toString()}&connect_redirect=1#wechat_redirect`
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: cfg.scope,
      response_type: 'code',
      state,
    })
    return `${cfg.authorizeUrl}?${params.toString()}`
  }

  // ========================
  // Token 交换
  // ========================

  async exchangeCodeForToken(
    platformType: PlatformType,
    code: string,
    redirectUri: string,
  ): Promise<OAuthTokens> {
    const cfg = PLATFORM_CONFIGS[platformType]
    if (!cfg) throw new Error(`Unsupported platform: ${platformType}`)

    const clientId = this.getClientId(platformType)
    const clientSecret = this.getClientSecret(platformType)

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }).toString()

    const data = await this.post<Record<string, unknown>>(cfg.tokenUrl, body, platformType)

    return {
      accessToken: String(data['access_token'] ?? data['accessToken'] ?? ''),
      refreshToken: String(data['refresh_token'] ?? data['refreshToken'] ?? ''),
      expiresIn: parseInt(String(data['expires_in'] ?? data['expiresIn'] ?? 7200), 10),
    }
  }

  // ========================
  // Token 刷新
  // ========================

  async refreshToken(platformType: PlatformType, refreshToken: string): Promise<OAuthTokens> {
    const cfg = PLATFORM_CONFIGS[platformType]
    if (!cfg) throw new Error(`Unsupported platform: ${platformType}`)

    const clientId = this.getClientId(platformType)
    const clientSecret = this.getClientSecret(platformType)

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString()

    const data = await this.post<Record<string, unknown>>(cfg.tokenUrl, body, platformType)

    return {
      accessToken: String(data['access_token'] ?? data['accessToken'] ?? ''),
      refreshToken: String(data['refresh_token'] ?? data['refreshToken'] ?? ''),
      expiresIn: parseInt(String(data['expires_in'] ?? data['expiresIn'] ?? 7200), 10),
    }
  }

  // ========================
  // 用户信息获取
  // ========================

  async getUserInfo(platformType: PlatformType, accessToken: string): Promise<PlatformUserInfo> {
    const cfg = PLATFORM_CONFIGS[platformType]
    if (!cfg) throw new Error(`Unsupported platform: ${platformType}`)

    const data = await this.get<Record<string, unknown>>(
      `${cfg.userInfoUrl}?access_token=${encodeURIComponent(accessToken)}`,
      platformType,
    )

    if (platformType === PlatformType.DOUYIN) {
      return {
        platformUserId: String(data['open_id'] ?? data['openid'] ?? ''),
        nickname: String(data['nickname'] ?? ''),
        avatar: data['avatar']
          ? String(data['avatar'])
          : data['avatar_url']
            ? String(data['avatar_url'])
            : undefined,
        isEnterpriseAccount: !!(data['is_enterprise'] ?? false),
      }
    }

    if (platformType === PlatformType.VIDEO_ACCOUNT) {
      return {
        platformUserId: String(data['openid'] ?? data['unionid'] ?? ''),
        nickname: String(data['nickname'] ?? ''),
        avatar: data['headimgurl'] ? String(data['headimgurl']) : undefined,
        isEnterpriseAccount: !!(data['is_enterprise'] ?? false),
      }
    }

    return {
      platformUserId: String(data['id'] ?? data['user_id'] ?? data['openid'] ?? ''),
      nickname: String(data['nickname'] ?? data['name'] ?? ''),
      avatar: data['avatar']
        ? String(data['avatar'])
        : data['profile_image_url']
          ? String(data['profile_image_url'])
          : undefined,
      isEnterpriseAccount: !!(data['is_enterprise'] ?? false),
    }
  }

  // ========================
  // Token 有效性检查
  // ========================

  isTokenExpiringSoon(expireAt: Date): boolean {
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    return expireAt.getTime() - Date.now() < sevenDays
  }

  // ========================
  // 私有工具
  // ========================

  private getClientId(platformType: PlatformType): string {
    const map: Record<string, string> = {
      [PlatformType.DOUYIN]: this.config.get('oauth.douyin.clientId', ''),
      [PlatformType.XIAOHONGSHU]: this.config.get('oauth.xiaohongshu.clientId', ''),
      [PlatformType.VIDEO_ACCOUNT]: this.config.get('oauth.wechat.clientId', ''),
    }
    return map[platformType] ?? ''
  }

  private getClientSecret(platformType: PlatformType): string {
    const map: Record<string, string> = {
      [PlatformType.DOUYIN]: this.config.get('oauth.douyin.clientSecret', ''),
      [PlatformType.XIAOHONGSHU]: this.config.get('oauth.xiaohongshu.clientSecret', ''),
      [PlatformType.VIDEO_ACCOUNT]: this.config.get('oauth.wechat.clientSecret', ''),
    }
    return map[platformType] ?? ''
  }

  private async post<T>(url: string, body: string, platform: PlatformType): Promise<T> {
    const response = await lastValueFrom(
      this.httpService
        .post<T>(url, body, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        })
        .pipe(
          catchError((err) => {
            this.logger.error({
              event: 'oauth_post_error',
              platform,
              url,
              status: err?.response?.status,
              message: err?.message,
            })
            throw err
          }),
        ),
    )
    return response.data
  }

  private async get<T>(url: string, platform: PlatformType): Promise<T> {
    const response = await lastValueFrom(
      this.httpService.get<T>(url, { timeout: 10000 }).pipe(
        catchError((err) => {
          this.logger.error({
            event: 'oauth_get_error',
            platform,
            url,
            status: err?.response?.status,
            message: err?.message,
          })
          throw err
        }),
      ),
    )
    return response.data
  }
}
