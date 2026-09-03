import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator'

export class CreateGrowthPlanDto {
  @IsNotEmpty() @IsString() @MaxLength(2000) goalBrief!: string
  @IsNotEmpty() @IsString() @MaxLength(80) goalMetric!: string
  @IsOptional() @IsNumber() @Min(0) baselineValue?: number = 0
  @IsNumber() @Min(0.01) targetValue!: number
  @IsNumber() @Min(0.01) budget!: number
  @IsDateString() startAt!: string
  @IsDateString() endAt!: string
  @IsOptional() @IsUUID() storeId?: string
  @IsOptional() @IsString() @MaxLength(2000) acceptableRiskBoundary?: string
  @IsOptional() @IsNumber() @Min(0) acceptableRoiBoundary?: number
}
export class ApproveGrowthPlanDto { @IsInt() @Min(1) optionId!: number }
export class ListGrowthPlansDto { @IsOptional() @IsInt() @Min(1) page?: number = 1; @IsOptional() @IsInt() @Min(1) pageSize?: number = 20 }
