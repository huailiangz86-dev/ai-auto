import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class PrepareCustomerShareDto {
  @ApiPropertyOptional({ enum: ['wechat_friend', 'wechat_moment'] })
  @IsOptional()
  @IsString()
  @IsIn(['wechat_friend', 'wechat_moment'])
  platform?: 'wechat_friend' | 'wechat_moment'
}

export class RecordReferralDto {
  @ApiPropertyOptional({ description: '分享员 ID；普通用户分享链接兼容使用' })
  @IsOptional()
  @IsString()
  agentId?: string

  @ApiPropertyOptional({ description: '来源券 ID，用于审计与后续分析' })
  @IsOptional()
  @IsString()
  couponId?: string

  @ApiPropertyOptional({
    description: '达人内容专属 Tracking ID；服务端解析出达人和活动，不接受客户端传入任务 ID',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingId?: string
}
