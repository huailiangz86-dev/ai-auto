import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import { Between, Repository } from 'typeorm'
import { Commission } from '../commission/entities/commission.entity'
import { SharingAgent } from './entities/sharing-agent.entity'
import { IncomeStatementQueryDto } from './dto/income-statement.dto'

const execFileAsync = promisify(execFile)
@Injectable()
export class IncomeStatementService {
  constructor(
    @InjectRepository(Commission) private readonly commissionRepo: Repository<Commission>,
    @InjectRepository(SharingAgent) private readonly agentRepo: Repository<SharingAgent>,
  ) {}
  async getData(agentId: string, query: IncomeStatementQueryDto) {
    const agent = await this.agentRepo.findOne({ where: { id: agentId } })
    if (!agent) throw new NotFoundException({ code: 9901, message: '分享员不存在' })
    const { start, end } = this.period(query)
    const commissions = await this.commissionRepo.find({
      where: { agentId, createdAt: Between(start, end) },
      order: { createdAt: 'ASC' },
    })
    const months = new Map<string, { income: number; platformFee: number; redemptions: number }>()
    for (const commission of commissions) {
      const key = commission.createdAt.toISOString().slice(0, 7)
      const month = months.get(key) ?? { income: 0, platformFee: 0, redemptions: 0 }
      month.income += Number(commission.agentFinalPayout)
      month.platformFee += Number(commission.platformFee)
      month.redemptions += 1
      months.set(key, month)
    }
    const totalIncome = commissions.reduce((sum, item) => sum + Number(item.agentFinalPayout), 0)
    const platformFee = commissions.reduce((sum, item) => sum + Number(item.platformFee), 0)
    return {
      agentId,
      agentName: agent.nickname || agent.phone,
      period: `${start.toISOString().slice(0, 10)} 至 ${new Date(end.getTime() - 1).toISOString().slice(0, 10)}`,
      generatedAt: new Date().toISOString(),
      summary: {
        totalIncome: this.money(totalIncome),
        platformFee: this.money(platformFee),
        redemptions: commissions.length,
      },
      months: Array.from(months, ([month, item]) => ({
        month,
        income: this.money(item.income),
        platformFee: this.money(item.platformFee),
        redemptions: item.redemptions,
      })),
      taxNotice: '税务申报及缴纳义务由分享员自行承担。',
    }
  }
  async renderPdf(agentId: string, query: IncomeStatementQueryDto) {
    const data = await this.getData(agentId, query)
    const stamp = `${agentId}-${Date.now()}`
    const input = join(tmpdir(), `ai-auto-income-${stamp}.json`)
    const output = join(tmpdir(), `ai-auto-income-${stamp}.pdf`)
    await fs.writeFile(input, JSON.stringify(data), 'utf8')
    try {
      await execFileAsync(
        process.env.PYTHON_EXECUTABLE || 'python',
        [join(process.cwd(), 'scripts', 'render-income-statement.py'), input, output],
        { timeout: 30000 },
      )
      return { data, file: await fs.readFile(output) }
    } finally {
      await Promise.allSettled([fs.rm(input, { force: true }), fs.rm(output, { force: true })])
    }
  }
  private period(query: IncomeStatementQueryDto) {
    if (query.startDate || query.endDate) {
      if (!query.startDate || !query.endDate)
        throw new BadRequestException({
          code: 9902,
          message: '自定义导出须同时提供 startDate 与 endDate',
        })
      const start = new Date(`${query.startDate}T00:00:00.000Z`)
      const end = new Date(`${query.endDate}T00:00:00.000Z`)
      end.setUTCDate(end.getUTCDate() + 1)
      if (start >= end)
        throw new BadRequestException({ code: 9903, message: '结束日期必须晚于开始日期' })
      return { start, end }
    }
    const year = query.year ?? new Date().getUTCFullYear()
    return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) }
  }
  private money(value: number) {
    return value.toFixed(2)
  }
}
