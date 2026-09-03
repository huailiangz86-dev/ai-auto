import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'

export class CreateSharingTaskDto {
  @IsNotEmpty() @IsString() couponId!: string
  @IsNotEmpty() @IsString() targetAudience!: string
  @IsNumber() @Min(0.01) budget!: number
  @IsDateString() deadline!: string
  @IsOptional() @IsInt() @Min(1) maxAgents?: number
  @IsOptional() @IsInt() @Min(0) targetClaims?: number
  @IsOptional() @IsInt() @Min(1) targetRedemptions?: number
  @IsNumber() @Min(0) rewardPerRedemption!: number
}
