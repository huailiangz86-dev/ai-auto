import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { UserRole } from '@ai-auto/shared'
import { Notification } from './entities/notification.entity'

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification) private readonly notificationRepo: Repository<Notification>,
  ) {}

  async list(recipientId: string, recipientRole: UserRole, page = 1, pageSize = 20) {
    const safePage = Math.max(Number(page) || 1, 1)
    const safePageSize = Math.min(Math.max(Number(pageSize) || 20, 1), 100)
    const [items, total] = await this.notificationRepo.findAndCount({
      where: { recipientId, recipientRole },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    })
    const unread = await this.notificationRepo.count({
      where: { recipientId, recipientRole, readAt: IsNull() },
    })
    return {
      items,
      unread,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages: Math.ceil(total / safePageSize),
      },
    }
  }

  async markRead(recipientId: string, recipientRole: UserRole, notificationId: string) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, recipientId, recipientRole },
    })
    if (!notification) throw new NotFoundException({ code: 9101, message: '通知不存在' })
    if (!notification.readAt)
      await this.notificationRepo.update(notificationId, { readAt: new Date() })
    return { code: 0, message: '已标记为已读' }
  }
}
