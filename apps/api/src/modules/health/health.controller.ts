// ============================================================
// Health Controller - Liveness & Readiness probes
// ============================================================

import { Controller, Get, Inject } from '@nestjs/common'
import Redis from 'ioredis'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { REDIS_CLIENT } from '../redis/redis.module'

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Basic liveness check' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  check() {
    return {
      status: 'ok',
      service: 'ai-auto-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check (DB + Redis)' })
  async ready() {
    const checks: Record<string, boolean> = {}

    try {
      await this.dataSource.query('SELECT 1')
      checks.database = true
    } catch {
      checks.database = false
    }

    try {
      checks.redis = (await this.redis.ping()) === 'PONG'
    } catch {
      checks.redis = false
    }

    const allHealthy = Object.values(checks).every(Boolean)

    return {
      status: allHealthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    }
  }

  @Get('live')
  @ApiOperation({ summary: 'Kubernetes liveness probe' })
  live() {
    return { status: 'ok' }
  }
}
