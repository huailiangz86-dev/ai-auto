// ============================================================
// AI auto - Admin Audit DTO
// ============================================================

import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsIn,
  MaxLength,
  Min,
  Max,
} from 'class-validator'

// ---- 商户审核 ----
export class ApproveMerchantDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string
}

export class RejectMerchantDto {
  @IsNotEmpty({ message: '拒绝原因不能为空' })
  @IsString()
  @MaxLength(500)
  reason!: string
}

// ---- 分享员审核 ----
export class SuspendAgentDto {
  @IsNotEmpty({ message: '封禁原因不能为空' })
  @IsString()
  @MaxLength(500)
  reason!: string

  @IsOptional()
  frozenCommission?: boolean = true
}

export class RejectAgentDto {
  @IsNotEmpty({ message: '拒绝原因不能为空' })
  @IsString()
  @MaxLength(500)
  reason!: string
}

// ---- 风控与内容人工处理 ----
export class ResolveFraudAlertDto {
  @IsIn(['dismiss', 'review', 'freeze_commission'], { message: '无效的风控处理动作' })
  action!: 'dismiss' | 'review' | 'freeze_commission'

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string
}

export class ModerateContentDto {
  @IsIn(['passed', 'flagged', 'blocked'], { message: '无效的审核结论' })
  decision!: 'passed' | 'flagged' | 'blocked'

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string
}

// ---- 列表查询 ----
export class ListPendingMerchantsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20
}

export class ListPendingAgentsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20
}

// ---- v2 Creator governance ----
export class SetCreatorGrowthScoreDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  influence!: number

  @IsNumber()
  @Min(0)
  @Max(100)
  quality!: number

  @IsNumber()
  @Min(0)
  @Max(100)
  relevance!: number

  @IsNumber()
  @Min(0)
  @Max(100)
  conversion!: number

  @IsNumber()
  @Min(0)
  @Max(100)
  trust!: number

  @IsOptional()
  @IsString()
  @MaxLength(500)
  evidenceNote?: string
}

export class BlacklistCreatorDto {
  @IsNotEmpty({ message: '拉黑原因不能为空' })
  @IsString()
  @MaxLength(500)
  reason!: string
}