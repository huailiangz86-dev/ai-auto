import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class CreateRewardProductDto {
  @IsNotEmpty() @IsString() @MaxLength(120) name!: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsInt() @Min(0) pointsCost?: number
  @IsOptional() @IsInt() @Min(0) stock?: number
  @IsOptional() @IsString() merchantId?: string
  @IsOptional() @IsBoolean() mysteryBoxEnabled?: boolean
  @IsOptional() @IsBoolean() guaranteedReward?: boolean
  @IsOptional() @IsString() imageUrl?: string
}

export class CreateSharingChallengeDto {
  @IsNotEmpty() @IsString() @MaxLength(120) title!: string
  @IsNotEmpty() @IsString() description!: string
  @IsInt() @Min(1) targetShares!: number
  @IsOptional() @IsInt() @Min(0) rewardPoints?: number
  @IsOptional() @IsString() merchantId?: string
}
