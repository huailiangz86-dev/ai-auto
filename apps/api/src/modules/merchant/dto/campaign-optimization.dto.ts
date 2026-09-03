import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator'

export class UpdateOptimizationSettingDto {
  @ApiPropertyOptional({ description: '开启后，建议会在设定上限内自动执行' })
  @IsOptional()
  @IsBoolean()
  autoAdjustEnabled?: boolean

  @ApiPropertyOptional({
    description: '单次预算或券面额变动上限（百分比）',
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxBudgetChangePercent?: number
}

export class ResolveOptimizationDto {
  @ApiProperty({ description: '是否确认执行本次优化建议' })
  @IsBoolean()
  approve!: boolean
}
