import { IsArray, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class ListLifecycleSubjectsDto {
  @IsOptional() @IsString() keyword?: string
  @IsOptional() @IsString() status?: string
  @IsOptional() @IsIn(['professional_creator', 'ordinary_user']) agentType?: 'professional_creator' | 'ordinary_user'
  @IsOptional() @IsInt() @Min(1) page: number = 1
  @IsOptional() @IsInt() @Min(1) pageSize: number = 20
}

export class SetCreatorTypeDto {
  @IsIn(['professional_creator', 'ordinary_user']) agentType!: 'professional_creator' | 'ordinary_user'
}

export class LifecycleReasonDto {
  @IsNotEmpty() @IsString() @MaxLength(500) reason!: string
}

export class RestoreLifecycleDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string
}

export class SetLifecycleTagsDto {
  @IsArray() @IsString({ each: true }) @MaxLength(32, { each: true }) tags!: string[]
}

export class CreateLifecycleNoteDto {
  @IsIn(['operation', 'risk', 'follow_up']) category!: 'operation' | 'risk' | 'follow_up'
  @IsNotEmpty() @IsString() @MaxLength(2000) content!: string
  @IsOptional() @IsString() @MaxLength(500) reason?: string
  @IsOptional() @IsDateString() followUpAt?: string
}

export class SendLifecycleNotificationDto {
  @IsNotEmpty() @IsString() @MaxLength(120) title!: string
  @IsNotEmpty() @IsString() @MaxLength(1000) body!: string
}

export class SetCreatorTaskLimitDto {
  @IsOptional() @IsInt() @Min(0) limit?: number
}
