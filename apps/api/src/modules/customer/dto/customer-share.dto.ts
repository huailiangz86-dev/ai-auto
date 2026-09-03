import { IsIn, IsOptional, IsString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class PrepareCustomerShareDto {
  @ApiPropertyOptional({ enum: ['wechat_friend', 'wechat_moment'] })
  @IsOptional()
  @IsString()
  @IsIn(['wechat_friend', 'wechat_moment'])
  platform?: 'wechat_friend' | 'wechat_moment'
}

export class RecordReferralDto {
  @ApiPropertyOptional({ description: '来源券 ID，用于审计与后续分析' })
  @IsOptional()
  @IsString()
  couponId?: string
}
