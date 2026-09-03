import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { AgentPlatformAccount } from '../agent/entities/agent-platform-account.entity'
import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { Coupon } from '../campaign/entities/coupon.entity'
import { MerchantAgentBinding } from '../merchant/entities/merchant-agent-binding.entity'
import { CreateSharingTaskDto } from './dto/sharing-task.dto'
import { SharingTask, SharingTaskAssignment } from './entities/sharing-task.entity'

@Injectable()
export class SharingTaskService {
  constructor(
    @InjectRepository(SharingTask) private readonly taskRepo: Repository<SharingTask>,
    @InjectRepository(SharingTaskAssignment)
    private readonly assignmentRepo: Repository<SharingTaskAssignment>,
    @InjectRepository(Coupon) private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(SharingAgent) private readonly agentRepo: Repository<SharingAgent>,
    @InjectRepository(AgentPlatformAccount)
    private readonly accountRepo: Repository<AgentPlatformAccount>,
    @InjectRepository(MerchantAgentBinding)
    private readonly bindingRepo: Repository<MerchantAgentBinding>,
    @InjectRepository(AgentWallet) private readonly walletRepo: Repository<AgentWallet>,
    private readonly dataSource: DataSource,
  ) {}

  async create(merchantId: string, dto: CreateSharingTaskDto) {
    const coupon = await this.couponRepo.findOne({ where: { id: dto.couponId, merchantId } })
    if (!coupon)
      throw new NotFoundException({ code: 9801, message: '优惠券不存在或不属于当前商家' })
    if (new Date(dto.deadline) <= new Date())
      throw new BadRequestException({ code: 9802, message: '截止时间必须晚于当前时间' })
    if (Number(dto.budget) < Number(dto.rewardPerRedemption) * (dto.targetRedemptions ?? 1))
      throw new BadRequestException({ code: 9803, message: '预算不足以覆盖目标核销奖励' })
    return this.taskRepo.save(
      this.taskRepo.create({
        merchantId,
        couponId: dto.couponId,
        targetAudience: dto.targetAudience,
        budget: dto.budget,
        deadline: new Date(dto.deadline),
        maxAgents: dto.maxAgents ?? 20,
        targetClaims: dto.targetClaims ?? 0,
        targetRedemptions: dto.targetRedemptions ?? 1,
        rewardPerRedemption: dto.rewardPerRedemption,
        status: 'open',
      }),
    )
  }

  async listMerchantTasks(merchantId: string) {
    return this.taskRepo.find({ where: { merchantId }, order: { createdAt: 'DESC' } })
  }

  async recommend(agentId: string) {
    const [agent, platformAccounts, bindings, tasks] = await Promise.all([
      this.agentRepo.findOne({ where: { id: agentId, status: true } }),
      this.accountRepo.count({ where: { agentId, status: true } }),
      this.bindingRepo.find({ where: { agentId, bindingStatus: 'active' } }),
      this.taskRepo
        .createQueryBuilder('task')
        .where('task.status = :status', { status: 'open' })
        .andWhere('task.deadline > :now', { now: new Date() })
        .getMany(),
    ])
    if (!agent) throw new NotFoundException({ code: 9804, message: '分享员不存在' })
    const boundMerchants = new Set(bindings.map((item) => item.merchantId))
    const accepted = await this.assignmentRepo.find({ where: { agentId } })
    const acceptedIds = new Set(accepted.map((item) => item.taskId))
    return (
      await Promise.all(
        tasks
          .filter((task) => !acceptedIds.has(task.id))
          .map(async (task) => {
            const acceptedCount = await this.assignmentRepo.count({ where: { taskId: task.id } })
            const score =
              agent.reputationScore +
              platformAccounts * 25 +
              (boundMerchants.has(task.merchantId) ? 30 : 0) +
              Math.min(20, agent.validCustomerCount)
            return {
              ...this.publicTask(task),
              matchingScore: score,
              matchingReason: `${agent.reputationScore} 信誉分、${platformAccounts} 个已绑定平台账号${boundMerchants.has(task.merchantId) ? '、已绑定该商家' : ''}`,
              slotsRemaining: Math.max(0, task.maxAgents - acceptedCount),
            }
          }),
      )
    )
      .filter((task) => task.slotsRemaining > 0)
      .sort((a, b) => b.matchingScore - a.matchingScore)
  }

  async accept(agentId: string, taskId: string) {
    const task = await this.taskRepo.findOne({ where: { id: taskId } })
    if (!task || task.status !== 'open' || task.deadline <= new Date())
      throw new BadRequestException({ code: 9805, message: '任务不可接取' })
    const existing = await this.assignmentRepo.findOne({ where: { taskId, agentId } })
    if (existing) return this.publicAssignment(existing, task)
    const accepted = await this.assignmentRepo.count({ where: { taskId } })
    if (accepted >= task.maxAgents)
      throw new BadRequestException({ code: 9806, message: '任务名额已满' })
    const assignment = await this.assignmentRepo.save(
      this.assignmentRepo.create({
        taskId,
        agentId,
        status: 'accepted',
        viewCount: 0,
        claimCount: 0,
        redemptionCount: 0,
        earnedReward: 0,
      }),
    )
    return this.publicAssignment(assignment, task)
  }

  async myTasks(agentId: string) {
    const assignments = await this.assignmentRepo.find({
      where: { agentId },
      order: { createdAt: 'DESC' },
    })
    return Promise.all(
      assignments.map(async (assignment) => {
        const task = await this.taskRepo.findOne({ where: { id: assignment.taskId } })
        return task ? this.publicAssignment(assignment, task) : null
      }),
    ).then((items) => items.filter(Boolean))
  }
  async recordView(agentId: string, taskId: string) {
    const assignment = await this.assignment(agentId, taskId)
    assignment.viewCount += 1
    return this.assignmentRepo.save(assignment)
  }
  async trackClaim(agentId: string | null | undefined, couponId: string) {
    if (!agentId) return
    const assignment = await this.findActiveAssignment(agentId, couponId)
    if (assignment) {
      assignment.claimCount += 1
      await this.assignmentRepo.save(assignment)
    }
  }

  async trackRedemption(
    agentId: string | null | undefined,
    couponId: string,
    redemptionId: string,
  ) {
    if (!agentId) return null
    return this.dataSource.transaction(async (manager) => {
      const assignment = await this.findActiveAssignment(agentId, couponId, manager)
      if (!assignment) return null
      const task = await manager.findOne(SharingTask, { where: { id: assignment.taskId } })
      if (!task) return null
      assignment.redemptionCount += 1
      const reward = Number(task.rewardPerRedemption)
      assignment.earnedReward = Number(assignment.earnedReward) + reward
      const completed = assignment.redemptionCount >= task.targetRedemptions
      if (completed) {
        assignment.status = 'completed'
        assignment.completedAt = new Date()
      }
      await manager.save(assignment)
      const payout = completed ? Number(assignment.earnedReward) : 0
      if (payout > 0) {
        let wallet = await manager.findOne(AgentWallet, { where: { agentId } })
        if (!wallet)
          wallet = manager.create(AgentWallet, {
            agentId,
            pendingSettlementBalance: 0,
            settledBalance: 0,
            frozenBalance: 0,
            totalEarned: 0,
            totalPlatformFee: 0,
            totalSettled: 0,
            totalWithdrawn: 0,
            aiTokenBalance: 0,
            status: true,
          })
        wallet.pendingSettlementBalance = Number(wallet.pendingSettlementBalance) + payout
        wallet.totalEarned = Number(wallet.totalEarned) + payout
        await manager.save(wallet)
      }
      return {
        taskId: task.id,
        assignmentId: assignment.id,
        redemptionId,
        reward: payout,
        completed,
      }
    })
  }
  private async assignment(agentId: string, taskId: string) {
    const assignment = await this.assignmentRepo.findOne({ where: { agentId, taskId } })
    if (!assignment) throw new NotFoundException({ code: 9807, message: '未接取该任务' })
    return assignment
  }
  private async findActiveAssignment(
    agentId: string,
    couponId: string,
    manager: any = this.assignmentRepo.manager,
  ) {
    return manager
      .createQueryBuilder(SharingTaskAssignment, 'assignment')
      .innerJoin(SharingTask, 'task', 'task.id = assignment.task_id')
      .where(
        'assignment.agent_id = :agentId AND assignment.status = :status AND task.coupon_id = :couponId AND task.deadline > :now',
        { agentId, couponId, status: 'accepted', now: new Date() },
      )
      .orderBy('assignment."createdAt"', 'ASC')
      .getOne()
  }
  private publicTask(task: SharingTask) {
    return {
      taskId: task.id,
      merchantId: task.merchantId,
      couponId: task.couponId,
      targetAudience: task.targetAudience,
      budget: Number(task.budget),
      deadline: task.deadline,
      targetClaims: task.targetClaims,
      targetRedemptions: task.targetRedemptions,
      rewardPerRedemption: Number(task.rewardPerRedemption),
    }
  }
  private publicAssignment(assignment: SharingTaskAssignment, task: SharingTask) {
    return {
      ...this.publicTask(task),
      assignmentId: assignment.id,
      status: assignment.status,
      progress: {
        views: assignment.viewCount,
        claims: assignment.claimCount,
        redemptions: assignment.redemptionCount,
        targetRedemptions: task.targetRedemptions,
      },
      earnedReward: Number(assignment.earnedReward),
      completedAt: assignment.completedAt ?? null,
    }
  }
}
