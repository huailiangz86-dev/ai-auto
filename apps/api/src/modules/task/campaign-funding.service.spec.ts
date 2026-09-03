import { CampaignFundingService } from './campaign-funding.service'

const merchantId = '11111111-1111-4111-8111-111111111111'
const planId = '22222222-2222-4222-8222-222222222222'
const campaignId = '33333333-3333-4333-8333-333333333333'
const taskId = '44444444-4444-4444-8444-444444444444'

describe('CampaignFundingService', () => {
  it('freezes the selected approved-plan budget and records all allocation categories', async () => {
    const plan: any = { id: planId, merchantId, status: 'approved', campaignId, growthTaskId: taskId, selectedOptionId: 1, alternatives: [{ optionId: 1, budgetAllocation: { creatorPayout: 45, campaignCredits: 10, offerCost: 35, reserve: 10 } }] }
    const task: any = { id: taskId, merchantId, budget: 100 }
    const campaign: any = { id: campaignId, merchantId, frozenBudget: 0 }
    const wallet: any = { id: 'wallet-1', merchantId, status: true, totalBalance: 200, availableBalance: 150, frozenBalance: 0 }
    const manager: any = {
      findOne: jest.fn().mockResolvedValueOnce(plan).mockResolvedValueOnce(task).mockResolvedValueOnce(campaign).mockResolvedValueOnce(wallet),
      find: jest.fn().mockResolvedValue([]), create: jest.fn((_entity, value) => value),
      save: jest.fn((entityOrValue, value) => Promise.resolve(value ?? entityOrValue)), update: jest.fn(),
    }
    const dataSource: any = { transaction: jest.fn((callback) => callback(manager)) }
    const service = new CampaignFundingService({} as any, {} as any, {} as any, {} as any, {} as any, dataSource)

    const result = await service.fund(merchantId, planId, { sourceReference: 'test-funding' })

    expect(result).toMatchObject({ status: 'funded', committedAmount: 100, frozenAmount: 100 })
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), 'wallet-1', { frozenBalance: 100, availableBalance: 50 })
    expect(manager.save).toHaveBeenCalledWith(expect.anything(), expect.arrayContaining([expect.objectContaining({ category: 'creator_payout', committedAmount: 45 }), expect.objectContaining({ category: 'campaign_credits', committedAmount: 10 }), expect.objectContaining({ category: 'consumer_incentive', committedAmount: 35 }), expect.objectContaining({ category: 'risk_reserve', committedAmount: 10 })]))
  })
})
