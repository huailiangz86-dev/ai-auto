// ============================================================
// Local Strategy for Passport (username/password fallback)
// Note: Primary auth uses phone-based login, this is a fallback
// ============================================================

import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-local'
import { AuthService } from '../auth.service'

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'username' })
  }

  // Note: This validates as username but we treat it as phone internally
  // Primary phone-based auth is handled directly in AuthController
  async validate(username: string, password: string): Promise<any> {
    // Try agent login first
    try {
      const result = await this.authService.agentLogin({
        phone: username,
        password,
      })
      return result.user
    } catch {
      // Try merchant login
      try {
        const result = await this.authService.merchantLogin({
          phone: username,
          password,
        })
        return result.user
      } catch {
        throw new UnauthorizedException()
      }
    }
  }
}
