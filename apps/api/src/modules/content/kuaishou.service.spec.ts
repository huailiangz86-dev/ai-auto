import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { of } from 'rxjs'
import { KuaishouService } from './kuaishou.service'

describe('KuaishouService', () => {
  let service: KuaishouService
  let httpService: { get: jest.Mock; post: jest.Mock }

  beforeEach(async () => {
    httpService = { get: jest.fn(), post: jest.fn() }
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KuaishouService,
        { provide: ConfigService, useValue: { get: jest.fn(() => 'kuaishou_app_id') } },
        { provide: HttpService, useValue: httpService },
      ],
    }).compile()
    service = module.get(KuaishouService)
  })

  it('执行上传并发布视频', async () => {
    httpService.post
      .mockReturnValueOnce(
        of({ data: { result: 1, upload_token: 'upload-token', endpoint: 'uploader.gifshow.com' } }),
      )
      .mockReturnValueOnce(of({ data: { result: 1 } }))
      .mockReturnValueOnce(
        of({
          data: {
            result: 1,
            video_info: {
              photo_id: 'photo-1',
              play_url: 'https://v.kuaishou.com/1',
              pending: false,
            },
          },
        }),
      )
    httpService.get
      .mockReturnValueOnce(of({ data: Buffer.from('video') }))
      .mockReturnValueOnce(of({ data: Buffer.from('cover') }))

    await expect(
      service.uploadAndPublish({
        accessToken: 'access-token',
        videoUrl: 'https://cdn.example.com/video.mp4',
        coverUrl: 'https://cdn.example.com/cover.jpg',
        caption: '测试视频',
      }),
    ).resolves.toEqual({ photoId: 'photo-1', playUrl: 'https://v.kuaishou.com/1', pending: false })

    expect(httpService.post).toHaveBeenNthCalledWith(
      1,
      'https://open.kuaishou.com/openapi/photo/start_upload',
      undefined,
      expect.objectContaining({
        params: { access_token: 'access-token', app_id: 'kuaishou_app_id' },
      }),
    )
    expect(httpService.post).toHaveBeenNthCalledWith(
      2,
      'http://uploader.gifshow.com/api/upload',
      expect.any(Buffer),
      expect.objectContaining({ params: { upload_token: 'upload-token' } }),
    )
    expect(httpService.post).toHaveBeenLastCalledWith(
      'https://open.kuaishou.com/openapi/photo/publish',
      expect.any(FormData),
      expect.objectContaining({
        params: expect.objectContaining({ upload_token: 'upload-token' }),
      }),
    )
  })
})
