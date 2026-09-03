import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

export class MarketingProductSkuDto {
  @IsOptional() @IsString() skuId?: string
  @IsNotEmpty() @IsString() @MaxLength(200) skuName!: string
  @IsNotEmpty() @IsString() @MaxLength(100) skuCode!: string
  @IsOptional() @IsObject() attributes?: Record<string, string>
  @IsNumber() @Min(0) price!: number
  @IsOptional() @IsNumber() @Min(0) marketPrice?: number
  @IsOptional() @IsInt() @Min(0) stock?: number | null
  @IsOptional() @IsIn(['on_sale', 'off_shelf']) status?: string
}

export class CreateMarketingProductDto {
  @IsNotEmpty() @IsString() @MaxLength(200) productName!: string
  @IsNotEmpty() @IsString() @MaxLength(100) category!: string
  @IsOptional() @IsString() @MaxLength(2000) description?: string
  @IsOptional() @IsIn(['managed', 'external']) productSource?: 'managed' | 'external'
  @ValidateIf((dto) => dto.productSource === 'external')
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  externalProductId?: string
  @IsOptional() @IsIn(['draft', 'on_sale', 'off_shelf']) status?: 'draft' | 'on_sale' | 'off_shelf'
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarketingProductSkuDto)
  skus!: MarketingProductSkuDto[]
}

export class UpdateMarketingProductDto extends CreateMarketingProductDto {}

export class ListMarketingProductsDto {
  @IsOptional() @IsIn(['draft', 'on_sale', 'off_shelf']) status?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number = 20
}

export class CatalogueProductSelectionDto {
  @IsNotEmpty() @IsString() productId!: string
  @IsOptional() @IsArray() @IsString({ each: true }) skuIds?: string[]
}

export class ReplaceCouponProductMappingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CatalogueProductSelectionDto)
  productSelections!: CatalogueProductSelectionDto[]
}

export class CreateExternalCouponProductMappingDto {
  @IsNotEmpty() @IsString() @MaxLength(100) externalProductId!: string
  @IsOptional() @IsString() @MaxLength(200) externalProductName?: string
  @IsOptional() @IsString() @MaxLength(100) externalCategory?: string
  @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(500) callbackUrl?: string
}
