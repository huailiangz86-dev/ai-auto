import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator'

export class UpdateCreatorProfileDto {
  @IsOptional() @IsString() @MaxLength(100) nickname?: string
  @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(255) avatar?: string
  @IsOptional() @IsString() @MaxLength(100) region?: string
  @IsOptional() @IsArray() @IsString({ each: true }) creatorCategories?: string[]
  @IsOptional() @IsObject() taskPreferences?: Record<string, unknown>
}
export class SubmitCreatorVerificationDto {
  @IsNotEmpty() @IsString() @MaxLength(100) realName!: string
  @IsNotEmpty() @IsString() @MaxLength(50) idCardNo!: string
}
export class CreatorTaskListQueryDto {
  @IsOptional() @IsString() @MaxLength(24) status?: string
  @IsOptional() @IsNumber() @Min(1) page?: number = 1
  @IsOptional() @IsNumber() @Min(1) pageSize?: number = 20
}

export class CreateCreatorTaskAppealDto {
  @IsIn(['task', 'payout']) target!: 'task' | 'payout'
  @IsNotEmpty() @IsString() @MaxLength(2000) reason!: string
  @IsOptional() @IsObject() evidence?: Record<string, unknown>
}
export class VerifyCreatorTaskPayoutDto {
  @IsNumber() @Min(0) verifiedAmount!: number
  @IsOptional() @IsObject() evidence?: Record<string, unknown>
}
export class ListCreatorTaskAppealsDto {
  @IsOptional() @IsIn(['all', 'open', 'accepted', 'rejected', 'withdrawn']) status?:
    'all' | 'open' | 'accepted' | 'rejected' | 'withdrawn' = 'open'
  @IsOptional() @IsIn(['task', 'payout']) target?: 'task' | 'payout'
  @IsOptional() @IsUUID() merchantId?: string
  @IsOptional() @IsUUID() creatorId?: string
  @IsOptional() @IsUUID() creatorTaskId?: string
  @IsOptional() @IsNumber() @Min(1) page?: number = 1
  @IsOptional() @IsNumber() @Min(1) pageSize?: number = 20
}
export class ResolveCreatorTaskAppealDto {
  @IsIn(['accepted', 'rejected']) decision!: 'accepted' | 'rejected'
  @IsNotEmpty() @IsString() @MaxLength(2000) resolution!: string
}
