import { Injectable } from '@nestjs/common'
import { createHash, randomUUID } from 'crypto'
import { existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'

const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => SqliteDatabase
}

type SqliteDatabase = {
  exec(sql: string): void
  prepare(sql: string): {
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): unknown
    run(...params: unknown[]): unknown
  }
}

export type UserRecord = {
  id: string
  appId: string
  openid: string
  nickname?: string
  createdAt: string
  lastLoginAt: string
}

export type PetRecord = {
  id: string
  ownerUserId: string
  name: string
  breed: string
  sizeClass?: string
  weightKg?: number
  vaccinationStatus: 'UNKNOWN' | 'VALID' | 'EXPIRED'
  licenseStatus: 'UNKNOWN' | 'VALID' | 'MISSING'
  attackHistory: boolean
  riskReviewRequired: boolean
  riskReviewStatus: 'UNASSESSED' | 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
}

export type AgreementRecord = {
  id: string
  agreementType: string
  version: string
  title: string
  contentSnapshot: string
  contentHash: string
  requiresReacceptance: boolean
  status: 'PUBLISHED'
  effectiveAt: string
}

export type AgreementAcceptanceRecord = {
  id: string
  agreementId: string
  userId: string
  petId?: string
  acceptedAt: string
  contentHash: string
  evidenceHash: string
  checkboxText: string
}

export type ReservationRecord = {
  id: string
  userId: string
  slotId: string
  peopleCount: number
  petIds: string[]
  entryType: 'SINGLE_TICKET' | 'MEMBER_CARD'
  status: 'PENDING_REVIEW' | 'CONFIRMED' | 'CANCELED' | 'RESCHEDULE_REQUESTED' | 'REJECTED' | 'CHECKED_IN'
  estimatedAmountFen: number
  reviewReason?: string
  adminReviewNote?: string
  reviewedAt?: string
  checkinCodeHash?: string
  checkinCodeExpiresAt?: string
  cancelReason?: string
  rescheduleRequested?: boolean
  canceledAt?: string
  checkedInAt?: string
  createdAt: string
}

export type MemberCardRecord = {
  id: string
  userId: string
  cardType: 'TEN_PASS' | 'SEASON' | 'ANNUAL'
  title: string
  status: 'ACTIVE' | 'EXPIRED' | 'FROZEN'
  totalUnits?: number
  remainingUnits?: number
  validFrom: string
  validUntil: string
  createdAt: string
}

export type MemberRedemptionRecord = {
  id: string
  cardId: string
  userId: string
  codeHash?: string
  codeExpiresAt?: string
  consumedAt?: string
  consumedBy?: string
  note?: string
  createdAt: string
}

export type OrderRecord = {
  id: string
  userId: string
  scene: 'TICKET' | 'CARD' | 'BAR' | 'RETAIL'
  items: Array<{
    skuId: string
    name: string
    quantity: number
    unitPriceCents: number
    subtotalCents: number
  }>
  payableAmountCents: number
  status: 'PAID' | 'CANCELED' | 'REFUND_REQUESTED'
  relatedCardId?: string
  createdAt: string
  paidAt?: string
}

export type PaymentRecord = {
  id: string
  orderId: string
  userId: string
  amountCents: number
  channel: 'LOCAL_MOCK' | 'WECHAT_PAY'
  status: 'SUCCESS' | 'FAILED'
  paidAt: string
  createdAt: string
}

export type CashLedgerRecord = {
  id: string
  sourceType: 'ORDER_PAYMENT' | 'REFUND' | 'EXPENSE'
  sourceId: string
  direction: 'IN' | 'OUT'
  amountCents: number
  note: string
  occurredAt: string
  createdAt: string
}

export type RefundRecord = {
  id: string
  userId: string
  sourceType: 'ORDER'
  sourceId: string
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELED'
  reason: string
  calculatedRefundCents: number
  components: Array<{
    name: string
    amountCents: number
  }>
  evidenceFileIds: string[]
  createdAt: string
  reviewedAt?: string
  reviewNote?: string
}

@Injectable()
export class InMemoryStore {
  private readonly db: SqliteDatabase
  readonly users: LocalTable<UserRecord>
  readonly pets: LocalTable<PetRecord>
  readonly agreements: LocalTable<AgreementRecord>
  readonly acceptances: LocalTable<AgreementAcceptanceRecord>
  readonly reservations: LocalTable<ReservationRecord>
  readonly memberCards: LocalTable<MemberCardRecord>
  readonly memberRedemptions: LocalTable<MemberRedemptionRecord>
  readonly orders: LocalTable<OrderRecord>
  readonly payments: LocalTable<PaymentRecord>
  readonly cashLedger: LocalTable<CashLedgerRecord>
  readonly refunds: LocalTable<RefundRecord>

  constructor() {
    const dbPath = process.env.BARKBAR_SQLITE_PATH || join(process.cwd(), 'local-data', 'barkbar-local.sqlite')
    ensureDirectory(dirname(dbPath))
    this.db = new DatabaseSync(dbPath)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kv_store (
        bucket TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (bucket, id)
      );
      CREATE INDEX IF NOT EXISTS idx_kv_store_bucket ON kv_store(bucket);
    `)

    this.users = new LocalTable<UserRecord>(this.db, 'users')
    this.pets = new LocalTable<PetRecord>(this.db, 'pets')
    this.agreements = new LocalTable<AgreementRecord>(this.db, 'agreements')
    this.acceptances = new LocalTable<AgreementAcceptanceRecord>(this.db, 'acceptances')
    this.reservations = new LocalTable<ReservationRecord>(this.db, 'reservations')
    this.memberCards = new LocalTable<MemberCardRecord>(this.db, 'memberCards')
    this.memberRedemptions = new LocalTable<MemberRedemptionRecord>(this.db, 'memberRedemptions')
    this.orders = new LocalTable<OrderRecord>(this.db, 'orders')
    this.payments = new LocalTable<PaymentRecord>(this.db, 'payments')
    this.cashLedger = new LocalTable<CashLedgerRecord>(this.db, 'cashLedger')
    this.refunds = new LocalTable<RefundRecord>(this.db, 'refunds')

    const contentSnapshot = [
      'Bark & Bar 巴克巴宠物乐园入园须知及安全协议 V1.4',
      '来源：附件A_入园须知及安全协议_V1.3_统一序号版.docx',
      '泳池水深约0.8-1m，无浅水适应区；幼犬、小型犬、首次游泳、不会游泳或游泳能力未确认犬只必须穿宠物救生衣。',
      '主人须全程看护犬只；入园、离园及公共活动区须牵引或处于可立即控制状态。',
      '犬只互动、奔跑、入水存在受伤、呛水、溺水、应激、传染病和逃逸风险。',
      '会员/退款细则以 Bark&Bar 专项会员及退款规则为准。'
    ].join('\n')

    const agreement: AgreementRecord = {
      id: 'entry-agreement-v1-4',
      agreementType: 'ENTRY_SAFETY',
      version: 'V1.4',
      title: 'Bark & Bar 巴克巴宠物乐园入园须知及安全协议',
      contentSnapshot,
      contentHash: sha256(contentSnapshot),
      requiresReacceptance: true,
      status: 'PUBLISHED',
      effectiveAt: '2026-07-10T00:00:00.000+08:00'
    }
    if (!this.agreements.has(agreement.id)) this.agreements.set(agreement.id, agreement)
  }

  now() {
    return new Date().toISOString()
  }

  id(prefix: string) {
    return `${prefix}_${randomUUID()}`
  }
}

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function ensureDirectory(path: string) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true })
}

type StoredRow = {
  data: string
}

export class LocalTable<TRecord extends { id: string }> {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly bucket: string
  ) {}

  values(): IterableIterator<TRecord> {
    return this.all().values()
  }

  all(): TRecord[] {
    const rows = this.db.prepare('SELECT data FROM kv_store WHERE bucket = ? ORDER BY updated_at ASC').all(this.bucket) as StoredRow[]
    return rows.map((row) => JSON.parse(row.data) as TRecord)
  }

  get(id: string): TRecord | undefined {
    const row = this.db.prepare('SELECT data FROM kv_store WHERE bucket = ? AND id = ?').get(this.bucket, id) as StoredRow | undefined
    return row ? (JSON.parse(row.data) as TRecord) : undefined
  }

  has(id: string): boolean {
    return Boolean(this.get(id))
  }

  set(id: string, record: TRecord): this {
    this.db
      .prepare(
        `INSERT INTO kv_store (bucket, id, data, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(bucket, id)
         DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      )
      .run(this.bucket, id, JSON.stringify(record), new Date().toISOString())
    return this
  }
}
