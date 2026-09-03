import {
  IsDateString,
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
import { CREATOR_TASK_STATUSES, CreatorTaskStatus } from '../entities/growth-task.entity'

export class CreateGrowthTaskDto {
  @IsOptional() @IsUUID() storeId?: string
  @IsOptional() @IsUUID() campaignId?: string
  @IsNotEmpty() @IsString() @MaxLength(80) goalMetric!: string
  @IsOptional() @IsNumber() @Min(0) baselineValue?: number = 0
  @IsNumber() @Min(0.01) targetValue!: number
  @IsNumber() @Min(0.01) budget!: number
  @IsDateString() startAt!: string
  @IsDateString() endAt!: string
  @IsOptional() @IsString() @MaxLength(2000) acceptableRiskBoundary?: string
  @IsOptional() @IsNumber() @Min(0) acceptableRoiBoundary?: number
}

export class CreateCreatorTaskDto {
  @IsUUID() creatorId!: string
  @IsNotEmpty() @IsString() @MaxLength(40) channel!: string
  @IsNotEmpty() @IsString() @MaxLength(40) contentType!: string
  @IsNotEmpty() @IsString() @MaxLength(10000) brief!: string
  @IsDateString() deadline!: string
  @IsNumber() @Min(0) baseReward!: number
  @IsOptional() @IsObject() performanceReward?: Record<string, unknown>
  @IsOptional() @IsNumber() @Min(0) campaignCredits?: number = 0
  @IsOptional() @IsString() @MaxLength(120) trackingId?: string
}

export class TaskReasonDto {
  @IsNotEmpty() @IsString() @MaxLength(1000) reason!: string
}

export class ReviewCreatorTaskDto extends TaskReasonDto {
  @IsIn(['approve', 'reject']) decision!: 'approve' | 'reject'
}

export class ResolveRiskHoldDto extends TaskReasonDto {
  @IsIn(['resume', 'violation']) action!: 'resume' | 'violation'
}

/** Filters shared by the operations review and risk queues. */
export class OperationsQueueQueryDto {
  @IsOptional() @IsUUID() campaignId?: string
  @IsOptional() @IsUUID() merchantId?: string
  @IsOptional() @IsUUID() creatorId?: string
  @IsOptional() @IsUUID() growthTaskId?: string
  @IsOptional() @IsIn(CREATOR_TASK_STATUSES) status?: CreatorTaskStatus
  @IsOptional() @IsNumber() @Min(1) page?: number = 1
  @IsOptional() @IsNumber() @Min(1) pageSize?: number = 20
}

export class PublishCreatorTaskDto {
  @IsUrl({ require_tld: false }) @MaxLength(2000) publishedUrl!: string
}

export class ConsumeCampaignCreditsDto {
  @IsNumber() @Min(0.01) amount!: number
  @IsNotEmpty() @IsString() @MaxLength(120) sourceReference!: string
}
