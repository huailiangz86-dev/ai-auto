import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { AppModule } from '../src/app.module'
import { REDIS_CLIENT } from '../src/modules/redis/redis.module'

describe('Health endpoints (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(REDIS_CLIENT)
      .useValue({ ping: jest.fn().mockResolvedValue('PONG') })
      .compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1')
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    )
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('reports liveness without external dependencies', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health/live')
      .expect(200)
      .expect({ status: 'ok' })
  })

  it('reports readiness after migrations initialize the database', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(200)

    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        checks: expect.objectContaining({ database: true }),
      }),
    )
  })
})
