// ============================================================
// AI auto - Kuaishou Service
// STORY-AI-041: 快手账号内容发布
// ============================================================

import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { lastValueFrom } from 'rxjs'

const KUAISHOU_API_BASE = 'https://open.kuaishou.com'
const DIRECT_UPLOAD_LIMIT = 10 * 1024 * 1024
const FRAGMENT_SIZE = 8 * 1024 * 1024

interface KuaishouResponse {
  result?: number
  error_msg?: string
}

interface UploadTicket extends KuaishouResponse {
  upload_token?: string
  endpoint?: string
}

interface PublishPhotoResponse extends KuaishouResponse {
  video_info?: {
    photo_id?: string
    play_url?: string
    pending?: boolean
  }
}

export interface KuaishouPublishParams {
  accessToken: string
  videoUrl: string
  coverUrl: string
  caption: string
}

export interface KuaishouPublishResult {
  photoId: string
  playUrl?: string
  pending: boolean
}

/**
 * Server-side implementation of Kuaishou’s upload → publish flow. Generated
 * assets are fetched from their persisted URLs so OAuth tokens never reach a
 * client or the asset-generation service.
 */
@Injectable()
export class KuaishouService {
  private readonly logger = new Logger(KuaishouService.name)

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async uploadAndPublish(params: KuaishouPublishParams): Promise<KuaishouPublishResult> {
    const appId = this.getAppId()
    const ticket = await this.startUpload(params.accessToken, appId)
    const video = await this.downloadAsset(params.videoUrl, '视频')

    if (video.length <= DIRECT_UPLOAD_LIMIT) {
      await this.uploadDirect(ticket, video)
    } else {
      await this.uploadFragments(ticket, video)
    }

    const cover = await this.downloadAsset(params.coverUrl, '封面')
    if (cover.length > DIRECT_UPLOAD_LIMIT) {
      throw new BadRequestException('快手封面文件不能超过 10MB')
    }

    const body = new FormData()
    body.append('cover', new Blob([Uint8Array.from(cover)]), 'cover.jpg')
    body.append('caption', params.caption)

    const response = await lastValueFrom(
      this.httpService.post<PublishPhotoResponse>(
        `${KUAISHOU_API_BASE}/openapi/photo/publish`,
        body,
        {
          params: {
            access_token: params.accessToken,
            app_id: appId,
            upload_token: ticket.uploadToken,
          },
          timeout: 60000,
        },
      ),
    )
    this.assertSuccess(response.data, '发布视频')

    const photoId = response.data.video_info?.photo_id
    if (!photoId) {
      throw new BadRequestException('快手发布未返回作品 ID')
    }

    this.logger.log({ event: 'kuaishou_publish_accepted', photoId })
    return {
      photoId,
      playUrl: response.data.video_info?.play_url,
      pending: Boolean(response.data.video_info?.pending),
    }
  }

  private async startUpload(
    accessToken: string,
    appId: string,
  ): Promise<{ uploadToken: string; endpoint: string }> {
    const response = await lastValueFrom(
      this.httpService.post<UploadTicket>(
        `${KUAISHOU_API_BASE}/openapi/photo/start_upload`,
        undefined,
        {
          params: { access_token: accessToken, app_id: appId },
          timeout: 30000,
        },
      ),
    )
    this.assertSuccess(response.data, '发起上传')
    const uploadToken = response.data.upload_token
    const endpoint = response.data.endpoint
    if (!uploadToken || !endpoint || !this.isKuaishouUploadHost(endpoint)) {
      throw new BadRequestException('快手上传服务返回了无效地址')
    }
    return { uploadToken, endpoint }
  }

  private async uploadDirect(ticket: { uploadToken: string; endpoint: string }, file: Buffer) {
    const response = await lastValueFrom(
      this.httpService.post<KuaishouResponse>(`http://${ticket.endpoint}/api/upload`, file, {
        params: { upload_token: ticket.uploadToken },
        headers: { 'Content-Type': 'video/mp4' },
        timeout: 60000,
      }),
    )
    this.assertSuccess(response.data, '上传视频')
  }

  private async uploadFragments(ticket: { uploadToken: string; endpoint: string }, file: Buffer) {
    const fragmentCount = Math.ceil(file.length / FRAGMENT_SIZE)
    for (let index = 0; index < fragmentCount; index++) {
      const fragment = file.subarray(index * FRAGMENT_SIZE, (index + 1) * FRAGMENT_SIZE)
      const response = await lastValueFrom(
        this.httpService.post<KuaishouResponse>(
          `http://${ticket.endpoint}/api/upload/fragment`,
          fragment,
          {
            params: { upload_token: ticket.uploadToken, fragment_id: index },
            headers: { 'Content-Type': 'video/mp4' },
            timeout: 60000,
          },
        ),
      )
      this.assertSuccess(response.data, `上传视频分片 ${index + 1}`)
    }

    const response = await lastValueFrom(
      this.httpService.post<KuaishouResponse>(
        `http://${ticket.endpoint}/api/upload/complete`,
        undefined,
        {
          params: { upload_token: ticket.uploadToken, fragment_count: fragmentCount },
          timeout: 60000,
        },
      ),
    )
    this.assertSuccess(response.data, '合并视频分片')
  }

  private async downloadAsset(url: string, label: string): Promise<Buffer> {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new BadRequestException(`${label}地址无效`)
    }
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException(`${label}必须使用 HTTPS 地址`)
    }

    const response = await lastValueFrom(
      this.httpService.get<ArrayBuffer>(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
      }),
    )
    const asset = Buffer.from(response.data)
    if (asset.length === 0) throw new BadRequestException(`${label}文件为空`)
    return asset
  }

  private getAppId(): string {
    const appId = this.config.get<string>('oauth.kuaishou.clientId', '')
    if (!appId) throw new BadRequestException('未配置快手应用 App ID')
    return appId
  }

  private isKuaishouUploadHost(endpoint: string): boolean {
    return /(^|\.)(gifshow\.com|kwimgs\.com)$/i.test(endpoint)
  }

  private assertSuccess(data: KuaishouResponse, action: string) {
    if (Number(data?.result) !== 1) {
      throw new BadRequestException(`快手${action}失败：${data?.error_msg ?? '未知错误'}`)
    }
  }
}
