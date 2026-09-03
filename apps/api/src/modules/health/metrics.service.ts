import { Injectable, OnModuleInit } from '@nestjs/common'
import { collectDefaultMetrics, register } from 'prom-client'

@Injectable()
export class MetricsService implements OnModuleInit {
  onModuleInit() {
    collectDefaultMetrics({ register })
  }

  async getMetrics(): Promise<string> {
    return register.metrics()
  }

  get contentType(): string {
    return register.contentType
  }
}
