// ============================================================
// Redis Module - Redis connection and utilities
// ============================================================

import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

export const RedisProvider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const redis = new Redis({
      host: config.get('redis.host', 'localhost'),
      port: config.get('redis.port', 6379),
      password: config.get('redis.password') || undefined,
      db: config.get('redis.db', 0),
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    redis.on('connect', () => {
      console.log('Redis connected');
    });

    return redis;
  },
};

@Global()
@Module({
  providers: [RedisProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
