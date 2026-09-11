import { HttpService } from '@nestjs/axios'
import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectRepository } from '@nestjs/typeorm'
import { lastValueFrom } from 'rxjs'
import { Repository } from 'typeorm'
import { UserRole } from '@ai-auto/shared'
import { SharingAgent } from '../../agent/entities/sharing-agent.entity'
import { TokenService } from './token.service'

type WechatSession = { openid?: string; unionid?: string; errcode?: number; errmsg?: string }
type WechatAccessToken = { access_token?: string; errcode?: number; errmsg?: string }
type WechatPhone = { phone_info?: { purePhoneNumber?: string }; errcode?: number; errmsg?: string }

/** Uses official mini-program credentials so an operator never supplies or guesses a WeChat identity. */
@Injectable()
export class AgentMiniProgramAuthService {
  constructor(
    @InjectRepository(SharingAgent) private readonly agentRepo: Repository<SharingAgent>,
    private readonly tokenService: TokenService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async login(code: string, phoneCode: string) {
    const { appId, appSecret } = this.credentials()
    const session = await this.session(appId, appSecret, code)
    if (!session.openid) throw new BadRequestException({ code: 1001, message: session.errmsg ?? '微信登录失败' })
    const phone = await this.phone(appId, appSecret, phoneCode)
    if (!phone) throw new BadRequestException({ code: 1002, message: '请授权手机号后再加入达人计划' })

    let agent = await this.agentRepo.findOne({ where: { wechatOpenid: session.openid } })
    if (!agent) {
      const byPhone = await this.agentRepo.findOne({ where: { phone } })
      if (byPhone?.wechatOpenid && byPhone.wechatOpenid !== session.openid) {
        throw new ConflictException({ code: 3011, message: '该手机号已绑定其他微信小程序身份' })
      }
      agent = byPhone ?? this.agentRepo.create({ phone })
      agent.wechatOpenid = session.openid
      agent.wechatUnionid = session.unionid ?? null
      agent = await this.agentRepo.save(agent)
    } else if (session.unionid && !agent.wechatUnionid) {
      agent.wechatUnionid = session.unionid
      agent = await this.agentRepo.save(agent)
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
        wechatOpenid: agent.wechatOpenid,
      },
    }
  }

  private credentials() {
    const appId = this.config.get<string>('wechat.miniAppId') || process.env.WECHAT_MINI_APP_ID
    const appSecret = this.config.get<string>('wechat.miniAppSecret') || process.env.WECHAT_MINI_APP_SECRET
    if (!appId || !appSecret) throw new ServiceUnavailableException({ code: 9003, message: '微信小程序登录尚未配置，请联系管理员' })
    return { appId, appSecret }
  }

  private async session(appId: string, appSecret: string, code: string) {
    const response = await lastValueFrom(this.http.get<WechatSession>('https://api.weixin.qq.com/sns/jscode2session', {
      params: { appid: appId, secret: appSecret, js_code: code, grant_type: 'authorization_code' }, timeout: 10000,
    }))
    if (response.data.errcode) throw new BadRequestException({ code: 1001, message: response.data.errmsg ?? '微信登录失败' })
    return response.data
  }

  private async phone(appId: string, appSecret: string, phoneCode: string) {
    const tokenResponse = await lastValueFrom(this.http.get<WechatAccessToken>('https://api.weixin.qq.com/cgi-bin/token', {
      params: { grant_type: 'client_credential', appid: appId, secret: appSecret }, timeout: 10000,
    }))
    if (!tokenResponse.data.access_token) throw new BadRequestException({ code: 1001, message: tokenResponse.data.errmsg ?? '获取微信授权失败' })
    const phoneResponse = await lastValueFrom(this.http.post<WechatPhone>('https://api.weixin.qq.com/wxa/business/getuserphonenumber', { code: phoneCode }, {
      params: { access_token: tokenResponse.data.access_token }, timeout: 10000,
    }))
    return phoneResponse.data.phone_info?.purePhoneNumber
  }
}
