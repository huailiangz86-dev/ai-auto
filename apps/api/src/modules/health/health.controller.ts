// ============================================================
// Health Controller - Liveness & Readiness probes
// ============================================================

import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Basic liveness check' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  check() {
    return {
      status: 'ok',
      service: 'ai-auto-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check (DB + Redis)' })
  async ready() {
    const checks: Record<string, boolean> = {};

    // DB check
    try {
      await this.dataSource.query('SELECT 1');
      checks.database = true;
    } catch {
      checks.database = false;
    }

    const allHealthy = Object.values(checks).every(Boolean);

    return {
      status: allHealthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Kubernetes liveness probe' })
  live() {
    return { status: 'ok' };
  }
}
