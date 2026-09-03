import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { lastValueFrom } from 'rxjs'
import { Repository } from 'typeorm'

import { UserRole } from '@ai-auto/shared'
import { TokenService } from '../auth/services/token.service'
import { Customer } from './entities/customer.entity'

interface WechatSessionResponse {
  openid?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

interface WechatAccessTokenResponse {
  access_token?: string
  errcode?: number
  errmsg?: string
}

interface WechatPhoneResponse {
  phone_info?: { purePhoneNumber?: string }
  errcode?: number
  errmsg?: string
}

@Injectable()
export class CustomerAuthService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly tokenService: TokenService,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  async miniProgramLogin(code: string, phoneCode?: string) {
    const { appId, appSecret } = this.getWechatCredentials()
    const session = await this.getWechatSession(appId, appSecret, code)
    if (!session.openid) {
      throw new BadRequestException({ code: 1001, message: session.errmsg ?? '微信登录失败' })
    }

    const phone = phoneCode ? await this.getAuthorizedPhone(appId, appSecret, phoneCode) : undefined
    let customer = await this.customerRepo.findOne({ where: { wechatOpenid: session.openid } })
    let isNewUser = false

    if (!customer && phone) {
      const phoneOwner = await this.customerRepo.findOne({ where: { phone } })
      if (phoneOwner) {
        if (!phoneOwner.wechatOpenid) {
          phoneOwner.wechatOpenid = session.openid
          customer = await this.customerRepo.save(phoneOwner)
        } else {
          throw new ConflictException({ code: 1007, message: '该手机号已绑定其他微信账号' })
        }
      }
    }

    if (!customer) {
      isNewUser = true
      customer = await this.customerRepo.save(
        this.customerRepo.create({
          wechatOpenid: session.openid,
          phone: phone ?? null,
          totalRedemptions: 0,
          totalSpend: 0,
        }),
      )
    } else if (phone && customer.phone !== phone) {
      const phoneOwner = await this.customerRepo.findOne({ where: { phone } })
      if (phoneOwner && phoneOwner.id !== customer.id) {
        throw new ConflictException({ code: 1007, message: '该手机号已绑定其他微信账号' })
      }
      customer.phone = phone
      customer = await this.customerRepo.save(customer)
    }

    return {
      ...this.tokenService.generateTokens(customer.id, UserRole.CUSTOMER),
      customer_id: customer.id,
      is_new_user: isNewUser,
    }
  }

  private getWechatCredentials() {
    const appId = this.config.get<string>('wechat.miniAppId') || process.env.WECHAT_MINI_APP_ID
    const appSecret =
      this.config.get<string>('wechat.miniAppSecret') || process.env.WECHAT_MINI_APP_SECRET
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException({
        code: 9003,
        message: '微信小程序登录尚未配置，请联系管理员',
      })
    }
    return { appId, appSecret }
  }

  private async getWechatSession(appId: string, appSecret: string, code: string) {
    const response = await lastValueFrom(
      this.httpService.get<WechatSessionResponse>('https://api.weixin.qq.com/sns/jscode2session', {
        params: {
          appid: appId,
          secret: appSecret,
          js_code: code,
          grant_type: 'authorization_code',
        },
        timeout: 10000,
      }),
    )
    if (response.data.errcode) {
      throw new BadRequestException({ code: 1001, message: response.data.errmsg ?? '微信登录失败' })
    }
    return response.data
  }

  private async getAuthorizedPhone(appId: string, appSecret: string, phoneCode: string) {
    const tokenResponse = await lastValueFrom(
      this.httpService.get<WechatAccessTokenResponse>('https://api.weixin.qq.com/cgi-bin/token', {
        params: { grant_type: 'client_credential', appid: appId, secret: appSecret },
        timeout: 10000,
      }),
    )
    if (!tokenResponse.data.access_token) {
      throw new BadRequestException({ code: 1001, message: '获取微信授权失败' })
    }
    const phoneResponse = await lastValueFrom(
      this.httpService.post<WechatPhoneResponse>(
        'https://api.weixin.qq.com/wxa/business/getuserphonenumber',
        { code: phoneCode },
        { params: { access_token: tokenResponse.data.access_token }, timeout: 10000 },
      ),
    )
    const phone = phoneResponse.data.phone_info?.purePhoneNumber
    if (!phone) {
      throw new BadRequestException({
        code: 1001,
        message: phoneResponse.data.errmsg ?? '手机号授权失败',
      })
    }
    return phone
  }
}
