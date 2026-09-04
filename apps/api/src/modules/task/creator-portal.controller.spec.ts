import { AdminCreatorPayoutController } from './creator-portal.controller'
import {
  ListCreatorTaskAppealsDto,
  ResolveCreatorTaskAppealDto,
  VerifyCreatorTaskPayoutDto,
} from './dto/creator-portal.dto'

describe('AdminCreatorPayoutController', () => {
  it('passes filters to the appeal operations queue', async () => {
    const service: any = {
      listAppealsForOperations: jest.fn().mockResolvedValue({ items: [], pagination: {} }),
    }
    const controller = new AdminCreatorPayoutController(service)
    const query: ListCreatorTaskAppealsDto = {
      status: 'open',
      target: 'payout',
      page: 1,
      pageSize: 20,
    }

    await expect(controller.appeals(query)).resolves.toEqual({ items: [], pagination: {} })
    expect(service.listAppealsForOperations).toHaveBeenCalledWith(query)
  })

  it('passes the authenticated operator to appeal resolution', async () => {
    const service: any = {
      resolveAppeal: jest.fn().mockResolvedValue({ status: 'accepted' }),
    }
    const controller = new AdminCreatorPayoutController(service)
    const user: any = { id: 'admin-1', username: 'ops-admin' }
    const dto: ResolveCreatorTaskAppealDto = {
      decision: 'accepted',
      resolution: '证据核验通过',
    }

    await controller.resolveAppeal(user, 'appeal-1', dto)

    expect(service.resolveAppeal).toHaveBeenCalledWith(
      'appeal-1',
      { id: 'admin-1', name: 'ops-admin' },
      dto,
    )
  })

  it('passes only the operator id to payout verification', async () => {
    const service: any = {
      verifyPayout: jest.fn().mockResolvedValue({ status: 'verified' }),
    }
    const controller = new AdminCreatorPayoutController(service)
    const user: any = { id: 'admin-1', username: 'ops-admin' }
    const dto: VerifyCreatorTaskPayoutDto = { verifiedAmount: 88 }

    await controller.verify(user, 'task-1', dto)

    expect(service.verifyPayout).toHaveBeenCalledWith('task-1', 'admin-1', dto)
  })
})
