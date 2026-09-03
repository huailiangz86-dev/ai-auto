// ============================================================
// AI auto - Campaign recommendation DTOs
// ============================================================

import { Type } from 'class-transformer'
import { IsInt, IsOptional, Max, Min } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class ListCampaignRecommendationsDto {
  @ApiPropertyOptional({ description: '返回推荐数量，默认 3，最多 6', minimum: 1, maximum: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(6)
  limit?: number
}
