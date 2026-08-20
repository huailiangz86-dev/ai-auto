// ============================================================
// Auth Controller - All authentication endpoints
// ============================================================

import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { SmsService } from './services/sms.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { RolesGuard } from './guards/roles.guard'
import { CurrentUser } from './decorators/current-user.decorator'
import { Roles } from './decorators/roles.decorator'
import { UserRole } from '@ai-auto/shared'
import {
  MerchantRegisterDto,
  MerchantLoginDto,
  AgentRegisterDto,
  AgentLoginDto,
  SendSmsCodeDto,
  SmsLoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private smsService: SmsService,
  ) {}

  // ==================== Merchant ====================

  @Post('merchant/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register as a merchant' })
  @ApiResponse({ status: 201, description: 'Merchant registered successfully' })
  async merchantRegister(@Body() dto: MerchantRegisterDto) {
    return this.authService.merchantRegister(dto)
  }

  @Post('merchant/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Merchant login with phone + password' })
  async merchantLogin(@Body() dto: MerchantLoginDto) {
    return this.authService.merchantLogin(dto)
  }

  // ==================== Agent ====================

  @Post('agent/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register as a sharing agent' })
  async agentRegister(@Body() dto: AgentRegisterDto) {
    return this.authService.agentRegister(dto)
  }

  @Post('agent/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Agent login with phone + password' })
  async agentLogin(@Body() dto: AgentLoginDto) {
    return this.authService.agentLogin(dto)
  }

  // ==================== SMS ====================

  @Post('sms/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send SMS verification code' })
  async sendSmsCode(@Body() dto: SendSmsCodeDto) {
    return this.smsService.sendCode(dto.phone, 'login')
  }

  @Post('sms/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with phone + SMS code (agent only)' })
  async smsLogin(@Body() dto: SmsLoginDto) {
    return this.authService.agentSmsLogin(dto.phone, dto.code)
  }

  // ==================== Token ====================

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refresh_token)
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current session' })
  async logout(@CurrentUser() user: any) {
    return { success: true, message: 'Logged out successfully' }
  }

  // ==================== Profile ====================

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@CurrentUser() user: any) {
    return this.authService.getUserProfile(user.id, user.role)
  }

  // ==================== Password ====================

  @Post('password/change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change current password' })
  async changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user.id, user.role, dto.currentPassword, dto.newPassword)
    return { success: true, message: 'Password changed successfully' }
  }

  @Post('password/reset/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send reset password SMS code' })
  async resetPasswordSend(@Body() dto: { phone: string }) {
    return this.smsService.sendCode(dto.phone, 'reset_password')
  }

  @Post('password/reset/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with SMS code' })
  async resetPasswordConfirm(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.phone, dto.code, dto.newPassword)
    return { success: true, message: 'Password reset successfully' }
  }

  // ==================== Admin ====================

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin login' })
  async adminLogin(@Body() dto: { username: string; password: string }) {
    return this.authService.adminLogin(dto.username, dto.password)
  }
}
