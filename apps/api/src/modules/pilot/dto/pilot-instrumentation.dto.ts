import { IsDateString, IsOptional, IsUUID } from 'class-validator'
export class PilotInstrumentationQueryDto {
  @IsOptional() @IsUUID() merchantId?: string
  @IsOptional() @IsUUID() campaignId?: string
  @IsOptional() @IsUUID() creatorId?: string
  @IsOptional() @IsUUID() growthTaskId?: string
  @IsOptional() @IsUUID() creatorTaskId?: string
  @IsOptional() @IsDateString() startAt?: string
  @IsOptional() @IsDateString() endAt?: string
}