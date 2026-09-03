// ============================================================
// AI auto - Agent Platform Binding DTO
// Multi-platform account binding via OAuth
// ============================================================

import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PlatformType } from '@ai-auto/shared'

// ---- OAuth 授权 URL ----
export class GetOAuthUrlDto {
  @ApiProperty({ description: '平台类型', enum: PlatformType })
  @IsString()
  @IsEnum(PlatformType)
  platformType!: PlatformType

  @ApiPropertyOptional({ description: '重定向回前端 URL（可选）' })
  @IsOptional()
  @IsString()
  redirectUri?: string
}

export class OAuthUrlResponseDto {
  @ApiProperty({ description: 'OAuth 授权 URL' })
  authorizeUrl!: string

  @ApiProperty({ description: '平台类型' })
  platformType!: string

  @ApiPropertyOptional({ description: 'state 参数（用于 CSRF 防护）' })
  state?: string
}

// ---- OAuth 回调 ----
export class OAuthCallbackDto {
  @ApiProperty({ description: '平台返回的 code' })
  @IsString()
  @MaxLength(500)
  code!: string

  @ApiPropertyOptional({ description: 'state 参数' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  state?: string

  @ApiPropertyOptional({ description: '错误码' })
  @IsOptional()
  @IsString()
  error?: string

  @ApiPropertyOptional({ description: '错误描述' })
  @IsOptional()
  @IsString()
  errorDescription?: string
}

// ---- 绑定结果 ----
export class BindingResultDto {
  @ApiProperty({ description: '绑定记录ID' })
  bindingId!: string

  @ApiProperty({ description: '平台类型' })
  platformType!: string

  @ApiProperty({ description: '平台昵称' })
  platformNickname!: string

  @ApiProperty({ description: '绑定状态' })
  isActive!: boolean

  @ApiPropertyOptional({ description: 'Token 过期时间' })
  tokenExpireAt?: Date | null

  @ApiProperty({ description: '是否为企业号' })
  isEnterpriseAccount!: boolean
}

// ---- 账号列表 ----
export class PlatformAccountDto {
  @ApiProperty({ description: '绑定ID' })
  id!: string

  @ApiProperty({ description: '平台类型' })
  platformType!: PlatformType

  @ApiProperty({ description: '平台昵称' })
  platformNickname?: string | null

  @ApiPropertyOptional({ description: '平台头像 URL' })
  platformAvatar?: string | null

  @ApiProperty({ description: '绑定时间' })
  boundAt!: Date

  @ApiPropertyOptional({ description: 'Token 过期时间' })
  tokenExpireAt?: Date | null

  @ApiProperty({ description: '是否正常' })
  isActive!: boolean

  @ApiProperty({ description: '是否为企业号' })
  isEnterpriseAccount!: boolean

  @ApiPropertyOptional({ description: '总曝光量' })
  totalImpressions?: number

  @ApiPropertyOptional({ description: '总点击量' })
  totalClicks?: number

  @ApiPropertyOptional({ description: '总领取量' })
  totalClaims?: number
}

// ---- Token 刷新 ----
export class RefreshTokenDto {
  @ApiProperty({ description: '绑定ID' })
  @IsString()
  bindingId!: string
}

// ---- 解除绑定 ----
export class UnbindPlatformDto {
  @ApiProperty({ description: '解除绑定原因' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string
}

// ---- 授权状态 ----
export class OAuthStatusDto {
  @ApiProperty({ description: '平台类型' })
  platformType!: PlatformType

  @ApiProperty({ description: '是否已授权' })
  isAuthorized!: boolean

  @ApiPropertyOptional({ description: '已绑定账号数' })
  boundCount?: number

  @ApiPropertyOptional({ description: 'Token 过期时间' })
  tokenExpireAt?: Date | null

  @ApiPropertyOptional({ description: '需要重新授权' })
  needsReauthorize?: boolean
}
