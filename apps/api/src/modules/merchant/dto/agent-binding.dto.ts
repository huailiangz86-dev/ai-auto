// ============================================================
// AI auto - Merchant Agent Binding DTO
// Agent recruitment, registration, and binding
// ============================================================

import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  Min,
  Max,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { AuditStatus } from '@ai-auto/shared'

// ---- 生成招募链接 ----
export class CreateInviteDto {
  @ApiPropertyOptional({ description: '门店ID（不填则全局）' })
  @IsOptional()
  @IsString()
  storeId?: string

  @ApiPropertyOptional({ description: '招募类型', enum: ['link', 'qrcode', 'manual'] })
  @IsOptional()
  @IsString()
  inviteType?: string
}

export class InviteLinkResponseDto {
  @ApiProperty({ description: '招募链接' })
  inviteLink!: string

  @ApiPropertyOptional({ description: '二维码URL（可选）' })
  inviteQrCode?: string

  @ApiProperty({ description: '邀请码' })
  inviteCode!: string

  @ApiProperty({ description: '有效期（天）' })
  expiresInDays!: number
}

// ---- 分享员注册绑定 ----
export class AgentRegisterDto {
  @ApiProperty({ description: '手机号' })
  @IsNotEmpty({ message: '手机号不能为空' })
  @IsString()
  @MaxLength(20)
  phone!: string

  @ApiPropertyOptional({ description: '昵称' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nickname?: string

  @ApiProperty({ description: '邀请码' })
  @IsNotEmpty({ message: '邀请码不能为空' })
  @IsString()
  @MaxLength(20)
  inviteCode!: string

  @ApiPropertyOptional({ description: '验证码' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  verifyCode?: string
}

// ---- 商家审核分享员 ----
export class AuditAgentDto {
  @ApiProperty({ description: '审核结果', enum: ['approved', 'rejected'] })
  @IsNotEmpty({ message: '审核结果不能为空' })
  @IsString()
  result!: string

  @ApiPropertyOptional({ description: '审核意见' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  auditComment?: string
}

// ---- 商家管理列表 ----
export class ListBindingAgentsDto {
  @ApiPropertyOptional({
    description: '绑定状态',
    enum: ['pending', 'registered', 'active', 'rejected', 'unbound'],
  })
  @IsOptional()
  @IsString()
  status?: string

  @ApiPropertyOptional({ description: '开始日期' })
  @IsOptional()
  @IsString()
  startDate?: string

  @ApiPropertyOptional({ description: '结束日期' })
  @IsOptional()
  @IsString()
  endDate?: string

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

// ---- 分享员解绑 ----
export class UnbindAgentDto {
  @ApiPropertyOptional({ description: '解绑原因' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}
