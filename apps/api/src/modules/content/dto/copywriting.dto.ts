// ============================================================
// AI auto - Copywriting DTO
// STORY-AI-020: AI 文案生成
// ============================================================

import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
  Max,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PlatformType } from '@ai-auto/shared'

// ---- 文案生成请求 ----
export class GenerateCopywritingDto {
  @ApiPropertyOptional({ description: '券ID' })
  @IsOptional()
  @IsString()
  couponId?: string

  @ApiPropertyOptional({ description: '活动ID' })
  @IsOptional()
  @IsString()
  campaignId?: string

  @ApiProperty({ description: '目标平台', enum: PlatformType })
  @IsNotEmpty()
  @IsEnum(PlatformType)
  platform!: PlatformType

  @ApiPropertyOptional({ description: '语气风格', default: '热情' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tone?: string = '热情'

  @ApiPropertyOptional({ description: '生成数量（3-5）', default: 3 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  count?: number = 3

  @ApiPropertyOptional({ description: '附加关键词' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  keywords?: string
}

// ---- Token 费用预估 ----
export class CopywritingEstimateDto {
  @ApiProperty({ description: '预估 Token 消耗量（input + output）' })
  estimatedTokens!: number

  @ApiProperty({ description: '预估费用（元）' })
  estimatedCost!: number

  @ApiProperty({ description: '分享员当前 AI Token 余额' })
  currentBalance!: number

  @ApiProperty({ description: '余额是否足够' })
  isSufficient!: boolean
}

// ---- 文案变体 ----
export class CopywritingOptionDto {
  @ApiProperty({ description: '变体序号' })
  index!: number

  @ApiProperty({ description: '语气风格' })
  tone!: string

  @ApiProperty({ description: '文案内容' })
  copy!: string

  @ApiPropertyOptional({ description: '预估 Token 数' })
  estimatedTokens?: number
}

// ---- 文案生成结果（草稿，待确认） ----
export class CopywritingDraftDto {
  @ApiProperty({ description: '草稿ID（用于确认）' })
  draftId!: string

  @ApiProperty({ description: 'AI 模型' })
  aiModel!: string

  @ApiProperty({ description: '实际 Token 消耗量' })
  actualTokens!: number

  @ApiProperty({ description: '实际费用（元）' })
  actualCost!: number

  @ApiProperty({ description: '生成的文案变体' })
  options!: CopywritingOptionDto[]

  @ApiProperty({ description: '过期时间（分钟）' })
  expiresInMinutes!: number
}

// ---- 确认文案选择 ----
export class ConfirmCopywritingDto {
  @ApiProperty({ description: '草稿ID' })
  @IsNotEmpty()
  @IsString()
  draftId!: string

  @ApiProperty({ description: '选择的变体序号（0-based）' })
  @IsNumber()
  @Min(0)
  selectedIndex!: number

  @ApiPropertyOptional({ description: '修改后的文案（可选）' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  editedCopy?: string
}

// ---- 确认结果 ----
export class ConfirmResultDto {
  @ApiProperty({ description: 'Content 记录ID' })
  contentId!: string

  @ApiProperty({ description: '文案内容' })
  copy!: string

  @ApiProperty({ description: '追踪链接' })
  trackingUrl!: string

  @ApiPropertyOptional({ description: '追踪二维码 URL' })
  trackingQrCode?: string | null

  @ApiProperty({ description: '扣费金额' })
  deductedAmount!: number

  @ApiProperty({ description: '剩余 AI Token 余额' })
  remainingBalance!: number

  @ApiProperty({ description: '内容状态' })
  status!: string
}

// ---- 文案历史列表 ----
export class ListCopywritingDto {
  @ApiPropertyOptional({ description: '状态筛选' })
  @IsOptional()
  @IsString()
  status?: string

  @ApiPropertyOptional({ description: '平台筛选' })
  @IsOptional()
  @IsEnum(PlatformType)
  platform?: PlatformType

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  pageSize?: number = 20
}
