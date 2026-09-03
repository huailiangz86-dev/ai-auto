import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import {
  CreateMarketingProductDto,
  ListMarketingProductsDto,
  UpdateMarketingProductDto,
} from './dto/marketing-product.dto'
import { MarketingProductService } from './marketing-product.service'

@ApiTags('营销商品 API')
@Controller('merchant/products')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MarketingProductController {
  constructor(private readonly marketingProductService: MarketingProductService) {}

  @Get()
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_STAFF)
  @ApiOperation({ summary: '营销商品列表' })
  list(@CurrentUser() user: { merchantId: string }, @Query() query: ListMarketingProductsDto) {
    return this.marketingProductService.listProducts(user.merchantId, query)
  }

  @Post()
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '创建营销商品' })
  create(@CurrentUser() user: { merchantId: string }, @Body() dto: CreateMarketingProductDto) {
    return this.marketingProductService.createProduct(user.merchantId, dto)
  }

  @Put(':productId')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '更新营销商品与 SKU' })
  update(
    @CurrentUser() user: { merchantId: string },
    @Param('productId') productId: string,
    @Body() dto: UpdateMarketingProductDto,
  ) {
    return this.marketingProductService.updateProduct(user.merchantId, productId, dto)
  }

  @Post(':productId/on-sale')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '上架营销商品' })
  onSale(@CurrentUser() user: { merchantId: string }, @Param('productId') productId: string) {
    return this.marketingProductService.changeProductStatus(user.merchantId, productId, 'on_sale')
  }

  @Post(':productId/off-shelf')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '下架营销商品' })
  offShelf(@CurrentUser() user: { merchantId: string }, @Param('productId') productId: string) {
    return this.marketingProductService.changeProductStatus(user.merchantId, productId, 'off_shelf')
  }
}
