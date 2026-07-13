import { Injectable } from '@nestjs/common'
import { StaffAuthService } from '../../common/staff-auth.service'
import { InMemoryStore, sha256 } from '../../common/store.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly staffAuth: StaffAuthService
  ) {}

  wechatLogin(input: { code: string; nickname?: string }) {
    // MVP-A 占位：正式上线时必须调用微信 code2Session 换取 openid。
    const appId = process.env.WECHAT_APP_ID || 'local-dev-app'
    const openid = `mock_${sha256(input.code).slice(0, 24)}`
    const existing = [...this.store.users.values()].find((user) => user.appId === appId && user.openid === openid)
    const now = this.store.now()

    const user =
      existing ||
      {
        id: this.store.id('usr'),
        appId,
        openid,
        nickname: input.nickname,
        createdAt: now,
        lastLoginAt: now
      }

    user.lastLoginAt = now
    if (input.nickname) user.nickname = input.nickname
    this.store.users.set(user.id, user)

    return {
      user,
      access_token: `local_access_${sha256(user.id + now).slice(0, 32)}`,
      refresh_token: `local_refresh_${sha256(openid + now).slice(0, 32)}`,
      token_type: 'Bearer',
      expires_in: 7200
    }
  }

  staffPinLogin(input: { staff_pin: string }) {
    return this.staffAuth.sessionForPin(input.staff_pin)
  }

  staffSession(input: { staff_pin?: string; staff_token?: string }) {
    return this.staffAuth.sessionForCredential(input)
  }
}
