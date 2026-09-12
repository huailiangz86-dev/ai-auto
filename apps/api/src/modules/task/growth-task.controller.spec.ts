import { CreatorTaskController } from './growth-task.controller'
import { TaskReasonDto } from './dto/growth-task.dto'

describe('CreatorTaskController', () => {
  it('passes the creator identity and decline reason to the lifecycle service', async () => {
    const service: any = {
      moveCreatorTaskForCreator: jest.fn().mockResolvedValue({ status: 'declined' }),
    }
    const controller = new CreatorTaskController(service)
    const user: any = { agentId: 'creator-1' }
    const dto: TaskReasonDto = { reason: '档期冲突' }

    await controller.decline(user, 'task-1', dto)

    expect(service.moveCreatorTaskForCreator).toHaveBeenCalledWith(
      'creator-1',
      'task-1',
      'declined',
      undefined,
      '档期冲突',
    )
  })
})
