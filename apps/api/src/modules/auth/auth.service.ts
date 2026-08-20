// ============================================================
// Auth Service - Authentication logic
// ============================================================

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    // TODO: Implement user validation from database
    // This is a placeholder - real implementation in STORY-AI-003
    return null;
  }

  async login(user: any) {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: this.jwtService.sign(payload, {
        expiresIn: this.configService.get('jwt.refreshTokenExpiry', '7d'),
      }),
      expires_in: 900, // 15 minutes in seconds
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const newPayload = {
        sub: payload.sub,
        username: payload.username,
        role: payload.role,
      };
      return {
        access_token: this.jwtService.sign(newPayload),
        expires_in: 900,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async sendSmsCode(phone: string): Promise<{ success: boolean }> {
    // TODO: Integrate SMS service (Aliyun SMS / 腾讯云 SMS)
    // Placeholder: Generate 6-digit code, store in Redis with 5min TTL
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[SMS] Sending code ${code} to ${phone}`);
    return { success: true };
  }

  async verifySmsCode(phone: string, code: string): Promise<boolean> {
    // TODO: Verify code from Redis
    return code === '123456'; // Placeholder
  }

  generateIdempotencyKey(prefix: string, ...parts: (string | number)[]): string {
    return [prefix, ...parts.map(String)].join(':');
  }
}
