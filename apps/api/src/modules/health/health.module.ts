// ============================================================
// Health Module - Application health check endpoints
// ============================================================

import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { MetricsController } from './metrics.controller'
import { MetricsService } from './metrics.service'
import { TypeOrmModule } from '@nestjs/typeorm'

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [HealthController, MetricsController],
  providers: [MetricsService],
})
export class HealthModule {}
