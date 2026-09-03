import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'

export class RegisterCampaignMeasurementProtocolDto {
  @IsIn(['geo_holdout', 'audience_holdout']) method!: 'geo_holdout' | 'audience_holdout'
  @IsNotEmpty() @IsString() @MaxLength(2000) experimentGroupDefinition!: string
  @IsNotEmpty() @IsString() @MaxLength(2000) controlGroupDefinition!: string
  @IsDateString() baselineStartAt!: string
  @IsDateString() baselineEndAt!: string
  @IsDateString() observationStartAt!: string
  @IsDateString() observationEndAt!: string
  @IsNotEmpty() @IsString() @MaxLength(2000) ordersDefinition!: string
  @IsNotEmpty() @IsString() @MaxLength(2000) gmvDefinition!: string
}

export class PilotWeeklyEvidenceQueryDto {
  @IsOptional() @IsUUID() campaignId?: string
  @IsOptional() @IsDateString() weekStartAt?: string
}
