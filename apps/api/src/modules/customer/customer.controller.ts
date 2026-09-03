// ============================================================
// AI auto - Customer Controller
// Attribution (365-day lock) + Coupon claiming endpoints
// ============================================================

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole } from '@ai-auto/shared'

import { CustomerService } from './customer.service'
import { CustomerShareService } from './customer-share.service'
import { CustomerAuthService } from './customer-auth.service'
import { CustomerCreationService } from './customer-creation.service'
import {
  CreateAttributionDto,
  ClaimCouponDto,
  RegisterCustomerDto,
  ListCustomerCouponsDto,
  DiscoverNearbyDto,
  ScanClaimDto,
  SearchMerchantsDto,
  UpdateCouponTrackingConsentDto,
} from './dto/customer.dto'
import { PrepareCustomerShareDto, RecordReferralDto } from './dto/customer-share.dto'
import { MiniProgramLoginDto } from './dto/customer-auth.dto'
import { GenerateCustomerPosterDto, GenerateCustomerVideoDto } from './dto/customer-creation.dto'
import {
  ConfirmCopywritingDto,
  GenerateCopywritingDto,
  ListCopywritingDto,
} from '../content/dto/copywriting.dto'

@ApiTags('客户 API')
@Controller('customer')
export class CustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly customerShareService: CustomerShareService,
    private readonly customerAuthService: CustomerAuthService,
    private readonly customerCreationService: CustomerCreationService,
  ) {}

  // ========================
  // 归属管理（C端/分享员）
  // ========================

  @Post('attribution')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '记录客户归属（首击锁定）' })
  async createAttribution(@Body() dto: CreateAttributionDto) {
    return this.customerService.createAttribution(dto)
  }

  @Get('attribution/:customerId')
  @ApiOperation({ summary: '获取客户当前归属' })
  async getAttribution(@Param('customerId') customerId: string) {
    return this.customerService.getActiveAttribution(customerId)
  }

  @Get('attribution/:customerId/history')
  @ApiOperation({ summary: '获取客户归属历史' })
  async getAttributionHistory(@Param('customerId') customerId: string) {
    return this.customerService.getAttributionHistory(customerId)
  }

  // ========================
  // 客户注册（C端）
  // ========================

  @Post('auth/wechat/mini-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '微信小程序登录并签发客户 JWT' })
  async miniProgramLogin(@Body() dto: MiniProgramLoginDto) {
    return this.customerAuthService.miniProgramLogin(dto.code, dto.phoneCode)
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '客户注册（微信授权/手机号）' })
  async register(@Body() dto: RegisterCustomerDto) {
    return this.customerService.registerCustomer(dto)
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取客户信息' })
  async getProfile(@CurrentUser() user: { id: string }) {
    return this.customerService.getCustomer(user.id)
  }

  // ========================
  // 隐私与个人数据权利（STORY-AI-040）
  // ========================

  @Post('privacy/export-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '请求导出本人平台数据' })
  async requestPersonalDataExport(@CurrentUser() user: { id: string }) {
    return this.customerService.requestPersonalDataExport(user.id)
  }

  @Get('privacy/export-requests/:requestId/download')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: '下载本人已请求的个人数据 JSON' })
  async downloadPersonalDataExport(
    @CurrentUser() user: { id: string },
    @Param('requestId') requestId: string,
  ) {
    return this.customerService.downloadPersonalDataExport(user.id, requestId)
  }

  // ========================
  // 领券（C端）
  // ========================

  @Post('coupons/claim')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'C端领券' })
  @HttpCode(HttpStatus.CREATED)
  async claimCoupon(@CurrentUser() user: { id: string }, @Body() dto: ClaimCouponDto) {
    return this.customerService.claimCoupon(user.id, dto)
  }

  @Get('coupons')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: '我的优惠券列表' })
  async listMyCoupons(@CurrentUser() user: { id: string }, @Query() query: ListCustomerCouponsDto) {
    return this.customerService.listCustomerCoupons(user.id, query)
  }

  @Get('coupons/:couponId/detail')
  @ApiOperation({ summary: '获取公开优惠券详情（分享落地页）' })
  async getCouponDetail(@Param('couponId') couponId: string) {
    return this.customerService.getCouponDetail(couponId)
  }

  @Get('coupons/:customerCouponId/evidence')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: '查看本人优惠券的核销证据与隐私状态' })
  async getCouponEvidence(
    @CurrentUser() user: { id: string },
    @Param('customerCouponId') customerCouponId: string,
  ) {
    return this.customerService.getCouponEvidence(user.id, customerCouponId)
  }

  @Post('coupons/:customerCouponId/evidence-consent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新本人优惠券的来源追踪同意状态' })
  async updateCouponEvidenceConsent(
    @CurrentUser() user: { id: string },
    @Param('customerCouponId') customerCouponId: string,
    @Body() dto: UpdateCouponTrackingConsentDto,
  ) {
    return this.customerService.updateCouponTrackingConsent(
      user.id,
      customerCouponId,
      dto.trackingConsent,
    )
  }

  // ========================
  // 领券发现（C端 - STORY-AI-016）
  // ========================

  @Get('discover/nearby')
  @ApiOperation({ summary: 'LBS 发现附近商家优惠' })
  async discoverNearby(@Query() query: DiscoverNearbyDto) {
    return this.customerService.discoverNearbyCoupons(query)
  }

  @Post('coupons/scan-claim')
  @UseGuards(JwtAuthGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '扫码领券' })
  async scanClaimCoupon(@CurrentUser() user: { id: string }, @Body() dto: ScanClaimDto) {
    return this.customerService.scanClaimCoupon(user.id, dto)
  }

  // ========================
  // 社交分享与裂变（STORY-AI-019）
  // ========================

  @Post('shares/:customerCouponId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '准备分享：首次分享自动成为分享员' })
  async prepareShare(
    @CurrentUser() user: { id: string },
    @Param('customerCouponId') customerCouponId: string,
    @Body() dto: PrepareCustomerShareDto,
  ) {
    return this.customerShareService.prepareShare(
      user.id,
      customerCouponId,
      dto.platform ?? 'wechat_friend',
    )
  }

  @Post('shares/:customerCouponId/record')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '记录已完成的微信分享' })
  async recordShare(
    @CurrentUser() user: { id: string },
    @Param('customerCouponId') customerCouponId: string,
    @Body() dto: PrepareCustomerShareDto,
  ) {
    return this.customerShareService.recordShare(
      user.id,
      customerCouponId,
      dto.platform ?? 'wechat_friend',
    )
  }

  @Post('shares/referrals/:agentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '记录分享链接落地归属（365 天首击锁定）' })
  async recordReferral(
    @CurrentUser() user: { id: string },
    @Param('agentId') agentId: string,
    @Body() _dto: RecordReferralDto,
  ) {
    await this.customerShareService.assertReferralIsNotSelf(user.id, agentId)
    return this.customerService.createAttribution({
      customerId: user.id,
      agentId,
      sourceType: 'share_link',
      sourcePlatform: 'wechat',
    })
  }

  @Get('shares/performance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: '查看当前客户的分享推广效果' })
  async getPromotionPerformance(@CurrentUser() user: { id: string }) {
    return this.customerShareService.getPromotionPerformance(user.id)
  }

  // ========================
  // AI 创作（C端 - STORY-AI-036）
  // ========================

  @Get('ai-creation/copywriting/estimate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'C端预估 AI 文案费用' })
  async estimateCustomerCopywriting(
    @CurrentUser() user: { id: string },
    @Query('count') count = 3,
  ) {
    return this.customerCreationService.estimateCopywriting(user.id, Number(count))
  }

  @Post('ai-creation/copywriting/generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'C端生成推广文案（复用 AI 文案服务）' })
  async generateCustomerCopywriting(
    @CurrentUser() user: { id: string },
    @Body() dto: GenerateCopywritingDto,
  ) {
    return this.customerCreationService.generateCopywriting(user.id, dto)
  }

  @Post('ai-creation/copywriting/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'C端确认推广文案并生成追踪链接' })
  async confirmCustomerCopywriting(
    @CurrentUser() user: { id: string },
    @Body() dto: ConfirmCopywritingDto,
  ) {
    return this.customerCreationService.confirmCopywriting(user.id, dto)
  }

  @Get('ai-creation/copywriting')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'C端 AI 文案历史' })
  async listCustomerCopywriting(
    @CurrentUser() user: { id: string },
    @Query() query: ListCopywritingDto,
  ) {
    return this.customerCreationService.listCopywriting(user.id, query)
  }

  @Post('ai-creation/video/generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'C端创建 AI 短视频任务（复用 AI 视频服务）' })
  async generateCustomerVideo(
    @CurrentUser() user: { id: string },
    @Body() dto: GenerateCustomerVideoDto,
  ) {
    return this.customerCreationService.generateVideo(user.id, dto)
  }

  @Get('ai-creation/video/:contentId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询本人 AI 视频任务进度' })
  async getCustomerVideoStatus(
    @CurrentUser() user: { id: string },
    @Param('contentId') contentId: string,
  ) {
    return this.customerCreationService.getVideoStatus(user.id, contentId)
  }

  @Post('ai-creation/poster/generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'C端生成推广海报（复用 AI 海报服务）' })
  async generateCustomerPoster(
    @CurrentUser() user: { id: string },
    @Body() dto: GenerateCustomerPosterDto,
  ) {
    return this.customerCreationService.generatePoster(user.id, dto)
  }

  @Get('search')
  @ApiOperation({ summary: '搜索商家/品类/关键词' })
  async searchMerchants(@Query() query: SearchMerchantsDto) {
    return this.customerService.searchMerchants(query)
  }
}
