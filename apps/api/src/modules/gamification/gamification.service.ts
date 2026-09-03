import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { CreateRewardProductDto, CreateSharingChallengeDto } from './dto/gamification.dto'
import {
  CustomerChallengeProgress,
  CustomerPointAccount,
  CustomerPointLedger,
  MysteryBoxOpening,
  RewardProduct,
  SharingChallenge,
} from './entities/gamification.entity'

const SHARE_POINTS = 5
const REDEMPTION_POINTS = 20
const GUARANTEE_EVERY = 5

@Injectable()
export class GamificationService {
  constructor(
    @InjectRepository(CustomerPointAccount)
    private readonly accountRepo: Repository<CustomerPointAccount>,
    @InjectRepository(CustomerPointLedger)
    private readonly ledgerRepo: Repository<CustomerPointLedger>,
    @InjectRepository(RewardProduct) private readonly rewardRepo: Repository<RewardProduct>,
    @InjectRepository(SharingChallenge)
    private readonly challengeRepo: Repository<SharingChallenge>,
    @InjectRepository(CustomerChallengeProgress)
    private readonly progressRepo: Repository<CustomerChallengeProgress>,
    @InjectRepository(MysteryBoxOpening)
    private readonly openingRepo: Repository<MysteryBoxOpening>,
    @InjectRepository(SharingAgent) private readonly agentRepo: Repository<SharingAgent>,
    private readonly dataSource: DataSource,
  ) {}

  async awardForShare(customerId: string, eventId: string) {
    await this.awardPoints(customerId, eventId, 'share', SHARE_POINTS, '分享推广内容')
    const challenges = await this.activeChallenges()
    const updates: Array<{ challengeId: string; completed: boolean }> = []
    for (const challenge of challenges) {
      let progress = await this.progressRepo.findOne({
        where: { customerId, challengeId: challenge.id },
      })
      if (!progress)
        progress = this.progressRepo.create({
          customerId,
          challengeId: challenge.id,
          shareCount: 0,
        })
      if (progress.completedAt) continue
      progress.shareCount += 1
      if (progress.shareCount >= challenge.targetShares) {
        progress.completedAt = new Date()
        await this.awardPoints(
          customerId,
          `challenge:${challenge.id}:${customerId}`,
          'challenge',
          challenge.rewardPoints,
          `完成挑战：${challenge.title}`,
        )
        await this.addMysteryBoxes(customerId, 1)
        updates.push({ challengeId: challenge.id, completed: true })
      } else updates.push({ challengeId: challenge.id, completed: false })
      await this.progressRepo.save(progress)
    }
    return updates
  }

  async awardForRedemption(customerId: string, redemptionId: string) {
    return this.awardPoints(
      customerId,
      `redemption:${redemptionId}`,
      'redemption',
      REDEMPTION_POINTS,
      '优惠券核销',
    )
  }

  async getOverview(customerId: string) {
    const [account, challenges, leaderboard] = await Promise.all([
      this.account(customerId),
      this.listChallenges(customerId),
      this.getLeaderboard(),
    ])
    return {
      points: this.publicAccount(account),
      challenges,
      leaderboard: leaderboard.items.slice(0, 3),
    }
  }

  async listChallenges(customerId: string) {
    const challenges = await this.activeChallenges()
    const progress = await this.progressRepo.find({ where: { customerId } })
    const byChallenge = new Map(progress.map((item) => [item.challengeId, item]))
    return challenges.map((challenge) => ({
      challengeId: challenge.id,
      title: challenge.title,
      description: challenge.description,
      targetShares: challenge.targetShares,
      rewardPoints: challenge.rewardPoints,
      progress: byChallenge.get(challenge.id)?.shareCount ?? 0,
      completed: Boolean(byChallenge.get(challenge.id)?.completedAt),
      mysteryBoxReward: true,
    }))
  }

  async openMysteryBox(customerId: string) {
    return this.dataSource.transaction(async (manager) => {
      const account = await manager.findOne(CustomerPointAccount, {
        where: { customerId },
        lock: { mode: 'pessimistic_write' },
      })
      if (!account || account.availableMysteryBoxes < 1)
        throw new BadRequestException({ code: 9701, message: '暂无可开启的盲盒' })
      const openings = await manager.count(MysteryBoxOpening, { where: { customerId } })
      const guaranteed = (openings + 1) % GUARANTEE_EVERY === 0
      let candidates = await manager.find(RewardProduct, {
        where: { isActive: true, mysteryBoxEnabled: true },
      })
      candidates = candidates.filter(
        (item) => item.stock === null || item.stock === undefined || item.stock > 0,
      )
      const guaranteedCandidates = candidates.filter((item) => item.guaranteedReward)
      if (guaranteed && guaranteedCandidates.length) candidates = guaranteedCandidates
      if (!candidates.length)
        throw new NotFoundException({ code: 9702, message: '暂无可用盲盒奖励' })
      const product = candidates[Math.floor(Math.random() * candidates.length)]
      account.availableMysteryBoxes -= 1
      if (product.stock !== null && product.stock !== undefined) product.stock -= 1
      await manager.save(account)
      await manager.save(product)
      const opening = await manager.save(
        manager.create(MysteryBoxOpening, {
          customerId,
          rewardProductId: product.id,
          isGuaranteed: guaranteed && product.guaranteedReward,
        }),
      )
      return {
        openingId: opening.id,
        reward: this.publicReward(product),
        guaranteed: opening.isGuaranteed,
        remainingBoxes: account.availableMysteryBoxes,
      }
    })
  }

  async redeemReward(customerId: string, rewardProductId: string) {
    const product = await this.rewardRepo.findOne({
      where: { id: rewardProductId, isActive: true },
    })
    if (!product) throw new NotFoundException({ code: 9703, message: '兑换商品不存在' })
    if (product.stock !== null && product.stock !== undefined && product.stock < 1)
      throw new BadRequestException({ code: 9704, message: '兑换商品库存不足' })
    const account = await this.account(customerId)
    if (account.balance < product.pointsCost)
      throw new BadRequestException({ code: 9705, message: '积分不足' })
    await this.awardPoints(
      customerId,
      `redeem:${customerId}:${product.id}:${Date.now()}`,
      'redeem',
      -product.pointsCost,
      `兑换：${product.name}`,
    )
    if (product.stock !== null && product.stock !== undefined) {
      product.stock -= 1
      await this.rewardRepo.save(product)
    }
    return {
      reward: this.publicReward(product),
      remainingPoints: account.balance - product.pointsCost,
    }
  }

  async listRewards() {
    return (
      await this.rewardRepo.find({ where: { isActive: true }, order: { pointsCost: 'ASC' } })
    ).map((item) => this.publicReward(item))
  }
  async createReward(dto: CreateRewardProductDto) {
    return this.publicReward(
      await this.rewardRepo.save(this.rewardRepo.create({ ...dto, isActive: true })),
    )
  }
  async createChallenge(dto: CreateSharingChallengeDto) {
    return this.challengeRepo.save(
      this.challengeRepo.create({ ...dto, rewardPoints: dto.rewardPoints ?? 0, isActive: true }),
    )
  }

  async getLeaderboard(merchantId?: string) {
    const query = this.agentRepo
      .createQueryBuilder('agent')
      .where('agent.status = :status', { status: true })
    if (merchantId)
      query.innerJoin(
        'merchant_agent_bindings',
        'binding',
        'binding.agent_id = agent.id AND binding.merchant_id = :merchantId AND binding.binding_status = :bindingStatus',
        { merchantId, bindingStatus: 'active' },
      )
    const agents = await query
      .orderBy('agent.total_earned', 'DESC')
      .addOrderBy('agent.valid_customer_count', 'DESC')
      .take(20)
      .getMany()
    return {
      scope: merchantId ? 'merchant' : 'platform',
      items: agents.map((agent, index) => ({
        rank: index + 1,
        agentId: agent.id,
        nickname: agent.nickname || '分享达人',
        avatar: agent.avatar || null,
        totalEarned: Number(agent.totalEarned),
        invitedCustomers: agent.validCustomerCount,
      })),
    }
  }

  private async awardPoints(
    customerId: string,
    eventId: string,
    type: CustomerPointLedger['type'],
    points: number,
    description: string,
  ) {
    const exists = await this.ledgerRepo.findOne({ where: { eventId } })
    if (exists) return exists
    return this.dataSource.transaction(async (manager) => {
      let account = await manager.findOne(CustomerPointAccount, {
        where: { customerId },
        lock: { mode: 'pessimistic_write' },
      })
      if (!account)
        account = manager.create(CustomerPointAccount, {
          customerId,
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          availableMysteryBoxes: 0,
        })
      if (account.balance + points < 0)
        throw new BadRequestException({ code: 9706, message: '积分不足' })
      account.balance += points
      if (points > 0) account.totalEarned += points
      else account.totalSpent += Math.abs(points)
      await manager.save(account)
      return manager.save(
        manager.create(CustomerPointLedger, {
          customerId,
          eventId,
          type,
          points,
          balanceAfter: account.balance,
          description,
        }),
      )
    })
  }
  private async account(customerId: string) {
    let account = await this.accountRepo.findOne({ where: { customerId } })
    if (!account)
      account = await this.accountRepo.save(
        this.accountRepo.create({
          customerId,
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          availableMysteryBoxes: 0,
        }),
      )
    return account
  }
  private async addMysteryBoxes(customerId: string, count: number) {
    const account = await this.account(customerId)
    account.availableMysteryBoxes += count
    return this.accountRepo.save(account)
  }
  private async activeChallenges() {
    const now = new Date()
    return this.challengeRepo
      .createQueryBuilder('challenge')
      .where('challenge.is_active = :active', { active: true })
      .andWhere('(challenge.starts_at IS NULL OR challenge.starts_at <= :now)', { now })
      .andWhere('(challenge.ends_at IS NULL OR challenge.ends_at >= :now)', { now })
      .getMany()
  }
  private publicAccount(account: CustomerPointAccount) {
    return {
      balance: account.balance,
      totalEarned: account.totalEarned,
      totalSpent: account.totalSpent,
      availableMysteryBoxes: account.availableMysteryBoxes,
    }
  }
  private publicReward(product: RewardProduct) {
    return {
      rewardProductId: product.id,
      name: product.name,
      description: product.description || null,
      pointsCost: product.pointsCost,
      stock: product.stock,
      imageUrl: product.imageUrl || null,
    }
  }
}
