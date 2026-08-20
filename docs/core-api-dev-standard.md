# AI auto — Core API 开发标准

**Date:** 2026-08-20
**Version:** 1.0
**范围:** NestJS + TypeScript API 服务

---

## 1. 项目结构

```
apps/api/src/
├── main.ts                    # 入口
├── app.module.ts             # 根模块
├── config/                   # 配置
│   └── configuration.ts
├── common/                   # 公共模块
│   ├── decorators/          # @Public, @Roles, @CurrentUser
│   ├── guards/               # JwtAuthGuard, RolesGuard, ThrottlerGuard
│   ├── filters/              # HttpExceptionFilter
│   ├── interceptors/          # LoggingInterceptor, TransformInterceptor
│   ├── pipes/                # ValidationPipe
│   └── entities/             # BaseEntity, SoftDeletableEntity
├── modules/                   # 功能模块（按领域组织）
│   ├── auth/                 # 认证
│   ├── merchant/             # 商户
│   ├── agent/                # 分享员
│   ├── customer/             # C端用户
│   ├── commission/           # 佣金
│   ├── campaign/              # 活动/券
│   ├── content/              # AI 内容
│   ├── ai-bridge/           # AI 服务桥接
│   ├── admin/                # 运营后台
│   ├── health/               # 健康检查
│   └── redis/                # Redis
└── shared/                   # 跨模块共享（via packages/shared）
```

### 模块结构规范

每个模块内部：

```
module-name/
├── module-name.module.ts     # 模块定义
├── module-name.controller.ts # API 路由（薄控制器）
├── module-name.service.ts   # 业务逻辑
├── dto/                     # Data Transfer Objects
│   ├── create-*.dto.ts
│   ├── update-*.dto.ts
│   └── query-*.dto.ts
├── entities/                 # TypeORM 实体
│   ├── *.entity.ts
│   └── index.ts
└── *.repository.ts         # 大型查询用 Repository（可选）
```

---

## 2. 控制器规范

### 2.1 命名规范

```typescript
// ✅ 正确：RESTful 风格，复数名词
@Controller('merchants')
class MerchantController {}

// ❌ 错误：单数名词或动词
@Controller('merchant') {}
@Controller('getMerchant') {}
```

### 2.2 路由定义

```typescript
@Controller('merchants')
export class MerchantController {
  // GET /merchants
  @Get()
  async list(@Query() query: ListMerchantsDto) {}

  // GET /merchants/:id
  @Get(':id')
  async getOne(@Param('id') id: string) {}

  // POST /merchants
  @Post()
  async create(@Body() dto: CreateMerchantDto) {}

  // PUT /merchants/:id
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateMerchantDto) {}

  // DELETE /merchants/:id
  @Delete(':id')
  async remove(@Param('id') id: string) {}
}
```

### 2.3 认证与权限

```typescript
// 公开接口
@Public()
@Get('public/coupons')
async getPublicCoupons() {}

// 需要认证
@Get('profile')
@UseGuards(JwtAuthGuard)
async getProfile(@CurrentUser() user: UserPayload) {}

// 角色权限
@Post('campaigns/:id/publish')
@Roles(UserRole.MERCHANT_ADMIN, UserRole.MERCHANT_STAFF)
@UseGuards(JwtAuthGuard, RolesGuard)
async publishCampaign(@Param('id') id: string) {}
```

---

## 3. Service 规范

### 3.1 单例注入

使用 `providedIn: 'root'` 模式或 NestJS Module 单例：

```typescript
@Injectable()
export class CommissionService {
  constructor(
    private readonly commissionRepo: Repository<Commission>,
    private readonly walletRepo: Repository<AgentWallet>,
  ) {}

  async calculateCommission(params: {
    agentId: string
    merchantReward: number
    redemptionId: string
  }): Promise<Commission> {
    // 业务逻辑
  }
}
```

### 3.2 事务处理

佣金计算必须使用事务：

```typescript
async createRedemptionWithCommission(dto: CreateRedemptionDto) {
  return this.dataSource.transaction(async (manager) => {
    // 1. 创建核销记录
    const redemption = await manager.save(Redemption, { ...dto });

    // 2. 计算佣金
    const commission = await this.commissionService.calculateCommission({
      agentId: dto.agentId,
      merchantReward: dto.merchantReward,
      redemptionId: redemption.id,
    });

    // 3. 更新钱包
    await this.walletService.addPendingBalance(
      dto.agentId,
      commission.agentFinalPayout,
      manager,
    );

    // 4. 记录平台收入
    await this.platformRevenueService.recordRoyalty(
      commission.platformFee,
      commission.id,
      manager,
    );

    return redemption;
  });
}
```

### 3.3 幂等性

涉及金额的操作必须实现幂等：

```typescript
async verifyRedemption(dto: VerifyRedemptionDto) {
  // 幂等检查
  const existing = await this.redemptionRepo.findOne({
    where: { idempotencyKey: dto.idempotencyKey },
  });
  if (existing) {
    return existing; // 重复调用，直接返回已有结果
  }
  // ... 正常处理逻辑
}
```

---

## 4. DTO 规范

### 4.1 使用 class-validator

```typescript
export class CreateRedemptionDto {
  @IsNotEmpty()
  @IsUUID()
  couponId!: string

  @IsNotEmpty()
  @IsUUID()
  customerId!: string

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  transactionAmount!: number

  @IsOptional()
  @IsString()
  idempotencyKey?: string
}
```

### 4.2 查询 DTO

```typescript
export class ListRedemptionsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20

  @IsOptional()
  @IsDateString()
  dateFrom?: string

  @IsOptional()
  @IsDateString()
  dateTo?: string

  @IsOptional()
  @IsEnum(RedemptionStatus)
  status?: RedemptionStatus
}
```

---

## 5. 错误处理

### 5.1 统一异常过滤器

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse()
    const request = ctx.getRequest()

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error'

    const errorCode =
      exception instanceof BusinessException ? exception.errorCode : 9001

    response.status(status).json({
      code: errorCode,
      message,
      data: null,
      path: request.url,
      timestamp: new Date().toISOString(),
    })
  }
}
```

### 5.2 业务异常

```typescript
export class BusinessException extends HttpException {
  constructor(
    public readonly errorCode: number,
    message: string,
    httpStatus: number = 400,
  ) {
    super({ message, errorCode }, httpStatus)
  }
}
```

### 5.3 常用错误码使用

```typescript
// 在 service 中使用
throw new BusinessException(4001, '商户不存在')
throw new BusinessException(4004, '券已领完')
throw new BusinessException(40103, '券码无效')
throw new BusinessException(40109, '重复核销') // 幂等返回而非错误
```

---

## 6. 日志规范

### 6.1 结构化日志

```typescript
// 使用 NestJS 内置 Logger
private readonly logger = new Logger(CommissionService.name);

async calculateCommission(params: CommissionParams) {
  this.logger.log({
    event: 'commission_calculate_start',
    agentId: params.agentId,
    redemptionId: params.redemptionId,
    merchantReward: params.merchantReward,
  });

  try {
    const result = await this.doCalculate(params);
    this.logger.log({
      event: 'commission_calculate_success',
      redemptionId: params.redemptionId,
      agentPayout: result.agentFinalPayout,
      platformFee: result.platformFee,
    });
    return result;
  } catch (error) {
    this.logger.error({
      event: 'commission_calculate_error',
      redemptionId: params.redemptionId,
      error: error.message,
    });
    throw error;
  }
}
```

---

## 7. 测试规范

### 7.1 测试文件位置

```
modules/commission/
├── commission.service.ts
├── commission.service.spec.ts    # 单元测试
└── commission.e2e-spec.ts       # 集成测试（可选）
```

### 7.2 佣金计算测试（必须 100% 覆盖）

```typescript
describe('CommissionService', () => {
  describe('calculateCommissionWithLevel', () => {
    it('bronze level: 10元佣金 → 实得8元，平台2元', () => {
      const result = calculateCommissionWithLevel(10, AgentLevel.BRONZE)
      expect(result.agentFinalPayout).toBe(8)
      expect(result.platformFee).toBe(2)
    })

    it('silver level: 10元佣金 × 1.1 → 实得8.8元', () => {
      const result = calculateCommissionWithLevel(10, AgentLevel.SILVER)
      expect(result.agentFinalPayout).toBe(8.8)
      expect(result.platformFee).toBe(1.2)
    })

    it('gold level: 10元佣金 × 1.2 → 实得9.6元', () => {
      const result = calculateCommissionWithLevel(10, AgentLevel.GOLD)
      expect(result.agentFinalPayout).toBe(9.6)
      expect(result.platformFee).toBe(0.4)
    })

    it('diamond level: 10元佣金 × 1.5 → 实得12元（超过100%）', () => {
      const result = calculateCommissionWithLevel(10, AgentLevel.DIAMOND)
      expect(result.agentFinalPayout).toBe(12)
      expect(result.platformFee).toBe(-2) // 平台倒贴
    })

    it('精度问题: 0.1元佣金保留2位小数', () => {
      const result = calculateCommissionWithLevel(0.1, AgentLevel.BRONZE)
      expect(result.agentFinalPayout).toBe(0.08)
    })
  })
})
```

### 7.3 Mock 策略

```typescript
// ✅ 正确：mock 外部依赖（数据库、外部服务）
const mockRepo = {
  findOne: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
};

// ❌ 错误：mock 内部实现
jest.spyOn(service, 'calculateCommission').mockImplementation(...);
```

---

## 8. 性能规范

### 8.1 N+1 查询防护

```typescript
// ✅ 正确：使用 relation 加载
const merchants = await this.merchantRepo.find({
  where: { status: MerchantStatus.ACTIVE },
  relations: ['stores', 'subscription'],
})

// ❌ 错误：循环中查询
for (const id of ids) {
  const merchant = await this.merchantRepo.findOne(id) // N+1!
}
```

### 8.2 大数据量分页

```typescript
// 超过 1000 条必须分页
@Get('redemptions')
async list(@Query() query: ListRedemptionsDto) {
  const [items, total] = await this.repo.findAndCount({
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
    order: { createdAt: 'DESC' },
  });
  return { items, total, page: query.page, pageSize: query.pageSize };
}
```

---

## 9. 安全规范

### 9.1 输入校验

所有 `@Body()` `@Query()` `@Param()` 必须有对应的 DTO：

```typescript
// ✅ 正确：所有输入都校验
@Post()
async create(@Body() @Validate() dto: CreateMerchantDto) {}

// ❌ 错误：直接使用未校验参数
async create(@Body() body: any) {
  const merchant = new Merchant();
  merchant.name = body.name; // 危险！
}
```

### 9.2 SQL 注入防护

使用 TypeORM 参数化查询：

```typescript
// ✅ 正确
await this.repo
  .createQueryBuilder('m')
  .where('m.phone LIKE :phone', { phone: `%${keyword}%` })
  .getMany()

// ❌ 错误：字符串拼接
await this.repo.query(`SELECT * FROM merchants WHERE name LIKE '%${keyword}%'`)
```

### 9.3 敏感数据

- 密码：bcrypt 加密，不返回前端
- 手机号：中间脱敏 `138****5678`
- 银行卡号：加密存储，不返回明文
- API Secret：仅在创建/重置时返回一次，之后不再返回

---

_本文档配合 `dev-standard.md` 开发规范总纲使用。_
