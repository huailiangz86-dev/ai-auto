// ============================================================
// AI auto - Customer / Attribution / Coupon DTO
// ============================================================

import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  IsBoolean,
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

  @ApiPropertyOptional({ description: '是否同意将本券与来源内容/任务关联，用于核销归因', default: false })
  @IsOptional()
  @IsBoolean()
  trackingConsent?: boolean

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

export class UpdateCouponTrackingConsentDto {
  @ApiProperty({ description: '是否继续允许本券用于来源内容的核销归因' })
  @IsBoolean()
  trackingConsent!: boolean
}

// ============================================================
// C端领券发现 DTO（STORY-AI-016）
// ============================================================

// ---- LBS 发现附近商家优惠 ----
export class DiscoverNearbyDto {
  @ApiPropertyOptional({ description: '纬度' })
  @IsOptional()
  @IsNumber()
  latitude?: number

  @ApiPropertyOptional({ description: '经度' })
  @IsOptional()
  @IsNumber()
  longitude?: number

  @ApiPropertyOptional({ description: '城市名称（兜底）' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  city?: string

  @ApiPropertyOptional({ description: '搜索半径（米），默认 5000' })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(50000)
  radius?: number = 5000

  @ApiPropertyOptional({ description: '品类/关键词' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string

  @ApiPropertyOptional({ description: '分页', default: 1 })
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

// ---- 扫码领券 ----
export class ScanClaimDto {
  @ApiProperty({ description: '扫码得到的 couponCode 或 storeCode' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  code!: string

  @ApiPropertyOptional({ description: '门店ID（扫码来源）' })
  @IsOptional()
  @IsString()
  storeId?: string

  @ApiPropertyOptional({ description: '客户当前归属ID（可选）' })
  @IsOptional()
  @IsString()
  attributionId?: string
}

// ---- 商家/品类搜索 ----
export class SearchMerchantsDto {
  @ApiProperty({ description: '搜索关键词（商家名/品类/商品）' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  keyword!: string

  @ApiPropertyOptional({ description: '城市' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  city?: string

  @ApiPropertyOptional({ description: '分页', default: 1 })
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
