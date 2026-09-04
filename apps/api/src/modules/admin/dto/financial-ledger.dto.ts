import { Type } from 'class-transformer'
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateFinancialLedgerEntryDto {
  @IsIn(['revenue', 'cogs', 'operating_cost', 'reserve'])
  classification!: 'revenue' | 'cogs' | 'operating_cost' | 'reserve'

  @IsNotEmpty()
  @IsString()
  @MaxLength(40)
  entryType!: string

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string

  @IsOptional()
  @IsUUID()
  merchantId?: string

  @IsOptional()
  @IsUUID()
  campaignId?: string

  @IsOptional()
  @IsUUID()
  creatorId?: string

  @IsOptional()
  @IsUUID()
  creatorTaskId?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceReference?: string

  @IsNotEmpty()
  @IsString()
  @MaxLength(160)
  idempotencyKey!: string

  @IsOptional()
  @IsDateString()
  occurredAt?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}

export class CampaignEconomicsQueryDto {
  @IsOptional()
  @IsUUID()
  campaignId?: string

  @IsOptional()
  @IsUUID()
  merchantId?: string
}
