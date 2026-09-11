// ============================================================
// AI auto - Douyin Service
// STORY-AI-024: 抖音企业号接入
// 视频上传 → 发布 → 追踪回推 → 统计拉取
// ============================================================

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { lastValueFrom, throwError } from 'rxjs'
import { catchError } from 'rxjs/operators'
import { PlatformType } from '@ai-auto/shared'

// 抖音 Open API 基础 URL
const DOUYIN_API_BASE = 'https://open.douyin.com'

export interface DouyinVideoPublishParams {
  accessToken: string
  openId: string
  videoPath: string // HTTPS 视频源地址
  title: string
  description?: string
  atUsers?: string[] // @用户
  topics?: string[] // 话题
  coverTimestamp?: number // 封面时间戳（毫秒）
  poiId?: string // 门店 ID
  gameId?: string // 游戏 ID
  productId?: string // 商品 ID
}

export interface DouyinPublishResult {
  videoId: string
  videoUrl: string
  errorCode?: string
  errorMsg?: string
}

export interface DouyinVideoStats {
  videoId: string
  playCount: number // 播放量
  likeCount: number // 点赞数
  commentCount: number // 评论数
  shareCount: number // 分享数
  collectCount: number // 收藏数
  downloadCount: number // 下载数（企业号）
}

@Injectable()
export class DouyinService {
  private readonly logger = new Logger(DouyinService.name)

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  // ========================
  // 视频发布
  // ========================

  /**
   * 上传视频到抖音并发布
   * 流程：上传视频文件 → 发布视频 → 返回 video_id
   */
  async uploadAndPublish(params: DouyinVideoPublishParams): Promise<DouyinPublishResult> {
    const { accessToken, openId, videoPath, title, description } = params

    // Step 1: 上传视频文件获取 video_id
    const uploadResult = await this.uploadVideo(accessToken, openId, videoPath)
    if (uploadResult.errorCode || !uploadResult.videoId) {
      return {
        videoId: '',
        videoUrl: '',
        errorCode: uploadResult.errorCode ?? 'UPLOAD_FAILED',
        errorMsg: uploadResult.errorMsg ?? '上传失败',
      }
    }

    // Step 2: 发布视频
    const publishResult = await this.publishVideo(accessToken, {
      videoId: uploadResult.videoId, title, description, openId,
      atUsers: params.atUsers, topics: params.topics, coverTimestamp: params.coverTimestamp,
    })

    return publishResult
  }

  /**
   * 上传视频文件到抖音服务器
   */
  async uploadVideo(
    accessToken: string,
    openId: string,
    videoPath: string,
  ): Promise<{
    videoId?: string
    videoUrl?: string
    errorCode?: string
    errorMsg?: string
  }> {
    try {
      const sourceUrl = new URL(videoPath)
      if (sourceUrl.protocol !== 'https:') {
        return { errorCode: 'INVALID_VIDEO_SOURCE', errorMsg: '抖音自动发布仅接受 HTTPS 视频源地址' }
      }
      this.logger.log({ event: 'douyin_video_upload', host: sourceUrl.host })
      const source = await fetch(sourceUrl, { signal: AbortSignal.timeout(60_000) })
      const contentLength = Number(source.headers.get('content-length') ?? 0)
      if (!source.ok || contentLength > 300 * 1024 * 1024) {
        return { errorCode: 'VIDEO_FETCH_FAILED', errorMsg: '无法获取视频，或视频超过 300MB' }
      }
      const media = await source.blob()
      if (media.size > 300 * 1024 * 1024) {
        return { errorCode: 'VIDEO_TOO_LARGE', errorMsg: '视频超过 300MB，请使用分片上传' }
      }
      const form = new FormData()
      form.append('video', media, 'video.mp4')
      const response = await fetch(`${DOUYIN_API_BASE}/api/douyin/v1/video/upload_video/?open_id=${encodeURIComponent(openId)}`, {
        method: 'POST', headers: { 'access-token': accessToken }, body: form, signal: AbortSignal.timeout(90_000),
      })
      const payload = await response.json().catch(() => ({})) as { data?: { video?: { video_id?: string }; error_code?: number; description?: string }; extra?: { error_code?: number; description?: string } }
      const errorCode = payload.data?.error_code ?? payload.extra?.error_code
      const videoId = payload.data?.video?.video_id
      if (!response.ok || errorCode || !videoId) {
        return { errorCode: String(errorCode ?? response.status), errorMsg: payload.data?.description ?? payload.extra?.description ?? '抖音视频上传失败' }
      }
      return { videoId }
    } catch (error) {
      this.logger.error({ event: 'douyin_upload_failed', error: String(error) })
      return {
        errorCode: 'UPLOAD_FAILED',
        errorMsg: '视频上传失败',
      }
    }
  }

  /**
   * 发布已上传的视频
   */
  async publishVideo(
    accessToken: string,
    params: {
      videoId: string
      title: string
      description?: string
      openId: string
      atUsers?: string[]
      topics?: string[]
      coverTimestamp?: number
    },
  ): Promise<DouyinPublishResult> {
    try {
      const result = await lastValueFrom(
        this.httpService
          .post(
            `${DOUYIN_API_BASE}/api/douyin/v1/video/create_video/`,
            {
              video_id: params.videoId,
              text: this.composeText(params.title, params.description, params.topics),
              ...(params.atUsers?.length ? { at_users: params.atUsers } : {}),
              ...(params.coverTimestamp !== undefined ? { cover_tsp: params.coverTimestamp } : {}),
            },
            { params: { open_id: params.openId }, headers: { 'access-token': accessToken } },
          )
          .pipe(catchError((err) => throwError(() => err))),
      )

      const payload = result.data as { data?: { item_id?: string; video_id?: string; error_code?: number; description?: string }; extra?: { error_code?: number; description?: string } }
      const errorCode = payload.data?.error_code ?? payload.extra?.error_code
      const videoId = payload.data?.item_id ?? payload.data?.video_id
      if (errorCode || !videoId) {
        return { videoId: '', videoUrl: '', errorCode: String(errorCode ?? 'CREATE_VIDEO_FAILED'), errorMsg: payload.data?.description ?? payload.extra?.description ?? '抖音视频创建失败' }
      }
      const videoUrl = `https://www.douyin.com/video/${videoId}`

      this.logger.log({ event: 'douyin_publish_success', videoId })

      return {
        videoId,
        videoUrl,
      }
    } catch (error) {
      this.logger.error({ event: 'douyin_publish_failed', error: String(error) })
      return {
        videoId: params.videoId,
        videoUrl: '',
        errorCode: 'PUBLISH_FAILED',
        errorMsg: '视频发布失败',
      }
    }
  }

  // ========================
  // 统计数据
  // ========================

  /**
   * 获取视频统计数据
   */
  async getVideoStats(accessToken: string, videoId: string): Promise<DouyinVideoStats | null> {
    try {
      const result = await lastValueFrom(
        this.httpService
          .get(`${DOUYIN_API_BASE}/video/data/get/`, {
            params: {
              access_token: accessToken,
              video_ids: videoId,
            },
          })
          .pipe(catchError((err) => throwError(() => err))),
      )

      const payload = result.data as { data?: { video_list?: Array<Record<string, unknown>>; list?: Array<Record<string, unknown>>; error_code?: number } }
      const record = payload.data?.video_list?.[0] ?? payload.data?.list?.[0]
      if (payload.data?.error_code || !record) return null
      this.logger.log({ event: 'douyin_stats_fetched', videoId })
      return {
        videoId,
        playCount: Number(record['play_count'] ?? 0),
        likeCount: Number(record['like_count'] ?? 0),
        commentCount: Number(record['comment_count'] ?? 0),
        shareCount: Number(record['share_count'] ?? 0),
        collectCount: Number(record['collect_count'] ?? 0),
        downloadCount: Number(record['download_count'] ?? 0),
      }
    } catch (error) {
      this.logger.error({ event: 'douyin_stats_failed', videoId, error: String(error) })
      return null
    }
  }

  // ========================
  // 追踪回调配置
  // ========================

  /**
   * 获取抖音追踪回调 URL 配置
   * 用于接收抖音的视频表现数据推送
   */
  getTrackingCallbackUrl(agentId: string): string {
    const baseUrl = this.config.get('app.baseUrl', 'https://api.ai-auto.example.com')
    return `${baseUrl}/v1/callbacks/douyin/tracking?agent=${agentId}`
  }

  /**
   * 注册抖音事件回调
   * 抖音会将用户行为（播放/点赞/评论等）推送到此地址
   */
  async registerCallback(accessToken: string, callbackUrl: string): Promise<boolean> {
    try {
      // 抖音回调订阅API: POST https://open.douyin.com/event/callback/subscribe/
      await lastValueFrom(
        this.httpService
          .post(
            `${DOUYIN_API_BASE}/event/callback/subscribe/`,
            {
              callback_url: callbackUrl,
              events: ['video.publish', 'video.like', 'video.comment', 'video.share'],
            },
            { params: { access_token: accessToken } },
          )
          .pipe(catchError((err) => throwError(() => err))),
      )

      this.logger.log({ event: 'douyin_callback_registered', callbackUrl })
      return true
    } catch (error) {
      this.logger.error({ event: 'douyin_callback_register_failed', error: String(error) })
      return false
    }
  }

  // ========================
  // 企业号引导
  // ========================

  /**
   * 检查账号是否为企业号
   */
  async isEnterpriseAccount(accessToken: string): Promise<boolean> {
    try {
      // 抖音用户信息API
      const result = await lastValueFrom(
        this.httpService
          .get(`${DOUYIN_API_BASE}/oauth/userinfo/`, {
            params: { access_token: accessToken },
          })
          .pipe(catchError((err) => throwError(() => err))),
      )

      const payload = result.data as { data?: { user?: { is_enterprise?: boolean; account_type?: string; series?: number } }; is_enterprise?: boolean }
      const user = payload.data?.user
      return payload.is_enterprise === true || user?.is_enterprise === true || user?.account_type === 'enterprise' || user?.series === 1
    } catch (error) {
      this.logger.error({ event: 'douyin_enterprise_check_failed', error: String(error) })
      return false
    }
  }

  /**
   * 获取企业号开通引导信息
   */
  getEnterpriseGuide(): {
    title: string
    steps: string[]
    benefits: string[]
    guideUrl: string
  } {
    return {
      title: '抖音企业号开通指南',
      steps: [
        '1. 打开抖音 App → 我 → 设置 → 账号与安全 → 企业认证',
        '2. 选择「企业主体认证」或「个体工商户」',
        '3. 填写企业信息（营业执照/法人信息）',
        '4. 缴纳认证费用（600元/年）',
        '5. 等待审核（1-3个工作日）',
        '6. 审核通过后返回本平台绑定账号',
      ],
      benefits: [
        '自动发布视频（个人号限流，企业号无限制）',
        '更多视频挂载能力（小程序/商品/门店）',
        '专属数据洞察和粉丝分析',
        '视频加热（投放）功能',
        '品牌主页定制',
      ],
      guideUrl: 'https://business.douyin.com/certified-enterprise',
    }
  }

  // ========================
  // 合规检查
  // ========================

  /**
   * 检查视频是否符合抖音发布规范
   */
  validateVideoCompliance(params: {
    title: string
    description: string
    durationSeconds?: number
  }): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // 视频时长检查（15秒-10分钟）
    if (params.durationSeconds !== undefined) {
      if (params.durationSeconds < 15) {
        errors.push('视频时长不能少于15秒')
      }
      if (params.durationSeconds > 600) {
        errors.push('视频时长不能超过10分钟')
      }
    }

    // 标题长度（1-55字）
    if (params.title.length < 1 || params.title.length > 55) {
      errors.push('视频标题长度需在1-55字之间')
    }

    // 描述长度（0-500字）
    if (params.description.length > 500) {
      errors.push('视频描述长度不能超过500字')
    }

    // 敏感词检查（占位）
    // 实际对接抖音内容审核API

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  private composeText(title: string, description?: string, topics?: string[]) {
    const topicText = (topics ?? []).map((topic) => topic.startsWith('#') ? topic : `#${topic}`).join(' ')
    return [title, description, topicText].filter(Boolean).join('\n').slice(0, 1000)
  }
}
