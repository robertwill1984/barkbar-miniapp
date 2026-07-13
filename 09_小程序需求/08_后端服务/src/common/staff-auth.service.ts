import { Injectable, UnauthorizedException } from '@nestjs/common'
import { sha256 } from './store.service'

export type LocalStaffRole = 'STAFF' | 'OWNER'
export type LocalStaffPermission =
  | 'reservation:review'
  | 'reservation:checkin'
  | 'member:redeem'
  | 'refund:review'
  | 'member:read'
  | 'order:read'
  | 'finance:read'

const ROLE_PERMISSIONS: Record<LocalStaffRole, LocalStaffPermission[]> = {
  STAFF: ['reservation:review', 'reservation:checkin', 'member:redeem', 'refund:review', 'member:read', 'order:read'],
  OWNER: ['reservation:review', 'reservation:checkin', 'member:redeem', 'refund:review', 'member:read', 'order:read', 'finance:read']
}

@Injectable()
export class StaffAuthService {
  sessionForPin(staffPin: string) {
    const role = this.roleForPin(staffPin)
    if (!role) throw new UnauthorizedException('invalid staff pin')
    const name = role === 'OWNER' ? '本地老板账号' : '本地员工账号'

    return {
      staff: {
        id: role === 'OWNER' ? 'local_owner' : 'local_staff',
        name,
        role,
        permissions: this.permissionsForRole(role)
      },
      staff_pin: staffPin,
      staff_token: this.tokenForRole(role),
      access_token: this.tokenForRole(role),
      token_type: 'Bearer',
      expires_in: 7200,
      warning: '本地开发员工身份，仅用于小程序联调；正式上线需替换为微信员工/老板权限。'
    }
  }

  assertStaff(input: { staff_pin?: string; staff_token?: string; ownerOnly?: boolean; permission?: LocalStaffPermission }) {
    const role = this.resolveRole(input)
    if (!role) throw new UnauthorizedException(input.ownerOnly ? 'owner permission required' : 'staff permission required')
    if (input.ownerOnly && role !== 'OWNER') throw new UnauthorizedException('owner permission required')
    if (input.permission && !this.permissionsForRole(role).includes(input.permission)) {
      throw new UnauthorizedException(`permission required: ${input.permission}`)
    }
    return role
  }

  sessionForCredential(input: { staff_pin?: string; staff_token?: string }) {
    const role = this.assertStaff(input)
    const pin = role === 'OWNER' ? this.ownerPin() : this.staffPin()
    return this.sessionForPin(pin)
  }

  permissionsForRole(role: LocalStaffRole) {
    return ROLE_PERMISSIONS[role]
  }

  tokenForRole(role: LocalStaffRole) {
    const pin = role === 'OWNER' ? this.ownerPin() : this.staffPin()
    return `local_staff_${role.toLowerCase()}_${sha256(`${role}:${pin}:${this.secret()}`).slice(0, 32)}`
  }

  private resolveRole(input: { staff_pin?: string; staff_token?: string }) {
    if (input.staff_token) {
      if (input.staff_token === this.tokenForRole('OWNER')) return 'OWNER'
      if (input.staff_token === this.tokenForRole('STAFF')) return 'STAFF'
      return null
    }
    if (input.staff_pin) return this.roleForPin(input.staff_pin)
    return null
  }

  private roleForPin(staffPin: string): LocalStaffRole | null {
    if (staffPin === this.ownerPin()) return 'OWNER'
    if (staffPin === this.staffPin()) return 'STAFF'
    return null
  }

  private ownerPin() {
    return process.env.BARKBAR_OWNER_PIN || process.env.BARKBAR_STAFF_PIN || '8888'
  }

  private staffPin() {
    return process.env.BARKBAR_STAFF_PIN || '8888'
  }

  private secret() {
    return process.env.BARKBAR_LOCAL_AUTH_SECRET || 'barkbar-local-auth-v1'
  }
}
