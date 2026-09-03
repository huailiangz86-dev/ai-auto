import { IsOptional, IsString, MaxLength } from 'class-validator'

/** A client-supplied reference is useful when the funding request is retried. */
export class FundGrowthPlanDto {
  @IsOptional() @IsString() @MaxLength(120) sourceReference?: string
}
