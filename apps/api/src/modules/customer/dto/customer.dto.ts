// ============================================================
// AI auto - Customer / Attribution DTO
// ============================================================

import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  IsPhoneNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// ---- 归属绑定 ----
export class CreateAttributionDto {
  @ApiProperty({ description: '客户ID', example: 'uuid-xxx' })
  @IsNotEmpty()
  @IsString()
  customerId!: string

  @ApiPropertyOptional({ description: '分享员ID（扫码/链接来源）' })
  @IsOptional()
  @IsString()
  agentId?: string

  @ApiPropertyOptional({ description: '活动ID' })
  @IsOptional()
  @IsString()
  campaignId?: string

  @ApiProperty({
    description: '来源类型',
    enum: ['share_link', 'qr_code', 'lbs', 'search', 'wechat_mp'],
  })
  @IsNotEmpty()
  @IsString()
  sourceType!: string

  @ApiPropertyOptional({ description: '来源平台', enum: ['wechat', 'douyin', 'xiaohongshu'] })
  @IsOptional()
  @IsString()
  sourcePlatform?: string

  @ApiPropertyOptional({ description: '点击 IP' })
  @IsOptional()
  @IsString()
  clickIp?: string

  @ApiPropertyOptional({ description: '设备指纹' })
  @IsOptional()
  @IsString()
  clickDeviceId?: string

  @ApiPropertyOptional({ description: 'User Agent' })
  @IsOptional()
  @IsString()
  clickUserAgent?: string
}

// ---- 领券 ----
export class ClaimCouponDto {
  @ApiProperty({ description: '优惠券ID' })
  @IsNotEmpty()
  @IsString()
  couponId!: string

  @ApiPropertyOptional({ description: '归属ID（扫码来源）' })
  @IsOptional()
  @IsString()
  attributionId?: string

  @ApiPropertyOptional({ description: '经度' })
  @IsOptional()
  @IsNumber()
  latitude?: number

  @ApiPropertyOptional({ description: '纬度' })
  @IsOptional()
  @IsNumber()
  longitude?: number
}

// ---- 客户注册 ----
export class RegisterCustomerDto {
  @ApiPropertyOptional({ description: '微信 OpenID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  wechatOpenid?: string

  @ApiPropertyOptional({ description: '手机号' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string
}

// ---- 查询 DTO ----
export class GetAttributionDto {
  @IsNotEmpty()
  @IsString()
  customerId!: string
}

export class ListCustomerCouponsDto {
  @IsOptional()
  @IsString()
  status?: string // active/used/expired

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
