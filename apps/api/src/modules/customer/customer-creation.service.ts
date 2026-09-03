import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PlatformType } from '@ai-auto/shared'

import { AgentWallet } from '../agent/entities/agent-wallet.entity'
import { CopywritingService } from '../content/copywriting.service'
import { PosterService } from '../content/poster.service'
import { VideoService } from '../content/video.service'
import {
  ConfirmCopywritingDto,
  GenerateCopywritingDto,
  ListCopywritingDto,
} from '../content/dto/copywriting.dto'
import { CustomerShareService } from './customer-share.service'
import { GenerateCustomerPosterDto, GenerateCustomerVideoDto } from './dto/customer-creation.dto'

/**
 * C 端 AI 创作的门面服务。
 *
 * 这里不实现第二套生成逻辑；所有内容、追踪链接和计费都交由 STORY-AI-020/021/022
 * 已实现的服务完成。客户第一次创作时复用分享场景的无感转化，确保内容归属到其分享员账户。
 */
@Injectable()
export class CustomerCreationService {
  constructor(
    private readonly customerShareService: CustomerShareService,
    private readonly copywritingService: CopywritingService,
    private readonly videoService: VideoService,
    private readonly posterService: PosterService,
    @InjectRepository(AgentWallet)
    private readonly walletRepo: Repository<AgentWallet>,
  ) {}

  async estimateCopywriting(customerId: string, count = 3) {
    const agentId = await this.resolveAgentId(customerId)
    return this.copywritingService.estimateCostAsync(agentId, count)
  }

  async generateCopywriting(customerId: string, dto: GenerateCopywritingDto) {
    return this.copywritingService.generateCopywriting(await this.resolveAgentId(customerId), dto)
  }

  async confirmCopywriting(customerId: string, dto: ConfirmCopywritingDto) {
    return this.copywritingService.confirmCopywriting(await this.resolveAgentId(customerId), dto)
  }

  async listCopywriting(customerId: string, query: ListCopywritingDto) {
    return this.copywritingService.listCopywriting(await this.resolveAgentId(customerId), query)
  }

  async generateVideo(customerId: string, dto: GenerateCustomerVideoDto) {
    return this.videoService.generateVideo(await this.resolveAgentId(customerId), dto)
  }

  async getVideoStatus(customerId: string, contentId: string) {
    const agentId = await this.resolveAgentId(customerId)
    return this.videoService.getJobStatus(contentId, agentId)
  }

  async generatePoster(customerId: string, dto: GenerateCustomerPosterDto) {
    return this.posterService.generatePoster(await this.resolveAgentId(customerId), dto)
  }

  private async resolveAgentId(customerId: string): Promise<string> {
    const { agent } = await this.customerShareService.ensureCustomerAgent(customerId)

    // 内容服务以分享员钱包作为 AI 余额账本。首次无感转化也需要有真实钱包记录，
    // 而不是在前端伪造可用余额。
    const wallet = await this.walletRepo.findOne({ where: { agentId: agent.id } })
    if (!wallet) {
      await this.walletRepo.save(
        this.walletRepo.create({
          agentId: agent.id,
          pendingSettlementBalance: 0,
          settledBalance: 0,
          frozenBalance: 0,
          totalEarned: 0,
          totalPlatformFee: 0,
          totalSettled: 0,
          totalWithdrawn: 0,
          aiTokenBalance: 0,
          status: true,
        }),
      )
    }

    if (!agent.status) {
      throw new NotFoundException({ code: 3006, message: '分享员账户不可用' })
    }
    return agent.id
  }
}
