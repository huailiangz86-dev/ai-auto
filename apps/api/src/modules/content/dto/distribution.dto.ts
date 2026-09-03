// ============================================================
// AI auto - Distribution DTO
// STORY-AI-023: 多平台一键分发
// ============================================================

import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  Min,
  Max,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PlatformType } from '@ai-auto/shared'

// ---- 批量分发请求 ----
export class DistributeContentDto {
  @ApiProperty({ description: '内容ID（Content.id）' })
  @IsNotEmpty()
  @IsString()
  contentId!: string

  @ApiProperty({ description: '目标平台列表', enum: PlatformType, isArray: true })
  @IsArray()
  @IsEnum(PlatformType, { each: true })
  platforms!: PlatformType[]

  @ApiPropertyOptional({ description: '自定义文案（可选，覆盖 AI 生成内容）' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  customContent?: string
}

// ---- 单平台发布请求 ----
export class PublishSingleDto {
  @ApiProperty({ description: '内容ID（Content.id）' })
  @IsNotEmpty()
  @IsString()
  contentId!: string

  @ApiProperty({ description: '目标平台', enum: PlatformType })
  @IsEnum(PlatformType)
  platform!: PlatformType

  @ApiPropertyOptional({ description: '自定义文案（可选）' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  customContent?: string
}

// ---- 发布结果 ----
export class PublishResultItemDto {
  @ApiProperty({ description: '平台' })
  platform!: string

  @ApiProperty({ description: '状态' })
  status!: string

  @ApiPropertyOptional({ description: '已发布内容的 URL' })
  postUrl?: string | null

  @ApiPropertyOptional({ description: '手动模式的内容（供复制粘贴）' })
  formattedContent?: string | null

  @ApiPropertyOptional({ description: '错误信息' })
  error?: string | null

  @ApiProperty({ description: '是否为手动模式' })
  isManual!: boolean
}

// ---- 批量分发结果 ----
export class DistributeResultDto {
  @ApiProperty({ description: '内容ID' })
  contentId!: string

  @ApiProperty({ description: '各平台发布结果', type: [PublishResultItemDto] })
  results!: PublishResultItemDto[]

  @ApiProperty({ description: 'API 发布成功数量' })
  totalPublished!: number

  @ApiProperty({ description: '失败数量' })
  totalFailed!: number

  @ApiProperty({ description: '手动模式数量' })
  totalManual!: number
}

// ---- 跨平台统计 ----
export class AggregatedStatsDto {
  @ApiProperty({ description: '总曝光' })
  totalImpressions!: number

  @ApiProperty({ description: '总点击' })
  totalClicks!: number

  @ApiProperty({ description: '总评论' })
  totalComments!: number

  @ApiProperty({ description: '总分享' })
  totalShares!: number

  @ApiProperty({ description: '总点赞' })
  totalLikes!: number

  @ApiProperty({ description: '各平台明细' })
  platformBreakdown!: {
    platform: string
    impressions: number
    clicks: number
    comments: number
    shares: number
    likes: number
  }[]
}
