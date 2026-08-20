// ============================================================
// Token Service - JWT token generation and validation
// ============================================================

import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Inject } from '@nestjs/common'
import { REDIS_CLIENT } from '../../redis/redis.module'
import { UserRole } from '@ai-auto/shared'

export interface TokenPayload {
  sub: string // User ID
  role: UserRole // User role
  type: 'access' | 'refresh'
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

@Injectable()
export class TokenService {
  private readonly accessExpiry: string
  private readonly refreshExpiry: string
  private readonly tokenPrefix = 'token:'

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(REDIS_CLIENT) private redis: any,
  ) {
    this.accessExpiry = this.configService.get('jwt.accessTokenExpiry', '15m') || '15m'
    this.refreshExpiry = this.configService.get('jwt.refreshTokenExpiry', '7d') || '7d'
  }

  /**
   * Generate access + refresh token pair for a user
   */
  generateTokens(userId: string, role: UserRole): AuthTokens {
    const accessPayload: TokenPayload = { sub: userId, role, type: 'access' }
    const refreshPayload: TokenPayload = { sub: userId, role, type: 'refresh' }

    const expiresInSeconds = this.parseExpiry(this.accessExpiry)

    return {
      access_token: this.jwtService.sign(accessPayload, { expiresIn: this.accessExpiry }),
      refresh_token: this.jwtService.sign(refreshPayload, { expiresIn: this.refreshExpiry }),
      expires_in: expiresInSeconds,
      token_type: 'Bearer',
    }
  }

  /**
   * Validate an access token and return the payload
   */
  validateAccessToken(token: string): TokenPayload {
    try {
      const payload = this.jwtService.verify<TokenPayload>(token)
      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type')
      }
      return payload
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error
      throw new UnauthorizedException('Invalid or expired token')
    }
  }

  /**
   * Refresh tokens using a valid refresh token
   */
  refreshTokens(refreshToken: string): AuthTokens {
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken)
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type')
      }
      // Generate new token pair
      return this.generateTokens(payload.sub, payload.role)
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  /**
   * Decode token without verification (for checking expiry)
   */
  decodeToken(token: string): TokenPayload | null {
    try {
      return this.jwtService.decode<TokenPayload>(token)
    } catch {
      return null
    }
  }

  /**
   * Invalidate all tokens for a user (logout all devices)
   */
  async invalidateUser(userId: string): Promise<void> {
    const pattern = `${this.tokenPrefix}${userId}:*`
    const keys = await this.redis.keys(pattern)
    if (keys.length > 0) {
      await this.redis.del(...keys)
    }
  }

  /**
   * Parse expiry string to seconds
   */
  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([mhd])$/)
    if (!match) return 900 // default 15m
    const value = parseInt(match[1], 10)
    switch (match[2]) {
      case 'm':
        return value * 60
      case 'h':
        return value * 3600
      case 'd':
        return value * 86400
      default:
        return 900
    }
  }
}
