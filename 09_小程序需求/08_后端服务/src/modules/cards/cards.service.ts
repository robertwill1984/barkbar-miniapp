import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { StaffAuthService } from '../../common/staff-auth.service'
import { InMemoryStore, MemberCardRecord, MemberRedemptionRecord, sha256 } from '../../common/store.service'

const REDEMPTION_CODE_TTL_SECONDS = 60

@Injectable()
export class CardsService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly staffAuth: StaffAuthService
  ) {}

  list(userId: string) {
    if (!userId) throw new BadRequestException('user_id is required')
    this.ensureLocalDemoCard(userId)
    return [...this.store.memberCards.values()]
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  adminList(input: { staff_pin?: string; staff_token?: string; user_id?: string; status?: MemberCardRecord['status'] }) {
    this.assertStaff(input, 'member:read')
    return [...this.store.memberCards.values()]
      .filter((item) => !input.user_id || item.userId === input.user_id)
      .filter((item) => !input.status || item.status === input.status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  generateCode(cardId: string, input: { user_id: string }) {
    if (!input.user_id) throw new BadRequestException('user_id is required')
    const card = this.store.memberCards.get(cardId)
    if (!card) throw new NotFoundException('member card not found')
    if (card.userId !== input.user_id) throw new BadRequestException('member card does not belong to user')
    this.assertCardUsable(card)

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + REDEMPTION_CODE_TTL_SECONDS * 1000).toISOString()
    const record: MemberRedemptionRecord = {
      id: this.store.id('mred'),
      cardId,
      userId: input.user_id,
      codeHash: sha256(`${cardId}:${code}:${expiresAt}`),
      codeExpiresAt: expiresAt,
      createdAt: this.store.now()
    }
    this.store.memberRedemptions.set(record.id, record)
    return {
      card_id: cardId,
      code,
      expires_in_seconds: REDEMPTION_CODE_TTL_SECONDS,
      expires_at: expiresAt
    }
  }

  consumeCode(input: { staff_pin?: string; staff_token?: string; code: string; note?: string }) {
    this.assertStaff(input, 'member:redeem')
    if (!input.code) throw new BadRequestException('code is required')
    const now = Date.now()
    const redemption = [...this.store.memberRedemptions.values()].find((item) => {
      if (!item.codeHash || !item.codeExpiresAt || item.consumedAt) return false
      if (new Date(item.codeExpiresAt).getTime() < now) return false
      return sha256(`${item.cardId}:${input.code}:${item.codeExpiresAt}`) === item.codeHash
    })
    if (!redemption) throw new BadRequestException('invalid or expired member code')

    const card = this.store.memberCards.get(redemption.cardId)
    if (!card) throw new NotFoundException('member card not found')
    this.assertCardUsable(card)

    const updatedCard: MemberCardRecord = {
      ...card,
      remainingUnits:
        card.cardType === 'TEN_PASS' ? Math.max(0, (card.remainingUnits || 0) - 1) : card.remainingUnits
    }
    const updatedRedemption: MemberRedemptionRecord = {
      ...redemption,
      consumedAt: this.store.now(),
      consumedBy: 'local-staff',
      note: input.note || '员工会员动态码核销',
      codeHash: undefined,
      codeExpiresAt: undefined
    }
    this.store.memberCards.set(updatedCard.id, updatedCard)
    this.store.memberRedemptions.set(updatedRedemption.id, updatedRedemption)

    return {
      card: updatedCard,
      redemption: updatedRedemption
    }
  }

  private ensureLocalDemoCard(userId: string) {
    const existing = [...this.store.memberCards.values()].some((item) => item.userId === userId && item.status === 'ACTIVE')
    if (existing) return
    const now = this.store.now()
    const validUntil = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
    const card: MemberCardRecord = {
      id: this.store.id('card'),
      userId,
      cardType: 'TEN_PASS',
      title: '10次卡',
      status: 'ACTIVE',
      totalUnits: 10,
      remainingUnits: 10,
      validFrom: now,
      validUntil,
      createdAt: now
    }
    this.store.memberCards.set(card.id, card)
  }

  private assertCardUsable(card: MemberCardRecord) {
    if (card.status !== 'ACTIVE') throw new BadRequestException('member card is not active')
    if (new Date(card.validUntil).getTime() < Date.now()) throw new BadRequestException('member card expired')
    if (card.cardType === 'TEN_PASS' && (card.remainingUnits || 0) <= 0) throw new BadRequestException('member card has no remaining units')
  }

  private assertStaff(input: { staff_pin?: string; staff_token?: string }, permission: 'member:read' | 'member:redeem') {
    this.staffAuth.assertStaff({ ...input, permission })
  }
}
