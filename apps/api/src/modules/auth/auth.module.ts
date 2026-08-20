// ============================================================
// Auth Module - Authentication & Authorization
// ============================================================

import { Module } from '@nestjs/common'
import { PassportModule } from '@nestjs/passport'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { TokenService, SmsService } from './services'
import { JwtStrategy } from './strategies/jwt.strategy'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { RolesGuard } from './guards/roles.guard'
import { Merchant } from '../merchant/entities/merchant.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { Admin } from '../admin/entities/admin.entity'
import { RedisModule } from '../redis/redis.module'

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('jwt.secret'),
        signOptions: { expiresIn: config.get('jwt.accessTokenExpiry', '15m') },
      }),
    }),
    TypeOrmModule.forFeature([Merchant, SharingAgent, Admin]),
    RedisModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, SmsService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AuthService, TokenService, SmsService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
