const KEYS = {
  currentUser: 'bb_current_user',
  staffPin: 'bb_staff_pin',
  staffSession: 'bb_staff_session',
  petProfile: 'bb_pet_profile',
  agreementAcceptance: 'bb_agreement_acceptance',
  reservations: 'bb_reservations'
}

function saveStaffPin(pin) {
  wx.setStorageSync(KEYS.staffPin, pin)
}

function getStaffPin() {
  return wx.getStorageSync(KEYS.staffPin) || ''
}

function saveStaffSession(session) {
  wx.setStorageSync(KEYS.staffSession, {
    ...session,
    updatedAt: new Date().toISOString()
  })
  if (session && session.staff_pin) saveStaffPin(session.staff_pin)
}

function getStaffSession() {
  return wx.getStorageSync(KEYS.staffSession) || null
}

function saveCurrentUser(user) {
  wx.setStorageSync(KEYS.currentUser, {
    ...user,
    updatedAt: new Date().toISOString()
  })
}

function getCurrentUser() {
  return wx.getStorageSync(KEYS.currentUser) || null
}

function savePetProfile(profile) {
  wx.setStorageSync(KEYS.petProfile, {
    ...profile,
    updatedAt: new Date().toISOString()
  })
}

function getPetProfile() {
  return wx.getStorageSync(KEYS.petProfile) || null
}

function simpleHash(text) {
  let hash = 0
  const value = String(text || '')
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i)
    hash |= 0
  }
  return `h_${Math.abs(hash)}`
}

function saveAgreementAcceptance(version = 'V1.4', agreement) {
  const snapshot = agreement ? JSON.stringify(agreement) : ''
  const acceptance = {
    version,
    title: agreement && agreement.title ? agreement.title : 'Bark & Bar 入园须知及安全协议',
    acceptedAt: new Date().toISOString(),
    contentHash: simpleHash(snapshot),
    contentSnapshot: snapshot
  }
  wx.setStorageSync(KEYS.agreementAcceptance, acceptance)
  return acceptance
}

function getAgreementAcceptance() {
  return wx.getStorageSync(KEYS.agreementAcceptance) || null
}

function saveReservation(record) {
  const list = getReservations()
  const next = [record, ...list.filter((item) => item.id !== record.id)]
  wx.setStorageSync(KEYS.reservations, next)
  return record
}

function getReservations() {
  return wx.getStorageSync(KEYS.reservations) || []
}

function getReservationById(id) {
  return getReservations().find((item) => item.id === id) || null
}

function updateReservation(id, patch) {
  const list = getReservations()
  const next = list.map((item) => (item.id === id ? { ...item, ...patch } : item))
  wx.setStorageSync(KEYS.reservations, next)
  return next.find((item) => item.id === id) || null
}

module.exports = {
  saveCurrentUser,
  getCurrentUser,
  saveStaffPin,
  getStaffPin,
  saveStaffSession,
  getStaffSession,
  savePetProfile,
  getPetProfile,
  simpleHash,
  saveAgreementAcceptance,
  getAgreementAcceptance,
  saveReservation,
  getReservations,
  getReservationById,
  updateReservation
}
