// ============================================================
// AI auto - Settlement & Withdrawal DTO
// ============================================================

import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// ---- 提现申请 ----
export class CreateWithdrawalDto {
  @ApiProperty({ description: '提现金额（元）', example: 50.0, minimum: 10 })
  @IsNotEmpty({ message: '提现金额不能为空' })
  @IsNumber()
  @Min(10, { message: '最低提现金额为 ¥10' })
  amount!: number

  @ApiProperty({ description: '提现方式', enum: ['alipay', 'wechatpay', 'bank_card'] })
  @IsNotEmpty({ message: '提现方式不能为空' })
  @IsString()
  method!: string

  @ApiProperty({ description: '账户号码（支付宝账号/微信openid/银行卡号）' })
  @IsNotEmpty({ message: '账户号码不能为空' })
  @IsString()
  @MaxLength(100)
  accountNo!: string

  @ApiProperty({ description: '账户姓名' })
  @IsNotEmpty({ message: '账户姓名不能为空' })
  @IsString()
  @MaxLength(100)
  accountName!: string

  @ApiPropertyOptional({ description: '账户标识（支付宝user_id/微信openid/银行联行号）' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  accountIdentifier?: string
}

// ---- 提现记录查询 ----
export class ListWithdrawalsDto {
  @IsOptional()
  @IsString()
  status?: string

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
