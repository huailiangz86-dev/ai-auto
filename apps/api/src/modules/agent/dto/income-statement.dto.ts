import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator'

export class IncomeStatementQueryDto {
  @IsOptional() @IsInt() @Min(2020) @Max(2100) year?: number
  @IsOptional() @IsDateString() startDate?: string
  @IsOptional() @IsDateString() endDate?: string
}
