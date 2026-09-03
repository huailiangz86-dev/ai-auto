import { IsOptional, IsString } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class MiniProgramLoginDto {
  @ApiProperty({ description: 'uni.login 获取的微信临时 code' })
  @IsString()
  code!: string

  @ApiPropertyOptional({ description: 'getPhoneNumber 返回的手机号授权 code' })
  @IsOptional()
  @IsString()
  phoneCode?: string
}
