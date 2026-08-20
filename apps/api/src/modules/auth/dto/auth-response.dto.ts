// ============================================================
// Auth Response DTOs
// ============================================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'

// ---------- Auth Response ----------

export class AuthTokensResponse {
  @ApiProperty()
  access_token!: string

  @ApiProperty()
  refresh_token!: string

  @ApiProperty()
  expires_in!: number

  @ApiProperty()
  token_type!: string
}

export class MerchantProfileResponse {
  @ApiProperty()
  id!: string

  @ApiProperty()
  businessName!: string

  @ApiProperty()
  phone!: string

  @ApiProperty()
  role!: UserRole

  @ApiProperty()
  subscriptionStatus!: string

  @ApiPropertyOptional()
  businessType?: string

  @ApiPropertyOptional()
  industryCategory?: string

  @ApiPropertyOptional()
  province?: string

  @ApiPropertyOptional()
  city?: string

  @ApiProperty()
  auditStatus!: string

  @ApiProperty()
  createdAt!: Date
}

export class AgentProfileResponse {
  @ApiProperty()
  id!: string

  @ApiProperty()
  phone!: string

  @ApiPropertyOptional()
  nickname?: string

  @ApiPropertyOptional()
  avatar?: string

  @ApiProperty()
  role!: UserRole

  @ApiProperty()
  level!: string

  @ApiProperty()
  reputationScore!: number

  @ApiProperty()
  validCustomerCount!: number

  @ApiProperty()
  auditStatus!: string

  @ApiProperty()
  createdAt!: Date
}

export class SmsSendResponse {
  @ApiProperty()
  success!: boolean

  @ApiPropertyOptional()
  message?: string

  @ApiPropertyOptional({ description: 'Dev mode: the actual code (only in development)' })
  devCode?: string
}

// ---------- Swagger Schema Registration ----------

export const AuthTokensSchema = {
  type: 'object',
  properties: {
    access_token: { type: 'string' },
    refresh_token: { type: 'string' },
    expires_in: { type: 'number' },
    token_type: { type: 'string' },
  },
}

export const ErrorResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: { type: 'string', example: 'Invalid credentials' },
    message: { type: 'string' },
    statusCode: { type: 'number', example: 401 },
  },
}
