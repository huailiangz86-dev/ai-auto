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
  videoPath: string // 视频文件路径或 URL
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
    const { accessToken, videoPath, title, description } = params

    // Step 1: 上传视频文件获取 video_id
    const uploadResult = await this.uploadVideo(accessToken, videoPath)
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
      videoId: uploadResult.videoId,
      title,
      description,
    })

    return publishResult
  }

  /**
   * 上传视频文件到抖音服务器
   */
  async uploadVideo(
    accessToken: string,
    videoPath: string,
  ): Promise<{
    videoId?: string
    videoUrl?: string
    errorCode?: string
    errorMsg?: string
  }> {
    try {
      // 实际场景：分片上传视频文件到抖音
      // 这里用 URL 方式上传作为示例
      this.logger.log({ event: 'douyin_video_upload', videoPath })

      // TODO: 实现实际的视频上传
      // 抖音上传API: POST https://open.douyin.com/video/upload
      // - multipart/form-data
      // - video_file: 视频文件
      // - access_token: 已获取的 access token
      // 返回: { video_id, error_code, error_msg }

      return {
        videoId: `douyin-video-${Date.now()}`,
      }
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
    },
  ): Promise<DouyinPublishResult> {
    try {
      // 抖音发布API: POST https://open.douyin.com/video/data/publish/
      // Body: video_id, title, description, etc.
      const result = await lastValueFrom(
        this.httpService
          .post(
            `${DOUYIN_API_BASE}/video/data/publish/`,
            {
              video_id: params.videoId,
              title: params.title,
              description: params.description ?? '',
            },
            { params: { access_token: accessToken } },
          )
          .pipe(catchError((err) => throwError(() => err))),
      )

      // TODO: 解析实际 API 响应
      // 实际返回: { data: { video_id, error_code, error_msg }, errcode, errmsg }
      const videoId = params.videoId
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

      // TODO: 解析实际 API 响应
      // 实际返回: { data: { video_list: [{ video_id, play_count, like_count, ... }] } }
      this.logger.log({ event: 'douyin_stats_fetched', videoId })

      // 占位返回
      return {
        videoId,
        playCount: 0,
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
        collectCount: 0,
        downloadCount: 0,
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

      // TODO: 解析实际返回
      // 检查用户类型: user_info.series (series = 1 为企业号)
      return false
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
}
