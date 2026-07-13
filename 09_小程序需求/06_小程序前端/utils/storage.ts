const KEYS = {
  currentUser: 'bb_current_user',
  staffPin: 'bb_staff_pin',
  staffSession: 'bb_staff_session',
  petProfile: 'bb_pet_profile',
  agreementAcceptance: 'bb_agreement_acceptance',
  reservations: 'bb_reservations'
}

export function saveStaffPin(pin: string) {
  wx.setStorageSync(KEYS.staffPin, pin)
}

export function getStaffPin(): string {
  return wx.getStorageSync(KEYS.staffPin) || ''
}

export interface StaffSession {
  staff: {
    id: string
    name: string
    role: 'STAFF' | 'OWNER'
    permissions: string[]
  }
  staff_pin: string
  staff_token?: string
  access_token?: string
  token_type?: string
  expires_in?: number
  warning?: string
  updatedAt?: string
}

export function saveStaffSession(session: StaffSession) {
  wx.setStorageSync(KEYS.staffSession, {
    ...session,
    updatedAt: new Date().toISOString()
  })
  if (session?.staff_pin) saveStaffPin(session.staff_pin)
}

export function getStaffSession(): StaffSession | null {
  return wx.getStorageSync(KEYS.staffSession) || null
}

export interface CurrentUser {
  id: string
  nickname?: string
  openid?: string
  accessToken?: string
  updatedAt?: string
}

export interface PetProfile {
  backendId?: string
  ownerUserId?: string
  name: string
  breed: string
  size: string
  firstVisit: boolean
  firstSwim: boolean
  vaccineStatus: string
  behaviorNotes: string
  updatedAt?: string
}

export interface AgreementAcceptance {
  acceptanceId?: string
  agreementId?: string
  version: string
  title?: string
  acceptedAt: string
  contentHash?: string
  contentSnapshot?: string
}

export interface ReservationRecord {
  id: string
  backendId?: string
  slotId: string
  slotLabel: string
  peopleCount: number
  dogCount: number
  petName: string
  status: '待到店' | '需人工审核' | '已取消' | '改期申请中' | '已拒绝' | '已核验'
  totalAmount: number
  cancelReason?: string
  canceledAt?: string
  createdAt: string
}

export function saveCurrentUser(user: CurrentUser) {
  wx.setStorageSync(KEYS.currentUser, {
    ...user,
    updatedAt: new Date().toISOString()
  })
}

export function getCurrentUser(): CurrentUser | null {
  return wx.getStorageSync(KEYS.currentUser) || null
}

export function savePetProfile(profile: PetProfile) {
  wx.setStorageSync(KEYS.petProfile, {
    ...profile,
    updatedAt: new Date().toISOString()
  })
}

export function getPetProfile(): PetProfile | null {
  return wx.getStorageSync(KEYS.petProfile) || null
}

export function simpleHash(text: string) {
  let hash = 0
  const value = String(text || '')
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i)
    hash |= 0
  }
  return `h_${Math.abs(hash)}`
}

export function saveAgreementAcceptance(version = 'V1.4', agreement?: any) {
  const snapshot = agreement ? JSON.stringify(agreement) : ''
  const acceptance: AgreementAcceptance = {
    version,
    title: agreement?.title || 'Bark & Bar 入园须知及安全协议',
    acceptedAt: new Date().toISOString(),
    contentHash: simpleHash(snapshot),
    contentSnapshot: snapshot
  }
  wx.setStorageSync(KEYS.agreementAcceptance, acceptance)
  return acceptance
}

export function getAgreementAcceptance(): AgreementAcceptance | null {
  return wx.getStorageSync(KEYS.agreementAcceptance) || null
}

export function saveReservation(record: ReservationRecord) {
  const list = getReservations()
  const next = [record, ...list.filter((item) => item.id !== record.id)]
  wx.setStorageSync(KEYS.reservations, next)
  return record
}

export function getReservations(): ReservationRecord[] {
  return wx.getStorageSync(KEYS.reservations) || []
}

export function getReservationById(id: string): ReservationRecord | null {
  return getReservations().find((item) => item.id === id) || null
}

export function updateReservation(id: string, patch: Partial<ReservationRecord>): ReservationRecord | null {
  const list = getReservations()
  const next = list.map((item) => (item.id === id ? { ...item, ...patch } : item))
  wx.setStorageSync(KEYS.reservations, next)
  return next.find((item) => item.id === id) || null
}
