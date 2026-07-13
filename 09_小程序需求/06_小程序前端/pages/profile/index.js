const api = require('../../utils/api')
const { getReservations, getStaffSession, saveReservation, updateReservation } = require('../../utils/storage')

const SLOT_LABELS = {
  slot_1000: '10:00-12:00',
  slot_1400: '14:00-16:00',
  slot_1700: '17:00-19:30'
}

Page({
  data: {
    userName: '微信用户',
    isStaff: false,
    isOwner: false,
    reservations: [],
    checkinCode: null,
    quickLinks: [
      { title: '我的预约', desc: '查看预约、取消或改期' },
      { title: '宠物档案', desc: '维护犬只、疫苗和健康信息' },
      { title: '优惠券', desc: '查看可用券和老带新奖励' }
    ]
  },
  onShow() {
    const staffSession = getStaffSession()
    this.setData({
      isStaff: Boolean(staffSession && staffSession.staff),
      isOwner: Boolean(staffSession && staffSession.staff && staffSession.staff.role === 'OWNER')
    })
    this.loadReservations()
  },
  async loadReservations() {
    const localReservations = getReservations()
    this.setData({ reservations: localReservations })
    try {
      const user = await api.ensureCurrentUser()
      const remoteReservations = await api.listReservations(user.id)
      remoteReservations.forEach((item) => {
        saveReservation(this.normalizeRemoteReservation(item))
      })
      this.setData({ reservations: getReservations() })
    } catch (error) {
      this.setData({ reservations: localReservations })
    }
  },
  normalizeRemoteReservation(item) {
    return {
      id: item.id,
      backendId: item.id,
      slotId: item.slotId,
      slotLabel: SLOT_LABELS[item.slotId] || item.slotId,
      peopleCount: item.peopleCount,
      dogCount: item.petIds ? item.petIds.length : 1,
      petName: '已登记犬只',
      status: mapReservationStatus(item.status),
      totalAmount: Math.round((item.estimatedAmountFen || 0) / 100),
      cancelReason: item.cancelReason,
      canceledAt: item.canceledAt,
      createdAt: item.createdAt
    }
  },
  goMember() {
    wx.navigateTo({ url: '/pages/member/index' })
  },
  goPetProfile() {
    wx.navigateTo({ url: '/pages/pet-profile/index' })
  },
  goStaffCheckin() {
    wx.navigateTo({ url: '/pages/staff-checkin/index' })
  },
  goOwnerFinance() {
    wx.navigateTo({ url: '/pages/owner-finance/index' })
  },
  cancelReservation(event) {
    const id = event.currentTarget.dataset.id
    this.changeReservationStatus(id, false)
  },
  requestReschedule(event) {
    const id = event.currentTarget.dataset.id
    this.changeReservationStatus(id, true)
  },
  async generateCheckinCode(event) {
    const id = event.currentTarget.dataset.id
    wx.showLoading({ title: '生成中' })
    try {
      const user = await api.ensureCurrentUser()
      const code = await api.generateReservationCheckinCode(id, user.id)
      wx.hideLoading()
      this.setData({ checkinCode: code })
      wx.showToast({ title: '已生成核验码', icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '仅已确认预约可生成', icon: 'none' })
    }
  },
  changeReservationStatus(id, requestReschedule) {
    const actionText = requestReschedule ? '申请改期' : '取消预约'
    wx.showModal({
      title: actionText,
      content: requestReschedule ? '提交后需等待门店确认新的到店时段。' : '取消后如已付款，退款规则以后续支付接入后的规则为准。',
      confirmText: actionText,
      success: async (result) => {
        if (!result.confirm) return
        wx.showLoading({ title: '提交中' })
        const localPatch = {
          status: requestReschedule ? '改期申请中' : '已取消',
          cancelReason: requestReschedule ? '用户申请改期' : '用户主动取消',
          canceledAt: new Date().toISOString()
        }
        try {
          const user = await api.ensureCurrentUser()
          const remote = await api.cancelReservation(id, user.id, localPatch.cancelReason, requestReschedule)
          updateReservation(id, {
            ...localPatch,
            status: mapReservationStatus(remote.status),
            cancelReason: remote.cancelReason || localPatch.cancelReason,
            canceledAt: remote.canceledAt || localPatch.canceledAt
          })
        } catch (error) {
          updateReservation(id, localPatch)
        }
        wx.hideLoading()
        this.setData({ reservations: getReservations() })
        wx.showToast({ title: requestReschedule ? '已申请改期' : '已取消', icon: 'success' })
      }
    })
  }
})

function mapReservationStatus(status) {
  if (status === 'PENDING_REVIEW') return '需人工审核'
  if (status === 'CANCELED') return '已取消'
  if (status === 'RESCHEDULE_REQUESTED') return '改期申请中'
  if (status === 'REJECTED') return '已拒绝'
  if (status === 'CHECKED_IN') return '已核验'
  return '待到店'
}
