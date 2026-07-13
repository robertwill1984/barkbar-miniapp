import { getCurrentUser, saveCurrentUser, PetProfile } from './storage'

function getConfig() {
  const app = getApp<IAppOption>()
  return {
    baseUrl: app.globalData.apiBaseUrl || 'http://127.0.0.1:3000/api/v1',
    enabled: app.globalData.apiEnabled !== false
  }
}

export function request<T = any>(options: { url: string; method?: 'GET' | 'POST'; data?: any; header?: Record<string, string> }): Promise<T> {
  const config = getConfig()
  if (!config.enabled) return Promise.reject(new Error('api disabled'))

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.baseUrl}${options.url}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'content-type': 'application/json',
        ...(options.header || {})
      },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T)
          return
        }
        reject(new Error(`api status ${response.statusCode}`))
      },
      fail: reject
    })
  })
}

function appendAdminCredential(params: string[], credential?: string) {
  if (!credential) return
  if (String(credential).indexOf('local_staff_') === 0) {
    params.push(`staff_token=${encodeURIComponent(credential)}`)
    return
  }
  params.push(`staff_pin=${encodeURIComponent(credential)}`)
}

function adminCredentialData(credential: string) {
  return String(credential).indexOf('local_staff_') === 0 ? { staff_token: credential } : { staff_pin: credential }
}

export async function ensureCurrentUser() {
  const cached = getCurrentUser()
  if (cached?.id) return cached

  const login = await request<any>({
    url: '/customer/auth/wechat-login',
    method: 'POST',
    data: {
      code: `local-dev-${Date.now()}`,
      nickname: '本地测试用户'
    }
  })
  const user = {
    ...login.user,
    accessToken: login.access_token
  }
  saveCurrentUser(user)
  return user
}

export function adminPinLogin(staffPin: string) {
  return request<any>({
    url: '/admin/auth/pin-login',
    method: 'POST',
    data: {
      staff_pin: staffPin
    }
  })
}

export function adminStaffSession(credential: string) {
  return request<any>({
    url: '/admin/auth/session',
    method: 'POST',
    data: adminCredentialData(credential)
  })
}

export function getReservationSlots(date: string) {
  return request<any[]>({ url: `/customer/reservation-slots?date=${encodeURIComponent(date || '')}` })
}

export function createPet(userId: string, pet: PetProfile) {
  return request<any>({
    url: '/customer/pets',
    method: 'POST',
    data: {
      user_id: userId,
      name: pet.name,
      breed: pet.breed || '待补充',
      size_class: pet.size,
      vaccination_status: pet.vaccineStatus && pet.vaccineStatus !== '待上传' ? 'VALID' : 'UNKNOWN',
      license_status: 'UNKNOWN',
      attack_history: Boolean(pet.behaviorNotes)
    }
  })
}

export function requiredAgreement(userId: string) {
  return request<any>({ url: `/customer/agreements/required?user_id=${encodeURIComponent(userId)}` })
}

export function acceptAgreement(agreementId: string, userId: string, petId: string | undefined, checkboxText: string) {
  return request<any>({
    url: `/customer/agreements/${encodeURIComponent(agreementId)}/accept`,
    method: 'POST',
    data: {
      user_id: userId,
      pet_id: petId,
      checkbox_text: checkboxText,
      user_agent: 'wechat-miniapp-local-dev'
    }
  })
}

export function createReservation(userId: string, slotId: string, peopleCount: number, petIds: string[], entryType = 'SINGLE_TICKET') {
  return request<any>({
    url: '/customer/reservations',
    method: 'POST',
    data: {
      user_id: userId,
      slot_id: slotId,
      people_count: peopleCount,
      pet_ids: petIds,
      entry_type: entryType
    }
  })
}

export function listReservations(userId: string) {
  return request<any[]>({ url: `/customer/reservations?user_id=${encodeURIComponent(userId)}` })
}

export function cancelReservation(reservationId: string, userId: string, reason: string, requestReschedule: boolean) {
  return request<any>({
    url: `/customer/reservations/${encodeURIComponent(reservationId)}/cancel`,
    method: 'POST',
    data: {
      user_id: userId,
      reason,
      request_reschedule: Boolean(requestReschedule)
    }
  })
}

export function generateReservationCheckinCode(reservationId: string, userId: string) {
  return request<any>({
    url: `/customer/reservations/${encodeURIComponent(reservationId)}/checkin-code`,
    method: 'POST',
    data: {
      user_id: userId
    }
  })
}

export function listMemberCards(userId: string) {
  return request<any[]>({ url: `/customer/cards?user_id=${encodeURIComponent(userId)}` })
}

export function generateMemberRedemptionCode(cardId: string, userId: string) {
  return request<any>({
    url: `/customer/cards/${encodeURIComponent(cardId)}/redemption-code`,
    method: 'POST',
    data: {
      user_id: userId
    }
  })
}

export function listProducts(scene?: string) {
  const query = scene ? `?scene=${encodeURIComponent(scene)}` : ''
  return request<any[]>({ url: `/customer/products${query}` })
}

export function createOrder(userId: string, scene: string, items: Array<{ sku_id: string; quantity: number }>, reservationId?: string) {
  return request<any>({
    url: '/customer/orders',
    method: 'POST',
    data: {
      user_id: userId,
      scene,
      items,
      reservation_id: reservationId
    }
  })
}

export function getOrderPaymentStatus(orderId: string, userId: string) {
  return request<any>({ url: `/customer/orders/${encodeURIComponent(orderId)}/payment?user_id=${encodeURIComponent(userId)}` })
}

export function listOrders(userId: string, scene?: string) {
  const params = [`user_id=${encodeURIComponent(userId)}`]
  if (scene) params.push(`scene=${encodeURIComponent(scene)}`)
  return request<any[]>({ url: `/customer/orders?${params.join('&')}` })
}

export function listRefunds(userId: string, sourceId?: string) {
  const params = [`user_id=${encodeURIComponent(userId)}`]
  if (sourceId) params.push(`source_id=${encodeURIComponent(sourceId)}`)
  return request<any[]>({ url: `/customer/refunds?${params.join('&')}` })
}

export function getRefundStatus(refundId: string, userId: string) {
  return request<any>({ url: `/customer/refunds/${encodeURIComponent(refundId)}/status?user_id=${encodeURIComponent(userId)}` })
}

export function createRefund(userId: string, sourceType: 'order', sourceId: string, reason: string) {
  return request<any>({
    url: '/customer/refunds',
    method: 'POST',
    data: {
      user_id: userId,
      source_type: sourceType,
      source_id: sourceId,
      reason
    }
  })
}

export function adminListReservations(status?: string, staffPin?: string) {
  const params = []
  if (status) params.push(`status=${encodeURIComponent(status)}`)
  appendAdminCredential(params, staffPin)
  const query = params.length ? `?${params.join('&')}` : ''
  return request<any[]>({ url: `/admin/reservations${query}` })
}

export function adminReviewReservation(reservationId: string, action: 'APPROVE' | 'REJECT', note: string | undefined, staffPin: string) {
  return request<any>({
    url: `/admin/reservations/${encodeURIComponent(reservationId)}/review`,
    method: 'POST',
    data: {
      action,
      note,
      ...adminCredentialData(staffPin)
    }
  })
}

export function adminConsumeMemberCode(code: string, staffPin: string) {
  return request<any>({
    url: '/admin/redemptions/consume-code',
    method: 'POST',
    data: {
      code,
      ...adminCredentialData(staffPin),
      note: '员工会员动态码核销'
    }
  })
}

export function adminCheckinReservation(reservationId: string, note: string | undefined, staffPin: string) {
  return request<any>({
    url: `/admin/reservations/${encodeURIComponent(reservationId)}/checkin`,
    method: 'POST',
    data: {
      note,
      ...adminCredentialData(staffPin)
    }
  })
}

export function adminVerifyCheckinCode(code: string, staffPin: string) {
  return request<any>({
    url: '/admin/reservations/verify-code',
    method: 'POST',
    data: {
      code,
      ...adminCredentialData(staffPin),
      note: '员工动态码核验通过'
    }
  })
}

export function adminListRefunds(status?: string, staffPin?: string) {
  const params = []
  if (status) params.push(`status=${encodeURIComponent(status)}`)
  appendAdminCredential(params, staffPin)
  const query = params.length ? `?${params.join('&')}` : ''
  return request<any[]>({ url: `/admin/refunds${query}` })
}

export function adminReviewRefund(refundId: string, action: 'APPROVE' | 'REJECT', note: string | undefined, staffPin: string) {
  return request<any>({
    url: `/admin/refunds/${encodeURIComponent(refundId)}/review`,
    method: 'POST',
    data: {
      action,
      note,
      ...adminCredentialData(staffPin)
    }
  })
}

export function adminListOrders(staffPin: string, userId?: string, scene?: string) {
  const params: string[] = []
  appendAdminCredential(params, staffPin)
  if (userId) params.push(`user_id=${encodeURIComponent(userId)}`)
  if (scene) params.push(`scene=${encodeURIComponent(scene)}`)
  return request<any[]>({ url: `/admin/orders?${params.join('&')}` })
}

export function adminListCards(staffPin: string, userId?: string, status?: string) {
  const params: string[] = []
  appendAdminCredential(params, staffPin)
  if (userId) params.push(`user_id=${encodeURIComponent(userId)}`)
  if (status) params.push(`status=${encodeURIComponent(status)}`)
  return request<any[]>({ url: `/admin/cards?${params.join('&')}` })
}

export function adminFinanceOverview(staffPin: string, from?: string, to?: string) {
  const params = []
  appendAdminCredential(params, staffPin)
  if (from) params.push(`from=${encodeURIComponent(from)}`)
  if (to) params.push(`to=${encodeURIComponent(to)}`)
  const query = params.length ? `?${params.join('&')}` : ''
  return request<any>({ url: `/admin/finance/overview${query}` })
}

export function adminDividendBasis(staffPin: string, from?: string, to?: string) {
  const params = []
  appendAdminCredential(params, staffPin)
  if (from) params.push(`from=${encodeURIComponent(from)}`)
  if (to) params.push(`to=${encodeURIComponent(to)}`)
  const query = params.length ? `?${params.join('&')}` : ''
  return request<any>({ url: `/admin/finance/dividend-basis${query}` })
}
