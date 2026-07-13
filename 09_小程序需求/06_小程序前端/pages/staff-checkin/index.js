const api = require('../../utils/api')
const { getStaffPin, getStaffSession, saveStaffSession } = require('../../utils/storage')

const SLOT_LABELS = {
  slot_1000: '10:00-12:00',
  slot_1400: '14:00-16:00',
  slot_1700: '17:00-19:30'
}

Page({
  data: {
    loading: false,
    staffPinInput: '',
    staffToken: '',
    staffUnlocked: false,
    staffName: '',
    staffRole: '',
    verificationCode: '',
    memberCode: '',
    memberQueryUserId: '',
    reservations: [],
    refunds: [],
    staffOrders: [],
    staffCards: [],
    checks: [
      { title: '协议确认', value: '已确认当前版本' },
      { title: '疫苗/健康', value: '待现场核验' },
      { title: '风险审核', value: '无公开红色标签，仅内部判断' },
      { title: '宠物救生衣', value: '首次游泳/小型犬必须穿戴' }
    ]
  },
  async onShow() {
    const staffPin = getStaffPin()
    const staffSession = getStaffSession()
    this.setData({
      staffPinInput: staffPin,
      staffToken: staffSession && staffSession.access_token ? staffSession.access_token : '',
      staffUnlocked: Boolean(staffPin && staffSession),
      staffName: staffSession && staffSession.staff ? staffSession.staff.name : '',
      staffRole: staffSession && staffSession.staff ? mapStaffRole(staffSession.staff.role) : ''
    })
    if (staffPin && staffSession) {
      await this.refreshStaffSession()
      this.loadStaffData()
    }
  },
  onStaffPinInput(event) {
    this.setData({ staffPinInput: event.detail.value })
  },
  async unlockStaff() {
    if (!this.data.staffPinInput) {
      wx.showToast({ title: '请输入员工 PIN', icon: 'none' })
      return
    }
    wx.showLoading({ title: '验证中' })
    try {
      const session = await api.adminPinLogin(this.data.staffPinInput)
      saveStaffSession(session)
      wx.hideLoading()
      this.setData({
        staffUnlocked: true,
        staffToken: session.access_token,
        staffName: session.staff.name,
        staffRole: mapStaffRole(session.staff.role)
      })
      this.loadStaffData()
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '员工 PIN 不正确', icon: 'none' })
    }
  },
  onVerificationCodeInput(event) {
    this.setData({ verificationCode: event.detail.value })
  },
  onMemberCodeInput(event) {
    this.setData({ memberCode: event.detail.value })
  },
  onMemberQueryUserIdInput(event) {
    this.setData({ memberQueryUserId: event.detail.value })
  },
  loadStaffData() {
    this.loadReservations()
    this.loadRefunds()
    this.loadMemberRecords()
  },
  async refreshStaffSession() {
    const credential = this.staffCredential()
    if (!credential) return
    try {
      const session = await api.adminStaffSession(credential)
      saveStaffSession(session)
      this.setData({
        staffToken: session.access_token,
        staffUnlocked: true,
        staffName: session.staff.name,
        staffRole: mapStaffRole(session.staff.role)
      })
    } catch (error) {
      this.setData({ staffUnlocked: false })
      wx.showToast({ title: '员工登录已失效，请重新输入 PIN', icon: 'none' })
    }
  },
  async loadReservations() {
    if (!this.data.staffUnlocked) return
    this.setData({ loading: true })
    try {
      const reservations = await api.adminListReservations(undefined, this.staffCredential())
      this.setData({
        reservations: reservations.map(normalizeReservation),
        loading: false
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: '员工 PIN 或后端异常', icon: 'none' })
    }
  },
  async loadRefunds() {
    if (!this.data.staffUnlocked) return
    try {
      const refunds = await api.adminListRefunds(undefined, this.staffCredential())
      this.setData({ refunds: refunds.map(normalizeRefund) })
    } catch (error) {
      this.setData({ refunds: [] })
    }
  },
  async loadMemberRecords() {
    if (!this.data.staffUnlocked) return
    try {
      const userId = this.data.memberQueryUserId.trim()
      const orders = await api.adminListOrders(this.staffCredential(), userId, 'card')
      const cards = await api.adminListCards(this.staffCredential(), userId, undefined)
      this.setData({
        staffOrders: orders.map(normalizeStaffOrder),
        staffCards: cards.map(normalizeStaffCard)
      })
    } catch (error) {
      this.setData({ staffOrders: [], staffCards: [] })
    }
  },
  approveReservation(event) {
    this.reviewReservation(event.currentTarget.dataset.id, 'APPROVE')
  },
  rejectReservation(event) {
    this.reviewReservation(event.currentTarget.dataset.id, 'REJECT')
  },
  async reviewReservation(id, action) {
    wx.showLoading({ title: '处理中' })
    try {
      await api.adminReviewReservation(id, action, action === 'APPROVE' ? '员工审核通过' : '员工审核拒绝', this.staffCredential())
      wx.hideLoading()
      wx.showToast({ title: action === 'APPROVE' ? '已通过' : '已拒绝', icon: 'success' })
      this.loadStaffData()
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '处理失败', icon: 'none' })
    }
  },
  async checkinReservation(event) {
    const id = event.currentTarget.dataset.id
    wx.showLoading({ title: '核验中' })
    try {
      await api.adminCheckinReservation(id, '员工到店核验通过', this.staffCredential())
      wx.hideLoading()
      wx.showToast({ title: '已核验', icon: 'success' })
      this.loadStaffData()
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '仅已通过预约可核验', icon: 'none' })
    }
  },
  async verifyCode() {
    if (!this.data.verificationCode) {
      wx.showToast({ title: '请输入核验码', icon: 'none' })
      return
    }
    wx.showLoading({ title: '核验中' })
    try {
      await api.adminVerifyCheckinCode(this.data.verificationCode, this.staffCredential())
      wx.hideLoading()
      wx.showToast({ title: '核验通过', icon: 'success' })
      this.setData({ verificationCode: '' })
      this.loadStaffData()
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '核验码无效或过期', icon: 'none' })
    }
  },
  async consumeMemberCode() {
    if (!this.data.memberCode) {
      wx.showToast({ title: '请输入会员码', icon: 'none' })
      return
    }
    wx.showLoading({ title: '核销中' })
    try {
      const result = await api.adminConsumeMemberCode(this.data.memberCode, this.staffCredential())
      wx.hideLoading()
      wx.showToast({ title: `已核销，剩余${result.card.remainingUnits || 0}次`, icon: 'success' })
      this.setData({ memberCode: '' })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '会员码无效或过期', icon: 'none' })
    }
  },
  approveRefund(event) {
    this.reviewRefund(event.currentTarget.dataset.id, 'APPROVE')
  },
  rejectRefund(event) {
    this.reviewRefund(event.currentTarget.dataset.id, 'REJECT')
  },
  async reviewRefund(id, action) {
    wx.showLoading({ title: '处理中' })
    try {
      await api.adminReviewRefund(id, action, action === 'APPROVE' ? '员工审核通过，待后续真实退款' : '员工审核拒绝', this.staffCredential())
      wx.hideLoading()
      wx.showToast({ title: action === 'APPROVE' ? '退款已通过' : '退款已拒绝', icon: 'success' })
      this.loadRefunds()
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '退款处理失败', icon: 'none' })
    }
  },
  staffCredential() {
    return this.data.staffToken || this.data.staffPinInput
  }
})

function normalizeReservation(item) {
  return {
    id: item.id,
    slotLabel: SLOT_LABELS[item.slotId] || item.slotId,
    peopleCount: item.peopleCount,
    dogCount: item.petIds ? item.petIds.length : 0,
    status: mapStatus(item.status),
    rawStatus: item.status,
    reviewReason: item.reviewReason || item.cancelReason || item.adminReviewNote || '',
    canReview: item.status === 'PENDING_REVIEW' || item.status === 'RESCHEDULE_REQUESTED',
    canCheckin: item.status === 'CONFIRMED'
  }
}

function mapStatus(status) {
  if (status === 'PENDING_REVIEW') return '待审核'
  if (status === 'RESCHEDULE_REQUESTED') return '改期申请'
  if (status === 'CONFIRMED') return '待到店'
  if (status === 'REJECTED') return '已拒绝'
  if (status === 'CHECKED_IN') return '已核验'
  if (status === 'CANCELED') return '已取消'
  return status
}

function mapStaffRole(role) {
  if (role === 'OWNER') return '老板'
  if (role === 'STAFF') return '员工'
  return role || ''
}

function normalizeRefund(item) {
  return {
    id: item.refund_id,
    sourceId: item.source_id,
    amount: formatPrice(item.calculated_refund_cents),
    status: mapRefundStatus(item.status),
    rawStatus: item.status,
    reason: item.reason || '未填写原因',
    createdAt: formatDateTime(item.created_at),
    reviewNote: item.review_note || '',
    canReview: item.status === 'PENDING_REVIEW'
  }
}

function normalizeStaffOrder(item) {
  const firstItem = item.items && item.items.length ? item.items[0] : {}
  return {
    id: item.id,
    userId: item.userId,
    title: firstItem.name || '会员卡订单',
    amount: formatPrice(item.payableAmountCents),
    status: mapOrderStatus(item.status),
    paidAt: formatDateTime(item.paidAt || item.createdAt)
  }
}

function normalizeStaffCard(item) {
  return {
    id: item.id,
    userId: item.userId,
    title: item.title || mapCardType(item.cardType),
    status: mapCardStatus(item.status),
    balance: item.cardType === 'TEN_PASS' ? `剩余 ${item.remainingUnits || 0}/${item.totalUnits || 0} 次` : '周期卡',
    validUntil: item.validUntil ? item.validUntil.slice(0, 10) : ''
  }
}

function mapOrderStatus(status) {
  if (status === 'PAID') return '已支付'
  if (status === 'REFUND_REQUESTED') return '退款处理中'
  if (status === 'CANCELED') return '已取消'
  return status || '待确认'
}

function mapCardType(cardType) {
  if (cardType === 'TEN_PASS') return '10次卡'
  if (cardType === 'SEASON') return '季卡'
  if (cardType === 'ANNUAL') return '年卡'
  return cardType || '会员卡'
}

function mapCardStatus(status) {
  if (status === 'ACTIVE') return '可用'
  if (status === 'EXPIRED') return '已过期'
  if (status === 'FROZEN') return '已冻结'
  return status || '待确认'
}

function mapRefundStatus(status) {
  if (status === 'PENDING_REVIEW') return '待审核'
  if (status === 'APPROVED') return '已通过'
  if (status === 'REJECTED') return '已拒绝'
  if (status === 'CANCELED') return '已取消'
  return status || '待确认'
}

function formatPrice(cents) {
  return String(Math.round((cents || 0) / 100))
}

function formatDateTime(value) {
  if (!value) return ''
  return value.replace('T', ' ').slice(0, 19)
}
