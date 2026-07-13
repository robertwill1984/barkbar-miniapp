import { getReservationById } from '../../utils/storage'

Page({
  data: {
    reservation: null as any
  },
  onLoad(query: any) {
    const reservation = getReservationById(query.id)
    if (!reservation) {
      wx.showToast({ title: '未找到预约记录', icon: 'none' })
      return
    }
    this.setData({ reservation })
  },
  backHome() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})

