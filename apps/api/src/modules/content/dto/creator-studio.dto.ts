import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'
import { PlatformType } from '@ai-auto/shared'

class CreatorStudioRequestDto {
  @IsUUID() creatorTaskId!: string
  @IsNotEmpty() @IsString() @MaxLength(100) sourceReference!: string
}

export class CreatorStudioGenerateDto extends CreatorStudioRequestDto {
  @IsEnum(PlatformType) platform!: PlatformType
  @IsOptional() @IsString() @MaxLength(50) tone?: string
  @IsOptional() @IsString() @MaxLength(2000) instructions?: string
}

export class CreatorStudioRewriteDto extends CreatorStudioRequestDto {
  @IsNotEmpty() @IsString() @MaxLength(5000) content!: string
  @IsOptional() @IsString() @MaxLength(1000) instructions?: string
  @IsOptional() @IsEnum(PlatformType) platform?: PlatformType
}

export class CreatorStudioScoreDto extends CreatorStudioRequestDto {
  @IsNotEmpty() @IsString() @MaxLength(5000) content!: string
  @IsOptional() @IsEnum(PlatformType) platform?: PlatformType
}

export class CreatorStudioPublishAdviceDto extends CreatorStudioRequestDto {
  @IsNotEmpty() @IsString() @MaxLength(5000) content!: string
  @IsEnum(PlatformType) platform!: PlatformType
  @IsOptional() @IsIn(['immediate', 'scheduled']) publishMode?: 'immediate' | 'scheduled'
}
