import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const logger = new Logger('Bootstrap')

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  })

  // Global prefix
  app.setGlobalPrefix('api/v1')

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  )

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  })

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('AI auto API')
    .setDescription('AI-native sharing agent distribution platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('health', 'Health check endpoints')
    .addTag('auth', 'Authentication endpoints')
    .addTag('merchants', 'Merchant management')
    .addTag('agents', 'Sharing agent management')
    .addTag('campaigns', 'Campaign management')
    .addTag('coupons', 'Coupon management')
    .addTag('customers', 'Customer & attribution')
    .addTag('commissions', 'Commission & settlement')
    .addTag('admin', 'Platform admin operations')
    .addTag('ai', 'AI content & campaign generation')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  const port = process.env.PORT || 3000
  await app.listen(port)
  logger.log(`AI auto API running on port ${port}`)
  logger.log(`Swagger docs available at http://localhost:${port}/api/docs`)
}

void bootstrap()
