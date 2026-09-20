import {
  IsArray,
  IsDateString,
  IsInt,
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
import { GROWTH_TASK_TYPES, GrowthTaskType } from '../entities/growth-task.entity'

export class CreateGrowthPlanDto {
  @IsNotEmpty() @IsString() @MaxLength(2000) goalBrief!: string
  @IsNotEmpty() @IsString() @MaxLength(80) goalMetric!: string
  @IsOptional() @IsString() @IsIn(GROWTH_TASK_TYPES) taskType?: GrowthTaskType
  @IsOptional() @IsNumber() @Min(0) baselineValue?: number
  @IsNumber() @Min(0.01) targetValue!: number
  @IsNumber() @Min(0.01) budget!: number
  @IsDateString() startAt!: string
  @IsDateString() endAt!: string
  @IsOptional() @IsUUID() storeId?: string
  @IsOptional() @IsString() @MaxLength(2000) acceptableRiskBoundary?: string
  @IsOptional() @IsNumber() @Min(0) acceptableRoiBoundary?: number
}
export class GrowthIntakeDto {
  @IsNotEmpty() @IsString() @MaxLength(2000) message!: string
  @IsOptional() @IsArray() history?: { role: 'user' | 'assistant'; content: string }[]
  @IsOptional() @IsObject() current?: Record<string, unknown>
}
export class ApproveGrowthPlanDto {
  @IsInt() @Min(1) optionId!: number
}
export class ListGrowthPlansDto {
  @IsOptional() @IsInt() @Min(1) page?: number = 1
  @IsOptional() @IsInt() @Min(1) pageSize?: number = 20
}
