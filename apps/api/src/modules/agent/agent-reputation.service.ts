// ============================================================
// AI auto - Agent Reputation Service
// Level calculation, commission multiplier, and scheduled refresh
// ============================================================

import { Injectable, Inject, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import Redis from 'ioredis'

import { SharingAgent } from './entities/sharing-agent.entity'
import { CustomerAttribution } from '../customer/entities/customer-attribution.entity'
import { AgentLevel } from '@ai-auto/shared'
import { REDIS_CLIENT } from '../redis/redis.module'

// 等级配置
export const LEVEL_CONFIG: Record<AgentLevel, { min: number; multiplier: number; label: string }> =
  {
    [AgentLevel.BRONZE]: { min: 0, multiplier: 1.0, label: '青铜' },
    [AgentLevel.SILVER]: { min: 11, multiplier: 1.1, label: '白银' },
    [AgentLevel.GOLD]: { min: 51, multiplier: 1.2, label: '黄金' },
    [AgentLevel.DIAMOND]: { min: 201, multiplier: 1.5, label: '钻石' },
    [AgentLevel.KING]: { min: 501, multiplier: 2.0, label: '王者' },
  }

// 缓存 key 和 TTL
const CACHE_TTL = 60 * 60 // 1 hour
const LEVEL_KEY = (agentId: string) => `agent:level:${agentId}`
const LEADERBOARD_KEY = 'agent:leaderboard'

// 等到下个等级所需客户数
const NEXT_LEVEL_THRESHOLD: Record<AgentLevel, number | null> = {
  [AgentLevel.BRONZE]: 11,
  [AgentLevel.SILVER]: 51,
  [AgentLevel.GOLD]: 201,
  [AgentLevel.DIAMOND]: 501,
  [AgentLevel.KING]: null,
}

export interface AgentReputationInfo {
  agentId: string
  reputationScore: number // 有效客户数
  level: AgentLevel
  levelLabel: string
  commissionMultiplier: number
  // 进度信息
  currentLevelMin: number
  nextLevelMin: number | null
  progress: number // 0-100 (%)
  // 月度滚动计算
  rolling12Months: number
  updatedAt: Date
}

@Injectable()
export class AgentReputationService {
  private readonly logger = new Logger(AgentReputationService.name)

  constructor(
    @InjectRepository(SharingAgent)
    private readonly agentRepo: Repository<SharingAgent>,
    @InjectRepository(CustomerAttribution)
    private readonly attributionRepo: Repository<CustomerAttribution>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // ========================
  // 等级计算
  // ========================

  /**
   * 计算分享员当前信誉分和等级（月度滚动12个月）
   */
  async calculateReputation(agentId: string): Promise<AgentReputationInfo> {
    // 检查 Redis 缓存
    const cached = await this.redis.get(LEVEL_KEY(agentId))
    if (cached) {
      return JSON.parse(cached) as AgentReputationInfo
    }

    // 计算最近12个月有效客户数
    const rolling12Months = await this.computeRolling12Months(agentId)

    // 根据有效客户数确定等级
    const level = this.computeLevel(rolling12Months)
    const config = LEVEL_CONFIG[level]

    // 获取当前 agent 的更新时间
    const agent = await this.agentRepo.findOne({ where: { id: agentId } })
    const updatedAt = agent?.levelUpdatedAt ? new Date(agent.levelUpdatedAt) : new Date()

    const nextLevelMin = NEXT_LEVEL_THRESHOLD[level]
    const progress =
      nextLevelMin !== null
        ? Math.min(
            100,
            Math.round(((rolling12Months - config.min) / (nextLevelMin - config.min)) * 100),
          )
        : 100

    const info: AgentReputationInfo = {
      agentId,
      reputationScore: rolling12Months,
      level,
      levelLabel: config.label,
      commissionMultiplier: config.multiplier,
      currentLevelMin: config.min,
      nextLevelMin,
      progress: Math.max(0, progress),
      rolling12Months,
      updatedAt,
    }

    // 写入缓存
    await this.redis.setex(LEVEL_KEY(agentId), CACHE_TTL, JSON.stringify(info))

    return info
  }

  /**
   * 计算最近12个月的归属记录数（核销过至少1次的客户）
   */
  private async computeRolling12Months(agentId: string): Promise<number> {
    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    // 查找该分享员归属记录中，有过至少1次核销的客户数
    // customerId 有 first_redemption_at 且在12个月内
    const result = await this.attributionRepo
      .createQueryBuilder('a')
      .select('COUNT(DISTINCT a.customer_id)', 'count')
      .where('a.agent_id = :agentId', { agentId })
      .andWhere('a.first_redemption_at IS NOT NULL')
      .andWhere('a.first_redemption_at >= :twelveMonthsAgo', { twelveMonthsAgo })
      .getRawOne()

    return parseInt(result?.count ?? '0', 10)
  }

  /**
   * 根据有效客户数确定等级
   */
  private computeLevel(validCustomers: number): AgentLevel {
    if (validCustomers >= 501) return AgentLevel.KING
    if (validCustomers >= 201) return AgentLevel.DIAMOND
    if (validCustomers >= 51) return AgentLevel.GOLD
    if (validCustomers >= 11) return AgentLevel.SILVER
    return AgentLevel.BRONZE
  }

  /**
   * 根据等级获取佣金乘数
   */
  getMultiplier(level: AgentLevel): number {
    return LEVEL_CONFIG[level]?.multiplier ?? 1.0
  }

  // ========================
  // 批量更新
  // ========================

  /**
   * 批量更新所有分享员等级（定时任务，每月1号执行）
   */
  @Cron('0 3 1 * *') // 每月1号 03:00 执行
  async refreshAllAgentLevels(): Promise<void> {
    this.logger.log({ event: 'refresh_all_levels_start' })

    const agents = await this.agentRepo.find({ select: ['id'] })
    let updated = 0

    for (const agent of agents) {
      try {
        const rolling12Months = await this.computeRolling12Months(agent.id)
        const level = this.computeLevel(rolling12Months)
        const multiplier = LEVEL_CONFIG[level].multiplier

        await this.agentRepo.update(agent.id, {
          level,
          commissionMultiplier: multiplier,
          reputationScore: rolling12Months,
          levelUpdatedAt: new Date(),
        })

        // 清除缓存
        await this.redis.del(LEVEL_KEY(agent.id))
        updated++
      } catch (error) {
        this.logger.error({
          event: 'refresh_level_error',
          agentId: agent.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // 清除排行榜缓存
    await this.redis.del(LEADERBOARD_KEY)

    this.logger.log({
      event: 'refresh_all_levels_complete',
      total: agents.length,
      updated,
    })
  }

  // ========================
  // 排行榜
  // ========================

  /**
   * 平台排行榜（Top N 分享员）
   */
  async getLeaderboard(limit = 50): Promise<AgentReputationInfo[]> {
    // 检查缓存
    const cached = await this.redis.get(LEADERBOARD_KEY)
    if (cached) {
      const parsed = JSON.parse(cached) as AgentReputationInfo[]
      return parsed.slice(0, limit)
    }

    // 查询所有分享员，按有效客户数降序
    const agents = await this.agentRepo.find({
      order: { validCustomerCount: 'DESC', reputationScore: 'DESC' },
      take: limit,
    })

    const infos = await Promise.all(
      agents.map(async (a) => {
        const rolling = await this.computeRolling12Months(a.id)
        const level = this.computeLevel(rolling)
        const config = LEVEL_CONFIG[level]
        const nextLevelMin = NEXT_LEVEL_THRESHOLD[level]
        const progress =
          nextLevelMin !== null
            ? Math.min(
                100,
                Math.round(((rolling - config.min) / (nextLevelMin - config.min)) * 100),
              )
            : 100

        return {
          agentId: a.id,
          reputationScore: rolling,
          level,
          levelLabel: config.label,
          commissionMultiplier: config.multiplier,
          currentLevelMin: config.min,
          nextLevelMin,
          progress: Math.max(0, progress),
          rolling12Months: rolling,
          updatedAt: a.levelUpdatedAt ? new Date(a.levelUpdatedAt) : new Date(),
        }
      }),
    )

    // 缓存10分钟
    await this.redis.setex(LEADERBOARD_KEY, 600, JSON.stringify(infos))

    return infos
  }

  // ========================
  // 清除缓存（主动调用）
  // ========================

  /**
   * 清除指定分享员缓存（核销后调用）
   */
  async invalidateCache(agentId: string): Promise<void> {
    await this.redis.del(LEVEL_KEY(agentId))
    await this.redis.del(LEADERBOARD_KEY)
  }

  /**
   * 清除所有缓存
   */
  async invalidateAllCache(): Promise<void> {
    const keys = await this.redis.keys('agent:level:*')
    if (keys.length > 0) {
      await this.redis.del(...keys)
    }
    await this.redis.del(LEADERBOARD_KEY)
  }
}
