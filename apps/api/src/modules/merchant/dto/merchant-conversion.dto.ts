import { IsOptional, IsUUID } from 'class-validator'

/** The conversion center is scoped by the authenticated merchant on the server. */
export class MerchantConversionCenterQueryDto {
  @IsOptional()
  @IsUUID('4')
  campaignId?: string
}
