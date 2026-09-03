import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { UserRole } from '@ai-auto/shared'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { CreateRewardProductDto, CreateSharingChallengeDto } from './dto/gamification.dto'
import { GamificationService } from './gamification.service'

@ApiTags('C端游戏化')
@Controller('customer/gamification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CUSTOMER)
@ApiBearerAuth()
export class CustomerGamificationController {
  constructor(private readonly gamificationService: GamificationService) {}
  @Get('overview') @ApiOperation({ summary: '游戏化概览：积分、挑战和排行' }) overview(
    @CurrentUser() user: { id: string },
  ) {
    return this.gamificationService.getOverview(user.id)
  }
  @Get('challenges') @ApiOperation({ summary: '我的分享挑战' }) challenges(
    @CurrentUser() user: { id: string },
  ) {
    return this.gamificationService.listChallenges(user.id)
  }
  @Get('rewards') @ApiOperation({ summary: '积分商品库' }) rewards() {
    return this.gamificationService.listRewards()
  }
  @Post('rewards/:rewardProductId/redeem') @ApiOperation({ summary: '积分兑换礼品' }) redeem(
    @CurrentUser() user: { id: string },
    @Param('rewardProductId') rewardProductId: string,
  ) {
    return this.gamificationService.redeemReward(user.id, rewardProductId)
  }
  @Post('mystery-boxes/open') @ApiOperation({ summary: '开启已解锁的盲盒' }) openMysteryBox(
    @CurrentUser() user: { id: string },
  ) {
    return this.gamificationService.openMysteryBox(user.id)
  }
  @Get('leaderboard') @ApiOperation({ summary: '平台或商家分享达人排行榜' }) leaderboard(
    @Query('merchantId') merchantId?: string,
  ) {
    return this.gamificationService.getLeaderboard(merchantId)
  }
}

@ApiTags('游戏化运营')
@Controller('gamification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class GamificationAdminController {
  constructor(private readonly gamificationService: GamificationService) {}
  @Post('rewards') @ApiOperation({ summary: '管理积分商品库：创建商品' }) createReward(
    @Body() dto: CreateRewardProductDto,
  ) {
    return this.gamificationService.createReward(dto)
  }
  @Post('challenges') @ApiOperation({ summary: '创建分享挑战' }) createChallenge(
    @Body() dto: CreateSharingChallengeDto,
  ) {
    return this.gamificationService.createChallenge(dto)
  }
}
