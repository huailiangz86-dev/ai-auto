import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator'

/** Criteria the merchant can inspect before an invitation is issued. */
export class CreatorMatchQueryDto {
  @IsNotEmpty() @IsString() @MaxLength(40) channel!: string
  @IsOptional() @IsString() @MaxLength(40) contentType?: string
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  categories?: string[]
}

/** A batch invitation creates one Creator Task per selected Creator. */
export class InviteMatchedCreatorsDto extends CreatorMatchQueryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  creatorIds!: string[]
  @IsNotEmpty() @IsString() @MaxLength(10000) brief!: string
  @IsDateString() deadline!: string
  @IsNumber() @Min(0) baseReward!: number
  @IsOptional() @IsObject() performanceReward?: Record<string, unknown>
  @IsOptional() @IsNumber() @Min(0) campaignCredits?: number = 0
  @IsOptional() @IsString() @MaxLength(120) trackingId?: string
}
