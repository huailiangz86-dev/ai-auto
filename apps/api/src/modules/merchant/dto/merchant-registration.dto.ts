// ============================================================
// AI auto - Merchant Registration DTO
// ============================================================

import { Type } from 'class-transformer'
import {
  IsNotEmpty,
  IsString,
  IsPhoneNumber,
  IsEmail,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  Max,
  IsUUID,
  ValidateNested,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// ---- 注册 ----
export class RegisterMerchantDto {
  @ApiProperty({ description: '商户全称', example: '老王火锅（望京SOHO店）' })
  @IsNotEmpty({ message: '商户名称不能为空' })
  @IsString()
  @MaxLength(200)
  businessName!: string

  @ApiProperty({ description: '联系人姓名', example: '王老板' })
  @IsNotEmpty({ message: '联系人姓名不能为空' })
  @IsString()
  @MaxLength(100)
  contactName!: string

  @ApiProperty({ description: '手机号', example: '13812345678' })
  @IsNotEmpty({ message: '手机号不能为空' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone!: string

  @ApiProperty({ description: '短信验证码', example: '123456' })
  @IsNotEmpty({ message: '验证码不能为空' })
  @IsString()
  @MinLength(4)
  @MaxLength(6)
  verificationCode!: string

  @ApiPropertyOptional({ description: '邮箱', example: 'wang@example.com' })
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string

  @ApiPropertyOptional({
    description: '商户类型',
    enum: ['enterprise', 'individual', 'personal'],
    example: 'enterprise',
  })
  @IsOptional()
  @IsEnum(['enterprise', 'individual', 'personal'])
  businessType?: string

  @ApiPropertyOptional({ description: '行业分类', example: 'catering' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industryCategory?: string

  @ApiPropertyOptional({ description: '营业执照号', example: '91110105MA01XXXX' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  businessLicenseNo?: string

  @ApiPropertyOptional({ description: '详细地址', example: '北京市朝阳区望京SOHO T3 1层' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressDetail?: string

  @ApiPropertyOptional({ description: '纬度', example: 39.984 })
  @IsOptional()
  @IsNumber()
  latitude?: number

  @ApiPropertyOptional({ description: '经度', example: 116.472 })
  @IsOptional()
  @IsNumber()
  longitude?: number

  @ApiProperty({ description: '首个门店名称', example: '望京SOHO店' })
  @IsNotEmpty({ message: '门店名称不能为空' })
  @IsString()
  @MaxLength(200)
  storeName!: string

  @ApiPropertyOptional({ description: '注册来源平台', example: ['wechat'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platformAuthorizations?: string[]
}

// ---- 更新商户信息 ----
export class UpdateMerchantProfileDto {
  @ApiPropertyOptional({ description: '联系人姓名' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactName?: string

  @ApiPropertyOptional({ description: '邮箱' })
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiPropertyOptional({ description: '详细地址' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressDetail?: string

  @ApiPropertyOptional({ description: '纬度' })
  @IsOptional()
  @IsNumber()
  latitude?: number

  @ApiPropertyOptional({ description: '经度' })
  @IsOptional()
  @IsNumber()
  longitude?: number
}

// ---- 商户详情响应 ----
export class MerchantProfileResponseDto {
  merchantId!: string
  businessName!: string
  contactName!: string
  phone!: string
  email?: string | null
  businessType!: string
  industryCategory?: string
  status!: string
  auditStatus!: string
  subscription!: {
    plan: string
    status: string
    expiresAt: string
    storesUsed: number
    storesLimit: number
  } | null
  apiKey?: string
  apiSecretHint?: string
  createdAt!: string
}
