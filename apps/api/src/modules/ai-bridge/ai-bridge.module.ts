// ============================================================
// AI Bridge Module - Communicates with AI Agent service
// ============================================================

import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { AIBridgeController } from './ai-bridge.controller'
import { AIBridgeService } from './ai-bridge.service'

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        baseURL: config.get('ai.agentServiceUrl', 'http://localhost:8000'),
        timeout: 30000,
      }),
    }),
  ],
  controllers: [AIBridgeController],
  providers: [AIBridgeService],
  exports: [AIBridgeService],
})
export class AIBridgeModule {}
