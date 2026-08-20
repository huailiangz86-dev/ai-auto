// ============================================================
// Auth Controller - Authentication endpoints
// ============================================================

import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { IsString, MinLength, IsMobilePhone } from 'class-validator';

class LoginDto {
  @IsString() username: string;
  @IsString() @MinLength(6) password: string;
}

class SendSmsDto {
  @IsMobilePhone('zh-CN') phone: string;
}

class SmsLoginDto {
  @IsMobilePhone('zh-CN') phone: string;
  @IsString() code: string;
}

class RefreshTokenDto {
  @IsString() refresh_token: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with username/password' })
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto.username, dto.password);
    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }
    return this.authService.login(user);
  }

  @Post('sms/send')
  @ApiOperation({ summary: 'Send SMS verification code' })
  async sendSmsCode(@Body() dto: SendSmsDto) {
    return this.authService.sendSmsCode(dto.phone);
  }

  @Post('sms/login')
  @ApiOperation({ summary: 'Login with phone + SMS code' })
  async smsLogin(@Body() dto: SmsLoginDto) {
    const valid = await this.authService.verifySmsCode(dto.phone, dto.code);
    if (!valid) {
      return { success: false, error: 'Invalid or expired code' };
    }
    // TODO: Find or create user by phone
    return { success: true };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refresh_token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user info' })
  async me(@Request() req) {
    return req.user;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate tokens' })
  async logout(@Request() req) {
    // TODO: Invalidate tokens in Redis
    return { success: true };
  }
}
