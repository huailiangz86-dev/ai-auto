// ============================================================
// AI auto - Core API Service
// Application module
// ============================================================

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { HealthModule } from './modules/health/health.module'
import { AuthModule } from './modules/auth/auth.module'
import { MerchantModule } from './modules/merchant/merchant.module'
import { AgentModule } from './modules/agent/agent.module'
import { CampaignModule } from './modules/campaign/campaign.module'
import { CustomerModule } from './modules/customer/customer.module'
import { CommissionModule } from './modules/commission/commission.module'
import { ContentModule } from './modules/content/content.module'
import { AdminModule } from './modules/admin/admin.module'
import { AIBridgeModule } from './modules/ai-bridge/ai-bridge.module'
import { AnalyticsModule } from './modules/analytics/analytics.module'
import { RedisModule } from './modules/redis/redis.module'
import configuration from './config/configuration'

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host', 'localhost'),
        port: config.get('database.port', 5432),
        username: config.get('database.username', 'ai_auto'),
        password: config.get('database.password', 'ai_auto_dev'),
        database: config.get('database.name', 'ai_auto_dev'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize: config.get('database.synchronize', false),
        logging: config.get('database.logging', false),
        autoLoadEntities: true,
      }),
    }),

    // Redis
    RedisModule,

    // Rate limiting (in-memory, per-instance)
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Feature modules
    HealthModule,
    AuthModule,
    MerchantModule,
    AgentModule,
    CampaignModule,
    CustomerModule,
    CommissionModule,
    ContentModule,
    AdminModule,
    AIBridgeModule,
    AnalyticsModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Global middleware
  }
}
