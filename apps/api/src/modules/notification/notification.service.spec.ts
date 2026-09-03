import { Test } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { NotFoundException } from '@nestjs/common'
import { UserRole } from '@ai-auto/shared'

import { Notification } from './entities/notification.entity'
import { NotificationService } from './notification.service'

describe('NotificationService', () => {
  const repo = {
    findAndCount: jest.fn(),
    count: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  }
  let service: NotificationService

  beforeEach(async () => {
    jest.clearAllMocks()
    const module = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useValue: repo },
      ],
    }).compile()
    service = module.get(NotificationService)
  })

  it('仅返回当前业务主体和角色的通知及未读数', async () => {
    repo.findAndCount.mockResolvedValueOnce([[{ id: 'notice-1' }], 1])
    repo.count.mockResolvedValueOnce(1)

    const result = await service.list('agent-1', UserRole.AGENT)

    expect(result).toMatchObject({ unread: 1, pagination: { total: 1 } })
    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { recipientId: 'agent-1', recipientRole: UserRole.AGENT },
      }),
    )
  })

  it('只能将当前业务主体自己的通知标记为已读', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'notice-1', readAt: null })
    repo.update.mockResolvedValueOnce({ affected: 1 })

    await service.markRead('merchant-1', UserRole.MERCHANT_ADMIN, 'notice-1')

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'notice-1', recipientId: 'merchant-1', recipientRole: UserRole.MERCHANT_ADMIN },
    })
    expect(repo.update).toHaveBeenCalledWith(
      'notice-1',
      expect.objectContaining({ readAt: expect.any(Date) }),
    )
  })

  it('其他主体的通知不可读取', async () => {
    repo.findOne.mockResolvedValueOnce(null)

    await expect(service.markRead('agent-1', UserRole.AGENT, 'notice-1')).rejects.toThrow(
      NotFoundException,
    )
  })
})
