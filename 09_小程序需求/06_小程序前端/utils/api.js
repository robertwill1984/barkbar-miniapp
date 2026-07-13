const { getCurrentUser, saveCurrentUser } = require('./storage')

function getConfig() {
  const app = getApp()
  return {
    baseUrl: app.globalData.apiBaseUrl || 'http://127.0.0.1:3000/api/v1',
    enabled: app.globalData.apiEnabled !== false
  }
}

function request(options) {
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
          resolve(response.data)
          return
        }
        reject(new Error(`api status ${response.statusCode}`))
      },
      fail(error) {
        reject(error)
      }
    })
  })
}

function appendAdminCredential(params, credential) {
  if (!credential) return
  if (String(credential).indexOf('local_staff_') === 0) {
    params.push(`staff_token=${encodeURIComponent(credential)}`)
    return
  }
  params.push(`staff_pin=${encodeURIComponent(credential)}`)
}

function adminCredentialData(credential) {
  return String(credential).indexOf('local_staff_') === 0 ? { staff_token: credential } : { staff_pin: credential }
}

async function ensureCurrentUser() {
  const cached = getCurrentUser()
  if (cached && cached.id) return cached

  const login = await request({
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

function adminPinLogin(staffPin) {
  return request({
    url: '/admin/auth/pin-login',
    method: 'POST',
    data: {
      staff_pin: staffPin
    }
  })
}

function adminStaffSession(credential) {
  return request({
    url: '/admin/auth/session',
    method: 'POST',
    data: adminCredentialData(credential)
  })
}

function getReservationSlots(date) {
  return request({ url: `/customer/reservation-slots?date=${encodeURIComponent(date || '')}` })
}

function createPet(userId, pet) {
  return request({
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

function requiredAgreement(userId) {
  return request({ url: `/customer/agreements/required?user_id=${encodeURIComponent(userId)}` })
}

function acceptAgreement(agreementId, userId, petId, checkboxText) {
  return request({
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

function createReservation(userId, slotId, peopleCount, petIds, entryType) {
  return request({
    url: '/customer/reservations',
    method: 'POST',
    data: {
      user_id: userId,
      slot_id: slotId,
      people_count: peopleCount,
      pet_ids: petIds,
      entry_type: entryType || 'SINGLE_TICKET'
    }
  })
}

function listReservations(userId) {
  return request({ url: `/customer/reservations?user_id=${encodeURIComponent(userId)}` })
}

function cancelReservation(reservationId, userId, reason, requestReschedule) {
  return request({
    url: `/customer/reservations/${encodeURIComponent(reservationId)}/cancel`,
    method: 'POST',
    data: {
      user_id: userId,
      reason,
      request_reschedule: Boolean(requestReschedule)
    }
  })
}

function generateReservationCheckinCode(reservationId, userId) {
  return request({
    url: `/customer/reservations/${encodeURIComponent(reservationId)}/checkin-code`,
    method: 'POST',
    data: {
      user_id: userId
    }
  })
}

function listMemberCards(userId) {
  return request({ url: `/customer/cards?user_id=${encodeURIComponent(userId)}` })
}

function generateMemberRedemptionCode(cardId, userId) {
  return request({
    url: `/customer/cards/${encodeURIComponent(cardId)}/redemption-code`,
    method: 'POST',
    data: {
      user_id: userId
    }
  })
}

function listProducts(scene) {
  const query = scene ? `?scene=${encodeURIComponent(scene)}` : ''
  return request({ url: `/customer/products${query}` })
}

function createOrder(userId, scene, items, reservationId) {
  return request({
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

function getOrderPaymentStatus(orderId, userId) {
  return request({ url: `/customer/orders/${encodeURIComponent(orderId)}/payment?user_id=${encodeURIComponent(userId)}` })
}

function listOrders(userId, scene) {
  const params = [`user_id=${encodeURIComponent(userId)}`]
  if (scene) params.push(`scene=${encodeURIComponent(scene)}`)
  return request({ url: `/customer/orders?${params.join('&')}` })
}

function listRefunds(userId, sourceId) {
  const params = [`user_id=${encodeURIComponent(userId)}`]
  if (sourceId) params.push(`source_id=${encodeURIComponent(sourceId)}`)
  return request({ url: `/customer/refunds?${params.join('&')}` })
}

function getRefundStatus(refundId, userId) {
  return request({ url: `/customer/refunds/${encodeURIComponent(refundId)}/status?user_id=${encodeURIComponent(userId)}` })
}

function createRefund(userId, sourceType, sourceId, reason) {
  return request({
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

function adminListReservations(status, staffPin) {
  const params = []
  if (status) params.push(`status=${encodeURIComponent(status)}`)
  appendAdminCredential(params, staffPin)
  const query = params.length ? `?${params.join('&')}` : ''
  return request({ url: `/admin/reservations${query}` })
}

function adminReviewReservation(reservationId, action, note, staffPin) {
  return request({
    url: `/admin/reservations/${encodeURIComponent(reservationId)}/review`,
    method: 'POST',
    data: {
      action,
      note,
      ...adminCredentialData(staffPin)
    }
  })
}

function adminCheckinReservation(reservationId, note, staffPin) {
  return request({
    url: `/admin/reservations/${encodeURIComponent(reservationId)}/checkin`,
    method: 'POST',
    data: {
      note,
      ...adminCredentialData(staffPin)
    }
  })
}

function adminVerifyCheckinCode(code, staffPin) {
  return request({
    url: '/admin/reservations/verify-code',
    method: 'POST',
    data: {
      code,
      ...adminCredentialData(staffPin),
      note: '员工动态码核验通过'
    }
  })
}

function adminConsumeMemberCode(code, staffPin) {
  return request({
    url: '/admin/redemptions/consume-code',
    method: 'POST',
    data: {
      code,
      ...adminCredentialData(staffPin),
      note: '员工会员动态码核销'
    }
  })
}

function adminListRefunds(status, staffPin) {
  const params = []
  if (status) params.push(`status=${encodeURIComponent(status)}`)
  appendAdminCredential(params, staffPin)
  const query = params.length ? `?${params.join('&')}` : ''
  return request({ url: `/admin/refunds${query}` })
}

function adminReviewRefund(refundId, action, note, staffPin) {
  return request({
    url: `/admin/refunds/${encodeURIComponent(refundId)}/review`,
    method: 'POST',
    data: {
      action,
      note,
      ...adminCredentialData(staffPin)
    }
  })
}

function adminListOrders(staffPin, userId, scene) {
  const params = []
  appendAdminCredential(params, staffPin)
  if (userId) params.push(`user_id=${encodeURIComponent(userId)}`)
  if (scene) params.push(`scene=${encodeURIComponent(scene)}`)
  return request({ url: `/admin/orders?${params.join('&')}` })
}

function adminListCards(staffPin, userId, status) {
  const params = []
  appendAdminCredential(params, staffPin)
  if (userId) params.push(`user_id=${encodeURIComponent(userId)}`)
  if (status) params.push(`status=${encodeURIComponent(status)}`)
  return request({ url: `/admin/cards?${params.join('&')}` })
}

function adminFinanceOverview(staffPin, from, to) {
  const params = []
  appendAdminCredential(params, staffPin)
  if (from) params.push(`from=${encodeURIComponent(from)}`)
  if (to) params.push(`to=${encodeURIComponent(to)}`)
  const query = params.length ? `?${params.join('&')}` : ''
  return request({ url: `/admin/finance/overview${query}` })
}

function adminDividendBasis(staffPin, from, to) {
  const params = []
  appendAdminCredential(params, staffPin)
  if (from) params.push(`from=${encodeURIComponent(from)}`)
  if (to) params.push(`to=${encodeURIComponent(to)}`)
  const query = params.length ? `?${params.join('&')}` : ''
  return request({ url: `/admin/finance/dividend-basis${query}` })
}

module.exports = {
  request,
  ensureCurrentUser,
  getReservationSlots,
  createPet,
  requiredAgreement,
  acceptAgreement,
  createReservation,
  listReservations,
  cancelReservation,
  generateReservationCheckinCode,
  listMemberCards,
  generateMemberRedemptionCode,
  listProducts,
  createOrder,
  getOrderPaymentStatus,
  listOrders,
  listRefunds,
  getRefundStatus,
  createRefund,
  adminPinLogin,
  adminStaffSession,
  adminListReservations,
  adminReviewReservation,
  adminCheckinReservation,
  adminVerifyCheckinCode,
  adminConsumeMemberCode,
  adminListRefunds,
  adminReviewRefund,
  adminListOrders,
  adminListCards,
  adminFinanceOverview,
  adminDividendBasis
}
