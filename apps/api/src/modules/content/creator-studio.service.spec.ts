import { CreatorStudioService, CREATOR_STUDIO_CREDIT_COSTS } from './creator-studio.service'

describe('CreatorStudioService', () => {
  const task = {
    id: 'creator-task-1',
    creatorId: 'creator-1',
    campaignId: 'campaign-1',
    brief: '推广本地门店优惠',
  }
  const contentRepo = {
    create: jest.fn((input) => input),
    save: jest.fn(async (input) => ({ id: 'content-1', ...input })),
  }
  const creatorTaskRepo = { findOne: jest.fn(async () => task) }
  const aiBridge = { runCreatorStudio: jest.fn(async (input) => ({ model: 'test-model', input })) }
  const growthTaskService = {
    consumeCampaignCredits: jest.fn(async () => ({ remaining: 10, idempotent: false })),
  }
  const service = new CreatorStudioService(
    contentRepo as any,
    creatorTaskRepo as any,
    aiBridge as any,
    growthTaskService as any,
  )

  beforeEach(() => jest.clearAllMocks())

  it.each([
    ['generate', () => service.generate('creator-1', { creatorTaskId: task.id, sourceReference: 'g', platform: 'douyin' as any })],
    ['rewrite', () => service.rewrite('creator-1', { creatorTaskId: task.id, sourceReference: 'r', platform: 'douyin' as any, content: '原文' })],
    ['score', () => service.score('creator-1', { creatorTaskId: task.id, sourceReference: 's', platform: 'douyin' as any, content: '原文' })],
    ['publish_advice', () => service.publishAdvice('creator-1', { creatorTaskId: task.id, sourceReference: 'p', platform: 'douyin' as any, content: '原文' })],
  ] as const)('uses Campaign Credits for %s', async (action, run) => {
    const result = await run()

    expect(aiBridge.runCreatorStudio).toHaveBeenCalledWith(expect.objectContaining({ action, creator_task_id: task.id }))
    expect(growthTaskService.consumeCampaignCredits).toHaveBeenCalledWith(
      'creator-1', task.id, CREATOR_STUDIO_CREDIT_COSTS[action], `creator-studio:${action}:${action[0]}`,
    )
    expect(contentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ creatorTaskId: task.id, contentType: 'creator_studio' }))
    expect(result.campaignCredits.remaining).toBe(10)
  })
})
