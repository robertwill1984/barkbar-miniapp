const { getReservationById } = require('../../utils/storage')

Page({
  data: {
    reservation: null
  },
  onLoad(query) {
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

