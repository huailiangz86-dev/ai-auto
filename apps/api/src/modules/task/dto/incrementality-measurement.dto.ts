import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class RecordIncrementalityMeasurementDto {
  @IsIn(['geo_holdout', 'audience_holdout']) method!: 'geo_holdout' | 'audience_holdout'
  @IsDateString() windowStartAt!: string
  @IsDateString() windowEndAt!: string
  @IsNumber() @Min(0) treatmentBaselineOrders!: number
  @IsNumber() @Min(0) controlBaselineOrders!: number
  @IsNumber() @Min(0) treatmentObservedOrders!: number
  @IsNumber() @Min(0) controlObservedOrders!: number
  @IsNumber() @Min(0) treatmentBaselineGmv!: number
  @IsNumber() @Min(0) controlBaselineGmv!: number
  @IsNumber() @Min(0) treatmentObservedGmv!: number
  @IsNumber() @Min(0) controlObservedGmv!: number
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(1000, { each: true }) assumptions?: string[]
}