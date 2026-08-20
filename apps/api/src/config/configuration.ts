// ============================================================
// AI auto - Core API Service
// Configuration loader
// ============================================================

import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';

export interface AppConfig {
  app: {
    name: string;
    env: string;
    port: number;
    apiPrefix: string;
  };
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name: string;
    synchronize: boolean;
    logging: boolean;
  };
  redis: {
    host: string;
    port: number;
    password: string;
    db: number;
  };
  jwt: {
    secret: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
  };
  cors: {
    origins: string[];
  };
  throttle: {
    ttl: number;
    limit: number;
  };
  ai: {
    agentServiceUrl: string;
    apiKey: string;
  };
  payment: {
    alipayAppId: string;
    wechatpayMchId: string;
  };
}

export default (): AppConfig => {
  const env = process.env.NODE_ENV || 'development';
  const configPath = join(process.cwd(), `config.${env}.yaml`);

  let fileConfig: Partial<AppConfig> = {};
  try {
    const file = readFileSync(configPath, 'utf8');
    fileConfig = yaml.load(file) as Partial<AppConfig>;
  } catch {
    // No yaml config, use env vars only
  }

  return {
    app: {
      name: process.env.APP_NAME || fileConfig.app?.name || 'ai-auto',
      env: process.env.NODE_ENV || fileConfig.app?.env || 'development',
      port: parseInt(process.env.PORT || fileConfig.app?.port?.toString() || '3000', 10),
      apiPrefix: process.env.API_PREFIX || fileConfig.app?.apiPrefix || 'api/v1',
    },
    database: {
      host: process.env.DB_HOST || fileConfig.database?.host || 'localhost',
      port: parseInt(process.env.DB_PORT || fileConfig.database?.port?.toString() || '5432', 10),
      username: process.env.DB_USERNAME || fileConfig.database?.username || 'ai_auto',
      password: process.env.DB_PASSWORD || fileConfig.database?.password || 'ai_auto_dev',
      name: process.env.DB_NAME || fileConfig.database?.name || 'ai_auto_dev',
      synchronize: process.env.DB_SYNCHRONIZE === 'true' || fileConfig.database?.synchronize || false,
      logging: process.env.DB_LOGGING === 'true' || fileConfig.database?.logging || false,
    },
    redis: {
      host: process.env.REDIS_HOST || fileConfig.redis?.host || 'localhost',
      port: parseInt(process.env.REDIS_PORT || fileConfig.redis?.port?.toString() || '6379', 10),
      password: process.env.REDIS_PASSWORD || fileConfig.redis?.password || '',
      db: parseInt(process.env.REDIS_DB || fileConfig.redis?.db?.toString() || '0', 10),
    },
    jwt: {
      secret: process.env.JWT_SECRET || fileConfig.jwt?.secret || 'dev-secret-change-in-production',
      accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || fileConfig.jwt?.accessTokenExpiry || '15m',
      refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || fileConfig.jwt?.refreshTokenExpiry || '7d',
    },
    cors: {
      origins: (process.env.CORS_ORIGINS || fileConfig.cors?.origins?.join(',') || 'http://localhost:3000').split(','),
    },
    throttle: {
      ttl: parseInt(process.env.THROTTLE_TTL || fileConfig.throttle?.ttl?.toString() || '60000', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT || fileConfig.throttle?.limit?.toString() || '100', 10),
    },
    ai: {
      agentServiceUrl: process.env.AI_AGENT_SERVICE_URL || fileConfig.ai?.agentServiceUrl || 'http://localhost:8000',
      apiKey: process.env.AI_AGENT_API_KEY || fileConfig.ai?.apiKey || '',
    },
    payment: {
      alipayAppId: process.env.ALIPAY_APP_ID || fileConfig.payment?.alipayAppId || '',
      wechatpayMchId: process.env.WECHATPAY_MCH_ID || fileConfig.payment?.wechatpayMchId || '',
    },
  };
};
