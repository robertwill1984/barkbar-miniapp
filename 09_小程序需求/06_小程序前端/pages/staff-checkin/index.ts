import { adminCheckinReservation, adminConsumeMemberCode, adminListReservations, adminReviewReservation, adminVerifyCheckinCode } from '../../utils/api'
import { getStaffPin, saveStaffPin } from '../../utils/storage'

const SLOT_LABELS: Record<string, string> = {
  slot_1000: '10:00-12:00',
  slot_1400: '14:00-16:00',
  slot_1700: '17:00-19:30'
}

Page({
  data: {
    loading: false,
    staffPinInput: '',
    staffUnlocked: false,
    verificationCode: '',
    memberCode: '',
    reservations: [],
    checks: [
      { title: '协议确认', value: '已确认当前版本' },
      { title: '疫苗/健康', value: '待现场核验' },
      { title: '风险审核', value: '无公开红色标签，仅内部判断' },
      { title: '宠物救生衣', value: '首次游泳/小型犬必须穿戴' }
    ]
  },
  onShow() {
    const staffPin = getStaffPin()
    this.setData({
      staffPinInput: staffPin,
      staffUnlocked: Boolean(staffPin)
    })
    if (staffPin) this.loadReservations()
  },
  onStaffPinInput(event: any) {
    this.setData({ staffPinInput: event.detail.value })
  },
  unlockStaff() {
    if (!this.data.staffPinInput) {
      wx.showToast({ title: '请输入员工 PIN', icon: 'none' })
      return
    }
    saveStaffPin(this.data.staffPinInput)
    this.setData({ staffUnlocked: true })
    this.loadReservations()
  },
  onVerificationCodeInput(event: any) {
    this.setData({ verificationCode: event.detail.value })
  },
  onMemberCodeInput(event: any) {
    this.setData({ memberCode: event.detail.value })
  },
  async loadReservations() {
    if (!this.data.staffUnlocked) return
    this.setData({ loading: true })
    try {
      const reservations = await adminListReservations(undefined, this.data.staffPinInput)
      this.setData({
        reservations: reservations.map(normalizeReservation),
        loading: false
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: '员工 PIN 或后端异常', icon: 'none' })
    }
  },
  approveReservation(event: any) {
    this.reviewReservation(event.currentTarget.dataset.id, 'APPROVE')
  },
  rejectReservation(event: any) {
    this.reviewReservation(event.currentTarget.dataset.id, 'REJECT')
  },
  async reviewReservation(id: string, action: 'APPROVE' | 'REJECT') {
    wx.showLoading({ title: '处理中' })
    try {
      await adminReviewReservation(id, action, action === 'APPROVE' ? '员工审核通过' : '员工审核拒绝', this.data.staffPinInput)
      wx.hideLoading()
      wx.showToast({ title: action === 'APPROVE' ? '已通过' : '已拒绝', icon: 'success' })
      this.loadReservations()
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '处理失败', icon: 'none' })
    }
  },
  async checkinReservation(event: any) {
    const id = event.currentTarget.dataset.id
    wx.showLoading({ title: '核验中' })
    try {
      await adminCheckinReservation(id, '员工到店核验通过', this.data.staffPinInput)
      wx.hideLoading()
      wx.showToast({ title: '已核验', icon: 'success' })
      this.loadReservations()
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
      await adminVerifyCheckinCode(this.data.verificationCode, this.data.staffPinInput)
      wx.hideLoading()
      wx.showToast({ title: '核验通过', icon: 'success' })
      this.setData({ verificationCode: '' })
      this.loadReservations()
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
      const result = await adminConsumeMemberCode(this.data.memberCode, this.data.staffPinInput)
      wx.hideLoading()
      wx.showToast({ title: `已核销，剩余${result.card.remainingUnits || 0}次`, icon: 'success' })
      this.setData({ memberCode: '' })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '会员码无效或过期', icon: 'none' })
    }
  }
})

function normalizeReservation(item: any) {
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

function mapStatus(status: string) {
  if (status === 'PENDING_REVIEW') return '待审核'
  if (status === 'RESCHEDULE_REQUESTED') return '改期申请'
  if (status === 'CONFIRMED') return '待到店'
  if (status === 'REJECTED') return '已拒绝'
  if (status === 'CHECKED_IN') return '已核验'
  if (status === 'CANCELED') return '已取消'
  return status
}
