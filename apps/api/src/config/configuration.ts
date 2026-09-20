// ============================================================
// AI auto - Core API Service
// Configuration loader
// ============================================================

import { readFileSync } from 'fs'
import { join } from 'path'
import * as yaml from 'js-yaml'

export interface AppConfig {
  app: {
    name: string
    env: string
    port: number
    apiPrefix: string
  }
  database: {
    host: string
    port: number
    username: string
    password: string
    name: string
    schema?: string
    synchronize: boolean
    logging: boolean
  }
  redis: {
    host: string
    port: number
    password: string
    db: number
  }
  jwt: {
    secret: string
    accessTokenExpiry: string
    refreshTokenExpiry: string
  }
  cors: {
    origins: string[]
  }
  throttle: {
    ttl: number
    limit: number
  }
  ai: {
    agentServiceUrl: string
    apiKey: string
  }
  payment: {
    alipayAppId: string
    wechatpayMchId: string
    alipayPrivateKey: string
    alipayPublicKey: string
    alipayNotifyUrl: string
    alipayWalletNotifyUrl: string
    alipayReturnUrl: string
    alipaySandbox: boolean
    wechatpayAppId: string
    wechatpaySerialNo: string
    wechatpayPrivateKey: string
    wechatpayApiV3Key: string
    wechatpayNotifyUrl: string
    wechatpayWalletNotifyUrl: string
    wechatpayPlatformCertificate: string
  }
  wechat: {
    miniAppId: string
    miniAppSecret: string
  }
  oauth: {
    douyin: { clientId: string; clientSecret: string }
    xiaohongshu: { clientId: string; clientSecret: string }
    wechat: { clientId: string; clientSecret: string }
    kuaishou: { clientId: string; clientSecret: string }
  }
}

function loadExternalEnvFile(path?: string): Record<string, string> {
  if (!path) return {}
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const separator = line.indexOf('=')
          const key = line.slice(0, separator).trim()
          let value = line.slice(separator + 1).trim()
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1)
          }
          return [key, value]
        }),
    )
  } catch {
    return {}
  }
}

function pem(value: string, label: 'PRIVATE KEY' | 'PUBLIC KEY' | 'CERTIFICATE') {
  const normalized = value.trim().replace(/\\n/g, '\n')
  if (!normalized || normalized.includes('BEGIN ')) return normalized
  return `-----BEGIN ${label}-----\n${normalized.replace(/\s+/g, '')}\n-----END ${label}-----`
}

function urlOrigin(value?: string) {
  if (!value) return ''
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

export default (): AppConfig => {
  const env = process.env.NODE_ENV || 'development'
  const configPath = join(process.cwd(), `config.${env}.yaml`)

  let fileConfig: Partial<AppConfig> = {}
  try {
    const file = readFileSync(configPath, 'utf8')
    fileConfig = yaml.load(file)
  } catch {
    // No yaml config, use env vars only
  }

  const externalEnv = loadExternalEnvFile(process.env.AI_AUTO_PAYMENT_ENV_FILE)
  const external = (key: string, ...aliases: string[]) =>
    process.env[key] ||
    externalEnv[key] ||
    aliases.map((alias) => process.env[alias] || externalEnv[alias]).find(Boolean) ||
    ''
  const externalCallbackOrigin = urlOrigin(
    externalEnv.AI_AUTO_PUBLIC_BASE_URL ||
      externalEnv.ALIPAY_NOTIFY_URL ||
      externalEnv.WECHAT_PAY_NOTIFY_URL,
  )
  const callbackOrigin = (external('AI_AUTO_PUBLIC_BASE_URL') || externalCallbackOrigin).replace(
    /\/$/,
    '',
  )
  const callback = (key: string, path: string) =>
    process.env[key] || (callbackOrigin ? `${callbackOrigin}${path}` : '')
  const alipayPrivateKey = external('ALIPAY_PRIVATE_KEY')
  const alipayPublicKey = external('ALIPAY_PUBLIC_KEY')
  const wechatPrivateKey = external('WECHATPAY_PRIVATE_KEY', 'WECHAT_PAY_PRIVATE_KEY')
  const wechatPlatformCertificate = external('WECHATPAY_PLATFORM_CERTIFICATE')

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
      schema: process.env.DB_SCHEMA || fileConfig.database?.schema,
      synchronize:
        process.env.DB_SYNCHRONIZE === 'true' || fileConfig.database?.synchronize || false,
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
      accessTokenExpiry:
        process.env.JWT_ACCESS_EXPIRY || fileConfig.jwt?.accessTokenExpiry || '15m',
      refreshTokenExpiry:
        process.env.JWT_REFRESH_EXPIRY || fileConfig.jwt?.refreshTokenExpiry || '7d',
    },
    cors: {
      origins: (
        process.env.CORS_ORIGINS ||
        fileConfig.cors?.origins?.join(',') ||
        'http://localhost:3000'
      ).split(','),
    },
    throttle: {
      ttl: parseInt(
        process.env.THROTTLE_TTL || fileConfig.throttle?.ttl?.toString() || '60000',
        10,
      ),
      limit: parseInt(
        process.env.THROTTLE_LIMIT || fileConfig.throttle?.limit?.toString() || '100',
        10,
      ),
    },
    ai: {
      agentServiceUrl:
        process.env.AI_AGENT_SERVICE_URL ||
        fileConfig.ai?.agentServiceUrl ||
        'http://localhost:8000',
      apiKey: process.env.AI_AGENT_API_KEY || fileConfig.ai?.apiKey || '',
    },
    payment: {
      alipayAppId: external('ALIPAY_APP_ID') || fileConfig.payment?.alipayAppId || '',
      wechatpayMchId:
        external('WECHATPAY_MCH_ID', 'WECHAT_PAY_MCH_ID') ||
        fileConfig.payment?.wechatpayMchId ||
        '',
      alipayPrivateKey:
        (alipayPrivateKey ? pem(alipayPrivateKey, 'PRIVATE KEY') : '') ||
        fileConfig.payment?.alipayPrivateKey ||
        '',
      alipayPublicKey:
        (alipayPublicKey ? pem(alipayPublicKey, 'PUBLIC KEY') : '') ||
        fileConfig.payment?.alipayPublicKey ||
        '',
      alipayNotifyUrl:
        callback('ALIPAY_NOTIFY_URL', '/api/v1/merchant/subscription/payments/alipay/notify') ||
        fileConfig.payment?.alipayNotifyUrl ||
        '',
      alipayWalletNotifyUrl:
        callback(
          'ALIPAY_WALLET_NOTIFY_URL',
          '/api/v1/merchant/wallet/topup/payments/alipay/notify',
        ) ||
        fileConfig.payment?.alipayWalletNotifyUrl ||
        '',
      alipayReturnUrl: external('ALIPAY_RETURN_URL') || fileConfig.payment?.alipayReturnUrl || '',
      alipaySandbox: /^(1|true|yes)$/i.test(external('ALIPAY_SANDBOX')),
      wechatpayAppId:
        external('WECHATPAY_APP_ID', 'WECHAT_PAY_APP_ID') ||
        fileConfig.payment?.wechatpayAppId ||
        '',
      wechatpaySerialNo:
        external('WECHATPAY_SERIAL_NO', 'WECHAT_PAY_CERT_SERIAL_NO') ||
        fileConfig.payment?.wechatpaySerialNo ||
        '',
      wechatpayPrivateKey:
        (wechatPrivateKey ? pem(wechatPrivateKey, 'PRIVATE KEY') : '') ||
        fileConfig.payment?.wechatpayPrivateKey ||
        '',
      wechatpayApiV3Key:
        external('WECHATPAY_API_V3_KEY', 'WECHAT_PAY_API_V3_KEY') ||
        fileConfig.payment?.wechatpayApiV3Key ||
        '',
      wechatpayNotifyUrl:
        callback(
          'WECHATPAY_NOTIFY_URL',
          '/api/v1/merchant/subscription/payments/wechatpay/notify',
        ) ||
        fileConfig.payment?.wechatpayNotifyUrl ||
        '',
      wechatpayWalletNotifyUrl:
        callback(
          'WECHATPAY_WALLET_NOTIFY_URL',
          '/api/v1/merchant/wallet/topup/payments/wechatpay/notify',
        ) ||
        fileConfig.payment?.wechatpayWalletNotifyUrl ||
        '',
      wechatpayPlatformCertificate:
        (wechatPlatformCertificate ? pem(wechatPlatformCertificate, 'CERTIFICATE') : '') ||
        fileConfig.payment?.wechatpayPlatformCertificate ||
        '',
    },
    wechat: {
      miniAppId: process.env.WECHAT_MINI_APP_ID || fileConfig.wechat?.miniAppId || '',
      miniAppSecret: process.env.WECHAT_MINI_APP_SECRET || fileConfig.wechat?.miniAppSecret || '',
    },
    oauth: {
      douyin: {
        clientId: process.env.DOUYIN_APP_ID || fileConfig.oauth?.douyin?.clientId || '',
        clientSecret: process.env.DOUYIN_APP_SECRET || fileConfig.oauth?.douyin?.clientSecret || '',
      },
      xiaohongshu: {
        clientId: process.env.XIAOHONGSHU_APP_ID || fileConfig.oauth?.xiaohongshu?.clientId || '',
        clientSecret:
          process.env.XIAOHONGSHU_APP_SECRET || fileConfig.oauth?.xiaohongshu?.clientSecret || '',
      },
      wechat: {
        clientId: process.env.WECHAT_OPEN_APP_ID || fileConfig.oauth?.wechat?.clientId || '',
        clientSecret:
          process.env.WECHAT_OPEN_APP_SECRET || fileConfig.oauth?.wechat?.clientSecret || '',
      },
      kuaishou: {
        clientId: process.env.KUAISHOU_APP_ID || fileConfig.oauth?.kuaishou?.clientId || '',
        clientSecret:
          process.env.KUAISHOU_APP_SECRET || fileConfig.oauth?.kuaishou?.clientSecret || '',
      },
    },
  }
}
