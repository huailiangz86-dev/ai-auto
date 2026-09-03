// ============================================================
// Merchant system integration DTOs (STORY-AI-005)
// ============================================================

import { Type } from 'class-transformer'
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateMerchantApiKeyDto {
  @ApiPropertyOptional({ description: '用于识别此密钥的名称', example: '北京门店 POS' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyName?: string

  @ApiPropertyOptional({ description: '允许调用回调接口的 IP 地址列表' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ipWhitelist?: string[]

  @ApiPropertyOptional({ description: '商家接收核销结果的回调地址' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  callbackUrl?: string

  @ApiPropertyOptional({ description: '每分钟调用上限', default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  rateLimitPerMinute?: number
}

export class CreateCouponProductMappingDto {
  @ApiProperty({ description: '平台优惠券 ID' })
  @IsUUID()
  couponId!: string

  @ApiProperty({ description: '商家 POS/ERP 商品 ID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  externalProductId!: string

  @ApiPropertyOptional({ description: '商家商品名称' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalProductName?: string

  @ApiPropertyOptional({ description: '商家商品分类' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalCategory?: string

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsOptional()
  @IsBoolean()
  status?: boolean
}

export class UpdateCouponProductMappingDto {
  @ApiPropertyOptional({ description: '商家商品名称' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalProductName?: string

  @ApiPropertyOptional({ description: '商家商品分类' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalCategory?: string

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  status?: boolean
}

/** Body sent by a merchant POS/ERP to the public verification callback. */
export class VerifyMerchantCallbackDto {
  @ApiProperty({ description: '顾客出示的券码' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  couponCode!: string

  @ApiProperty({ description: '实际交易金额（元）' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  transactionAmount!: number

  @ApiPropertyOptional({ description: '门店 ID' })
  @IsOptional()
  @IsUUID()
  storeId?: string

  @ApiPropertyOptional({ description: 'POS/ERP 商品 ID；提供时必须存在有效映射' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalProductId?: string

  @ApiProperty({ description: '商家侧交易流水号，用于核销幂等' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  merchantTransactionId!: string

  @ApiPropertyOptional({ description: '顾客出示券码的时间（ISO 8601）' })
  @IsOptional()
  @IsString()
  presentedAt?: string
}
