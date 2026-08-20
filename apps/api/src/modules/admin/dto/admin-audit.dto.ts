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
