// ============================================================
// AI auto - Store Management DTO
// ============================================================

import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsPhoneNumber,
  MaxLength,
  Min,
  Max,
  Matches,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

// ---- 创建门店 ----
export class CreateStoreDto {
  @ApiProperty({ description: '门店名称', example: '望京SOHO店' })
  @IsNotEmpty({ message: '门店名称不能为空' })
  @IsString()
  @MaxLength(200)
  storeName!: string

  @ApiPropertyOptional({ description: '门店编号（商家自用）', example: 'STORE-001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  storeCode?: string

  @ApiPropertyOptional({ description: '省份', example: '北京市' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  province?: string

  @ApiPropertyOptional({ description: '城市', example: '北京市' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  city?: string

  @ApiPropertyOptional({ description: '区县', example: '朝阳区' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  district?: string

  @ApiPropertyOptional({ description: '详细地址', example: '望京SOHO T3 1层' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressDetail?: string

  @ApiPropertyOptional({ description: '纬度', example: 39.984 })
  @IsOptional()
  @IsNumber()
  latitude?: number

  @ApiPropertyOptional({ description: '经度', example: 116.472 })
  @IsOptional()
  @IsNumber()
  longitude?: number

  @ApiPropertyOptional({ description: '联系电话', example: '010-12345678' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string

  @ApiPropertyOptional({ description: '营业时间', example: '09:00-22:00' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessHours?: string
}

// ---- 更新门店 ----
export class UpdateStoreDto {
  @ApiPropertyOptional({ description: '门店名称' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  storeName?: string

  @ApiPropertyOptional({ description: '详细地址' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressDetail?: string

  @ApiPropertyOptional({ description: '纬度' })
  @IsOptional()
  @IsNumber()
  latitude?: number

  @ApiPropertyOptional({ description: '经度' })
  @IsOptional()
  @IsNumber()
  longitude?: number

  @ApiPropertyOptional({ description: '联系电话' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string

  @ApiPropertyOptional({ description: '营业时间', example: '09:00-22:00' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessHours?: string

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  status?: boolean
}

// ---- 门店列表查询 ----
export class ListStoresDto {
  @IsOptional()
  @IsString()
  status?: string

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20
}

// ---- 门店响应 ----
export class StoreResponseDto {
  storeId!: string
  storeName!: string
  storeCode!: string
  address!: string
  latitude!: number
  longitude!: number
  contactPhone!: string
  businessHours!: string
  status!: boolean
  agentCount!: number
  createdAt!: string
}
