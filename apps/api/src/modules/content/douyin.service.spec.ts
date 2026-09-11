import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { of } from 'rxjs'
import { DouyinService } from './douyin.service'

describe('DouyinService', () => {
  let service: DouyinService
  let httpService: { post: jest.Mock; get: jest.Mock }
  let fetchMock: jest.SpyInstance

  beforeEach(async () => {
    httpService = { post: jest.fn(), get: jest.fn() }
    const module: TestingModule = await Test.createTestingModule({
      providers: [DouyinService, { provide: ConfigService, useValue: { get: jest.fn() } }, { provide: HttpService, useValue: httpService }],
    }).compile()
    service = module.get(DouyinService)
    fetchMock = jest.spyOn(global, 'fetch')
  })

  afterEach(() => fetchMock.mockRestore())

  it('uploads the HTTPS video with the documented endpoint and creates a video with the returned encrypted ID', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('video', { status: 200, headers: { 'content-length': '5', 'content-type': 'video/mp4' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { video: { video_id: 'encrypted-video-id' }, error_code: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } }))
    httpService.post.mockReturnValue(of({ data: { data: { item_id: 'published-item-id', error_code: 0 } } }))

    await expect(service.uploadAndPublish({ accessToken: 'token', openId: 'open-id', videoPath: 'https://cdn.example.com/video.mp4', title: '测试标题', description: '测试描述' })).resolves.toEqual({ videoId: 'published-item-id', videoUrl: 'https://www.douyin.com/video/published-item-id' })

    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('/api/douyin/v1/video/upload_video/?open_id=open-id'), expect.objectContaining({ headers: { 'access-token': 'token' } }))
    expect(httpService.post).toHaveBeenCalledWith(
      'https://open.douyin.com/api/douyin/v1/video/create_video/',
      expect.objectContaining({ video_id: 'encrypted-video-id', text: '测试标题\n测试描述' }),
      expect.objectContaining({ params: { open_id: 'open-id' }, headers: { 'access-token': 'token' } }),
    )
  })

  it('does not fetch an insecure video source', async () => {
    await expect(service.uploadVideo('token', 'open-id', 'http://example.com/video.mp4')).resolves.toEqual(expect.objectContaining({ errorCode: 'INVALID_VIDEO_SOURCE' }))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
