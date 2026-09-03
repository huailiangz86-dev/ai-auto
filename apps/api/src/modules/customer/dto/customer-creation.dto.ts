import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { PlatformType } from '@ai-auto/shared'

export class GenerateCustomerVideoDto {
  @ApiPropertyOptional({ description: '关联优惠券 ID' })
  @IsOptional()
  @IsString()
  couponId?: string

  @ApiPropertyOptional({ description: '关联活动 ID' })
  @IsOptional()
  @IsString()
  campaignId?: string

  @ApiProperty({ description: '目标平台', enum: PlatformType, default: PlatformType.WECHAT })
  @IsEnum(PlatformType)
  platform: PlatformType = PlatformType.WECHAT

  @ApiPropertyOptional({ description: '视频时长（秒）', default: 30, minimum: 15, maximum: 60 })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(60)
  durationSeconds?: number = 30
}

export class GenerateCustomerPosterDto {
  @ApiPropertyOptional({ description: '关联优惠券 ID' })
  @IsOptional()
  @IsString()
  couponId?: string

  @ApiPropertyOptional({ description: '关联活动 ID' })
  @IsOptional()
  @IsString()
  campaignId?: string

  @ApiProperty({ description: '目标平台', enum: PlatformType, default: PlatformType.WECHAT })
  @IsEnum(PlatformType)
  platform: PlatformType = PlatformType.WECHAT

  @ApiPropertyOptional({ description: '海报风格' })
  @IsOptional()
  @IsString()
  style?: string

  @ApiPropertyOptional({ description: '色彩方案' })
  @IsOptional()
  @IsString()
  colorScheme?: string

  @ApiPropertyOptional({ description: '生成变体数量', default: 3, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  variantCount?: number = 3
}
