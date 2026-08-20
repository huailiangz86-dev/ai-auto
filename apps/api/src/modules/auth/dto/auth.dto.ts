// ============================================================
// Auth DTOs - Authentication Data Transfer Objects
// ============================================================

import { IsString, IsPhoneNumber, IsEnum, IsOptional, MinLength, Matches } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'

// ---------- Merchant Auth ----------

export class MerchantRegisterDto {
  @ApiProperty({ description: 'Business name', example: '星巴克咖啡店' })
  @IsString()
  @MinLength(2)
  businessName!: string

  @ApiProperty({ description: 'Phone number', example: '13812345678' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: 'Invalid Chinese mobile number' })
  phone!: string

  @ApiProperty({ description: 'Login password', example: 'SecurePass123' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string

  @ApiPropertyOptional({ description: 'Business type', example: 'enterprise' })
  @IsString()
  @IsOptional()
  businessType?: string

  @ApiPropertyOptional({ description: 'Industry category' })
  @IsString()
  @IsOptional()
  industryCategory?: string
}

export class MerchantLoginDto {
  @ApiProperty({ description: 'Phone number', example: '13812345678' })
  @IsString()
  phone!: string

  @ApiProperty({ description: 'Password', example: 'SecurePass123' })
  @IsString()
  password!: string
}

// ---------- Agent Auth ----------

export class AgentRegisterDto {
  @ApiProperty({ description: 'Phone number', example: '13987654321' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: 'Invalid Chinese mobile number' })
  phone!: string

  @ApiProperty({ description: 'Login password', example: 'SecurePass123' })
  @IsString()
  @MinLength(8)
  password!: string

  @ApiPropertyOptional({ description: 'Nickname', example: '咖啡达人' })
  @IsString()
  @IsOptional()
  nickname?: string

  @ApiPropertyOptional({ description: 'Invitation code' })
  @IsString()
  @IsOptional()
  inviteCode?: string
}

export class AgentLoginDto {
  @ApiProperty({ description: 'Phone number', example: '13987654321' })
  @IsString()
  phone!: string

  @ApiProperty({ description: 'Password', example: 'SecurePass123' })
  @IsString()
  password!: string
}

// ---------- SMS Auth ----------

export class SendSmsCodeDto {
  @ApiProperty({ description: 'Phone number', example: '13812345678' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: 'Invalid Chinese mobile number' })
  phone!: string
}

export class SmsLoginDto {
  @ApiProperty({ description: 'Phone number', example: '13812345678' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: 'Invalid Chinese mobile number' })
  phone!: string

  @ApiProperty({ description: 'SMS verification code', example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'SMS code must be 6 digits' })
  code!: string
}

export class BindPhoneDto {
  @ApiProperty({ description: 'Phone number to bind' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: 'Invalid Chinese mobile number' })
  phone!: string

  @ApiProperty({ description: 'SMS verification code' })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string
}

// ---------- Token Refresh ----------

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token' })
  @IsString()
  refresh_token!: string
}

// ---------- Password ----------

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  currentPassword!: string

  @ApiProperty({ description: 'New password' })
  @IsString()
  @MinLength(8)
  newPassword!: string
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Phone number' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/)
  phone!: string

  @ApiProperty({ description: 'SMS verification code' })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string

  @ApiProperty({ description: 'New password' })
  @IsString()
  @MinLength(8)
  newPassword!: string
}
