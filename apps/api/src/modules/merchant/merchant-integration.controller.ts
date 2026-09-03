// ============================================================
// Merchant system integration controller (STORY-AI-005)
// ============================================================

import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { UserRole } from '@ai-auto/shared'

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { Public } from '../common/decorators/public.decorator'
import { MerchantIntegrationService } from './merchant-integration.service'
import {
  CreateCouponProductMappingDto,
  CreateMerchantApiKeyDto,
  UpdateCouponProductMappingDto,
  VerifyMerchantCallbackDto,
} from './dto/integration.dto'

@ApiTags('商家系统集成 API')
@Controller('merchant/integrations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MerchantIntegrationController {
  constructor(private readonly integrationService: MerchantIntegrationService) {}

  @Post('api-keys')
  @Roles(UserRole.MERCHANT_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建商家系统 API Key' })
  createApiKey(@CurrentUser() user: { merchantId: string }, @Body() dto: CreateMerchantApiKeyDto) {
    return this.integrationService.createApiKey(user.merchantId, dto)
  }

  @Get('api-keys')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '查询 API Key 元数据（不返回 Secret）' })
  listApiKeys(@CurrentUser() user: { merchantId: string }) {
    return this.integrationService.listApiKeys(user.merchantId)
  }

  @Delete('api-keys/:keyId')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '撤销 API Key' })
  async revokeApiKey(@CurrentUser() user: { merchantId: string }, @Param('keyId') keyId: string) {
    await this.integrationService.revokeApiKey(user.merchantId, keyId)
    return { code: 0, message: 'API Key 已撤销' }
  }

  @Post('product-mappings')
  @Roles(UserRole.MERCHANT_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建券与商家商品映射' })
  createProductMapping(
    @CurrentUser() user: { merchantId: string },
    @Body() dto: CreateCouponProductMappingDto,
  ) {
    return this.integrationService.createProductMapping(user.merchantId, dto)
  }

  @Get('product-mappings')
  @Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_STAFF)
  @ApiOperation({ summary: '查询券与商家商品映射' })
  listProductMappings(@CurrentUser() user: { merchantId: string }) {
    return this.integrationService.listProductMappings(user.merchantId)
  }

  @Put('product-mappings/:mappingId')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '更新券与商家商品映射' })
  async updateProductMapping(
    @CurrentUser() user: { merchantId: string },
    @Param('mappingId') mappingId: string,
    @Body() dto: UpdateCouponProductMappingDto,
  ) {
    await this.integrationService.updateProductMapping(user.merchantId, mappingId, dto)
    return { code: 0, message: '更新成功' }
  }

  @Delete('product-mappings/:mappingId')
  @Roles(UserRole.MERCHANT_ADMIN)
  @ApiOperation({ summary: '删除券与商家商品映射' })
  async deleteProductMapping(
    @CurrentUser() user: { merchantId: string },
    @Param('mappingId') mappingId: string,
  ) {
    await this.integrationService.deleteProductMapping(user.merchantId, mappingId)
    return { code: 0, message: '删除成功' }
  }
}

@ApiTags('商家系统回调 API')
@Controller('merchant/callback')
export class MerchantCallbackController {
  constructor(private readonly integrationService: MerchantIntegrationService) {}

  @Post('verify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '商家 POS/ERP 签名核销回调' })
  @ApiHeader({ name: 'X-Merchant-Key', required: true })
  @ApiHeader({ name: 'X-Timestamp', required: true, description: 'Unix 秒级时间戳' })
  @ApiHeader({ name: 'X-Nonce', required: true })
  @ApiHeader({ name: 'X-Signature', required: true, description: 'sha256=<HMAC-SHA256>' })
  verify(
    @Headers('x-merchant-key') apiKey: string | undefined,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-timestamp') timestamp: string | undefined,
    @Headers('x-nonce') nonce: string | undefined,
    @Req() request: Request,
    @Body() body: VerifyMerchantCallbackDto,
  ) {
    return this.integrationService.verifyCallback(
      apiKey,
      signature,
      timestamp,
      nonce,
      request.ip ?? request.socket.remoteAddress,
      body,
    )
  }
}
