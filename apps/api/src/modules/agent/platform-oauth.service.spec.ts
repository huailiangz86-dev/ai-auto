// ============================================================
// AI auto - PlatformOAuthService Unit Tests
// OAuth authorization flow for Douyin / Xiaohongshu / WeChat Video
// ============================================================

import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { PlatformOAuthService } from './platform-oauth.service'
import { PlatformType } from '@ai-auto/shared'
import { of } from 'rxjs'

describe('PlatformOAuthService', () => {
  let service: PlatformOAuthService
  let config: any
  let httpService: any

  const mockHttp = (data: any, status = 200) => {
    return of({ data, status })
  }

  beforeEach(async () => {
    config = {
      get: jest.fn((key: string, fallback = '') => {
        const map: Record<string, string> = {
          'oauth.douyin.clientId': 'douyin_client_id',
          'oauth.douyin.clientSecret': 'douyin_client_secret',
          'oauth.xiaohongshu.clientId': 'xhs_client_id',
          'oauth.xiaohongshu.clientSecret': 'xhs_client_secret',
          'oauth.wechat.clientId': 'wechat_client_id',
          'oauth.wechat.clientSecret': 'wechat_client_secret',
          'oauth.kuaishou.clientId': 'kuaishou_client_id',
          'oauth.kuaishou.clientSecret': 'kuaishou_client_secret',
          'app.baseUrl': 'https://ai-auto.example.com',
        }
        return map[key] ?? fallback
      }),
    }

    httpService = {
      post: jest.fn(),
      get: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformOAuthService,
        { provide: ConfigService, useValue: config },
        { provide: HttpService, useValue: httpService },
      ],
    }).compile()

    service = module.get<PlatformOAuthService>(PlatformOAuthService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ========================
  // buildAuthorizeUrl()
  // ========================

  describe('buildAuthorizeUrl()', () => {
    it('抖音授权 URL 包含正确参数', () => {
      const url = service.buildAuthorizeUrl(
        PlatformType.DOUYIN,
        'https://app.example.com/oauth/callback',
        'state_abc123',
      )

      expect(url).toContain('open.douyin.com/oauth/authorize')
      expect(url).toContain('client_key=douyin_client_id')
      expect(url).toContain('redirect_uri=')
      expect(url).toContain('scope=')
      expect(url).toContain('state=state_abc123')
    })

    it('视频号授权 URL 包含 appid 参数', () => {
      const url = service.buildAuthorizeUrl(
        PlatformType.VIDEO_ACCOUNT,
        'https://app.example.com/oauth/callback',
        'state_xyz',
      )

      expect(url).toContain('open.weixin.qq.com/connect/qrconnect')
      expect(url).toContain('appid=wechat_client_id')
      expect(url).toContain('state=state_xyz')
      expect(url).toContain('wechat_redirect')
    })

    it('小红书授权 URL 格式正确', () => {
      const url = service.buildAuthorizeUrl(
        PlatformType.XIAOHONGSHU,
        'https://app.example.com/oauth/callback',
        'state_xhs',
      )

      expect(url).toContain('xiaohongshu.com')
      expect(url).toContain('client_id=xhs_client_id')
    })

    it('微信平台抛出错误', () => {
      expect(() =>
        service.buildAuthorizeUrl(PlatformType.WECHAT, 'https://app.com/callback', 'state'),
      ).toThrow('Unsupported platform')
    })

    it('快手授权 URL 包含视频发布权限', () => {
      const url = service.buildAuthorizeUrl(
        PlatformType.KUAISHOU,
        'https://app.com/callback',
        'state_kuaishou',
      )

      expect(url).toContain('open.kuaishou.com/oauth2/authorize')
      expect(url).toContain('app_id=kuaishou_client_id')
      expect(url).toContain('user_video_publish')
      expect(url).toContain('state=state_kuaishou')
    })
  })

  // ========================
  // exchangeCodeForToken()
  // ========================

  describe('exchangeCodeForToken()', () => {
    it('正确解析抖音 Token 响应（snake_case）', async () => {
      httpService.post.mockReturnValueOnce(
        mockHttp({
          access_token: 'access_abc123',
          refresh_token: 'refresh_xyz',
          expires_in: 86400,
        }),
      )

      const result = await service.exchangeCodeForToken(
        PlatformType.DOUYIN,
        'auth_code_123',
        'https://app.example.com/callback',
      )

      expect(result.accessToken).toBe('access_abc123')
      expect(result.refreshToken).toBe('refresh_xyz')
      expect(result.expiresIn).toBe(86400)
    })

    it('正确解析视频号 Token 响应（camelCase）', async () => {
      httpService.post.mockReturnValueOnce(
        mockHttp({
          accessToken: 'access_video',
          refreshToken: 'refresh_video',
          expiresIn: 7200,
        }),
      )

      const result = await service.exchangeCodeForToken(
        PlatformType.VIDEO_ACCOUNT,
        'auth_code_video',
        'https://app.example.com/callback',
      )

      expect(result.accessToken).toBe('access_video')
      expect(result.expiresIn).toBe(7200)
    })

    it('缺失字段使用默认值', async () => {
      httpService.post.mockReturnValueOnce(mockHttp({}))

      const result = await service.exchangeCodeForToken(
        PlatformType.DOUYIN,
        'code',
        'https://app.example.com/callback',
      )

      expect(result.accessToken).toBe('')
      expect(result.refreshToken).toBe('')
      expect(result.expiresIn).toBe(7200)
    })

    it('使用快手授权码交换接口并保存 open_id', async () => {
      httpService.get.mockReturnValueOnce(
        mockHttp({
          result: 1,
          access_token: 'ks_access',
          refresh_token: 'ks_refresh',
          expires_in: 172800,
          open_id: 'ks_open_id',
        }),
      )

      const result = await service.exchangeCodeForToken(
        PlatformType.KUAISHOU,
        'kuaishou_code',
        'https://app.example.com/callback',
      )

      expect(httpService.get).toHaveBeenCalledWith(
        'https://open.kuaishou.com/oauth2/access_token',
        expect.objectContaining({
          params: expect.objectContaining({ app_id: 'kuaishou_client_id' }),
        }),
      )
      expect(result.platformUserId).toBe('ks_open_id')
      expect(result.expiresIn).toBe(172800)
    })
  })

  // ========================
  // refreshToken()
  // ========================

  describe('refreshToken()', () => {
    it('正确刷新 Token', async () => {
      httpService.post.mockReturnValueOnce(
        mockHttp({
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 86400,
        }),
      )

      const result = await service.refreshToken(PlatformType.DOUYIN, 'old_refresh_token')

      expect(result.accessToken).toBe('new_access_token')
      expect(result.refreshToken).toBe('new_refresh_token')
    })

    it('快手刷新 token 时使用 GET 接口', async () => {
      httpService.get.mockReturnValueOnce(
        mockHttp({ result: 1, access_token: 'new_ks_access', refresh_token: 'new_ks_refresh' }),
      )

      const result = await service.refreshToken(PlatformType.KUAISHOU, 'old_ks_refresh')

      expect(httpService.get).toHaveBeenCalledWith(
        'https://open.kuaishou.com/oauth2/refresh_token',
        expect.objectContaining({
          params: expect.objectContaining({ refresh_token: 'old_ks_refresh' }),
        }),
      )
      expect(result.accessToken).toBe('new_ks_access')
    })
  })

  // ========================
  // getUserInfo()
  // ========================

  describe('getUserInfo()', () => {
    it('解析抖音用户信息', async () => {
      httpService.get.mockReturnValueOnce(
        mockHttp({
          open_id: 'douyin_user_123',
          nickname: '抖音达人小王',
          avatar: 'https://avatar.example.com/douyin.jpg',
          is_enterprise: true,
        }),
      )

      const result = await service.getUserInfo(PlatformType.DOUYIN, 'access_token_123')

      expect(result.platformUserId).toBe('douyin_user_123')
      expect(result.nickname).toBe('抖音达人小王')
      expect(result.avatar).toBe('https://avatar.example.com/douyin.jpg')
      expect(result.isEnterpriseAccount).toBe(true)
    })

    it('解析视频号用户信息', async () => {
      httpService.get.mockReturnValueOnce(
        mockHttp({
          openid: 'wechat_user_456',
          nickname: '视频号达人',
          headimgurl: 'https://avatar.example.com/wechat.jpg',
          is_enterprise: false,
        }),
      )

      const result = await service.getUserInfo(PlatformType.VIDEO_ACCOUNT, 'access_token_456')

      expect(result.platformUserId).toBe('wechat_user_456')
      expect(result.nickname).toBe('视频号达人')
      expect(result.isEnterpriseAccount).toBe(false)
    })

    it('解析快手用户信息', async () => {
      httpService.get.mockReturnValueOnce(
        mockHttp({
          result: 1,
          user_info: {
            open_id: 'ks_user_123',
            name: '快手达人',
            head: 'https://avatar.example.com/ks.jpg',
          },
        }),
      )

      const result = await service.getUserInfo(PlatformType.KUAISHOU, 'ks_access_token')

      expect(result.platformUserId).toBe('ks_user_123')
      expect(result.nickname).toBe('快手达人')
      expect(result.avatar).toBe('https://avatar.example.com/ks.jpg')
    })
  })

  // ========================
  // isTokenExpiringSoon()
  // ========================

  describe('isTokenExpiringSoon()', () => {
    it('Token 5 天内过期返回 true', () => {
      const expireAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      expect(service.isTokenExpiringSoon(expireAt)).toBe(true)
    })

    it('Token 10 天后过期返回 false', () => {
      const expireAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
      expect(service.isTokenExpiringSoon(expireAt)).toBe(false)
    })

    it('Token 刚好 7 天后过期返回 false', () => {
      const expireAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      expect(service.isTokenExpiringSoon(expireAt)).toBe(false)
    })
  })
})
