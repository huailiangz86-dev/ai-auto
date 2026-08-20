// ============================================================
// Auth Service - Core authentication logic
// ============================================================

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { ConfigService } from '@nestjs/config'
import { TokenService, AuthTokens } from './services/token.service'
import { SmsService } from './services/sms.service'
import { Merchant } from '../merchant/entities/merchant.entity'
import { SharingAgent } from '../agent/entities/sharing-agent.entity'
import { Admin } from '../admin/entities/admin.entity'
import { UserRole } from '@ai-auto/shared'
import {
  MerchantRegisterDto,
  MerchantLoginDto,
  AgentRegisterDto,
  AgentLoginDto,
} from './dto/auth.dto'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private readonly bcryptRounds = 12

  constructor(
    @InjectRepository(Merchant)
    private merchantRepo: Repository<any>,
    @InjectRepository(SharingAgent)
    private agentRepo: Repository<any>,
    @InjectRepository(Admin)
    private adminRepo: Repository<any>,
    private tokenService: TokenService,
    private smsService: SmsService,
    private configService: ConfigService,
  ) {}

  // ==================== Merchant Auth ====================

  async merchantRegister(dto: MerchantRegisterDto): Promise<AuthTokens & { user: any }> {
    const existing = await this.merchantRepo.findOne({ where: { phone: dto.phone } })
    if (existing) {
      throw new ConflictException('Phone number already registered as merchant')
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds)
    const merchant = await this.merchantRepo.save({
      phone: dto.phone,
      businessName: dto.businessName,
      passwordHash,
      businessType: dto.businessType || 'individual',
      industryCategory: dto.industryCategory,
    })

    this.logger.log(`Merchant registered: ${merchant.id}`)

    return {
      ...this.tokenService.generateTokens(merchant.id, UserRole.MERCHANT),
      user: {
        id: merchant.id,
        businessName: merchant.businessName,
        phone: merchant.phone,
        role: UserRole.MERCHANT,
        auditStatus: merchant.auditStatus,
      },
    }
  }

  async merchantLogin(dto: MerchantLoginDto): Promise<AuthTokens & { user: any }> {
    const merchant = await this.merchantRepo.findOne({
      where: { phone: dto.phone },
      select: ['id', 'phone', 'passwordHash', 'businessName', 'auditStatus', 'status'],
    })

    if (!merchant) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const valid = await bcrypt.compare(dto.password, merchant.passwordHash)
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    this.logger.log(`Merchant logged in: ${merchant.id}`)
    return {
      ...this.tokenService.generateTokens(merchant.id, UserRole.MERCHANT),
      user: {
        id: merchant.id,
        businessName: merchant.businessName,
        phone: merchant.phone,
        role: UserRole.MERCHANT,
        auditStatus: merchant.auditStatus,
      },
    }
  }

  // ==================== Agent Auth ====================

  async agentRegister(dto: AgentRegisterDto): Promise<AuthTokens & { user: any }> {
    const existing = await this.agentRepo.findOne({ where: { phone: dto.phone } })
    if (existing) {
      throw new ConflictException('Phone number already registered as agent')
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds)
    const agent = await this.agentRepo.save({
      phone: dto.phone,
      nickname: dto.nickname,
      passwordHash,
    })

    this.logger.log(`Agent registered: ${agent.id}`)

    return {
      ...this.tokenService.generateTokens(agent.id, UserRole.AGENT),
      user: {
        id: agent.id,
        phone: agent.phone,
        nickname: agent.nickname,
        role: UserRole.AGENT,
        level: agent.level,
        auditStatus: agent.auditStatus,
      },
    }
  }

  async agentLogin(dto: AgentLoginDto): Promise<AuthTokens & { user: any }> {
    const agent = await this.agentRepo.findOne({
      where: { phone: dto.phone },
      select: ['id', 'phone', 'passwordHash', 'status', 'auditStatus', 'nickname', 'level'],
    })

    if (!agent) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const valid = await bcrypt.compare(dto.password, agent.passwordHash)
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    this.logger.log(`Agent logged in: ${agent.id}`)
    return {
      ...this.tokenService.generateTokens(agent.id, UserRole.AGENT),
      user: {
        id: agent.id,
        phone: agent.phone,
        nickname: agent.nickname,
        role: UserRole.AGENT,
        level: agent.level,
        auditStatus: agent.auditStatus,
      },
    }
  }

  async agentSmsLogin(phone: string, code: string): Promise<AuthTokens & { user: any }> {
    const valid = await this.smsService.verifyCode(phone, code, 'login')
    if (!valid) {
      throw new BadRequestException('Invalid or expired SMS code')
    }

    let agent = await this.agentRepo.findOne({
      where: { phone },
      select: ['id', 'phone', 'nickname', 'status', 'auditStatus', 'level'],
    })

    if (!agent) {
      agent = await this.agentRepo.save({ phone })
      this.logger.log(`Agent auto-registered via SMS: ${agent.id}`)
    }

    return {
      ...this.tokenService.generateTokens(agent.id, UserRole.AGENT),
      user: {
        id: agent.id,
        phone: agent.phone,
        nickname: agent.nickname,
        role: UserRole.AGENT,
        level: agent.level,
        auditStatus: agent.auditStatus,
      },
    }
  }

  // ==================== Admin Auth ====================

  async adminLogin(username: string, password: string): Promise<AuthTokens & { user: any }> {
    const admin = await this.adminRepo.findOne({
      where: { username },
      select: ['id', 'username', 'passwordHash', 'role', 'realName', 'status'],
    })

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const valid = await bcrypt.compare(password, admin.passwordHash)
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    if (!admin.status) {
      throw new ForbiddenException('Admin account is disabled')
    }

    this.logger.log(`Admin logged in: ${admin.username}`)
    return {
      ...this.tokenService.generateTokens(admin.id, UserRole.ADMIN),
      user: {
        id: admin.id,
        username: admin.username,
        realName: admin.realName,
        role: UserRole.ADMIN,
        adminRole: admin.role,
      },
    }
  }

  // ==================== Token Operations ====================

  refreshTokens(refreshToken: string): AuthTokens {
    return this.tokenService.refreshTokens(refreshToken)
  }

  // ==================== Password Operations ====================

  async changePassword(
    userId: string,
    role: UserRole,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const repo = this.getRepoByRole(role)
    const entity = await repo.findOne({
      where: { id: userId },
      select: ['id', 'passwordHash'],
    })

    if (!entity) {
      throw new UnauthorizedException('User not found')
    }

    const valid = await bcrypt.compare(currentPassword, entity.passwordHash)
    if (!valid) {
      throw new BadRequestException('Current password is incorrect')
    }

    const newHash = await bcrypt.hash(newPassword, this.bcryptRounds)
    await repo.update(userId, { passwordHash: newHash })
    this.logger.log(`Password changed for ${role}:${userId}`)
  }

  async resetPassword(phone: string, code: string, newPassword: string): Promise<void> {
    const valid = await this.smsService.verifyCode(phone, code, 'reset_password')
    if (!valid) {
      throw new BadRequestException('Invalid or expired SMS code')
    }

    const merchant = await this.merchantRepo.findOne({
      where: { phone },
      select: ['id', 'passwordHash'],
    })

    if (merchant) {
      const newHash = await bcrypt.hash(newPassword, this.bcryptRounds)
      await this.merchantRepo.update(merchant.id, { passwordHash: newHash })
      await this.smsService.invalidateCodes(phone)
      this.logger.log(`Password reset for merchant: ${merchant.id}`)
      return
    }

    const agent = await this.agentRepo.findOne({
      where: { phone },
      select: ['id', 'passwordHash'],
    })

    if (agent) {
      const newHash = await bcrypt.hash(newPassword, this.bcryptRounds)
      await this.agentRepo.update(agent.id, { passwordHash: newHash })
      await this.smsService.invalidateCodes(phone)
      this.logger.log(`Password reset for agent: ${agent.id}`)
      return
    }

    throw new BadRequestException('Phone number not found')
  }

  async getUserProfile(userId: string, role: UserRole): Promise<any> {
    const repo = this.getRepoByRole(role)
    return repo.findOne({ where: { id: userId } })
  }

  private getRepoByRole(role: UserRole): Repository<any> {
    switch (role) {
      case UserRole.MERCHANT:
        return this.merchantRepo
      case UserRole.AGENT:
        return this.agentRepo
      case UserRole.ADMIN:
        return this.adminRepo
      default:
        throw new BadRequestException('Invalid user role')
    }
  }
}
