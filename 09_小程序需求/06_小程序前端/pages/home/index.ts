Page({
  data: {
    businessHours: '10:00-20:00',
    latestAdmission: '19:30',
    highlights: [
      { title: '下水撒欢', subtitle: '宠物专属泳池', icon: 'water' },
      { title: '草坪交友', subtitle: '自由奔跑，认识新朋友', icon: 'grass' },
      { title: '主人小酌', subtitle: '咖啡、饮品与小酒', icon: 'drink' }
    ],
    notices: [
      '狗狗需完成有效疫苗接种',
      '首次游泳及不熟水犬只须穿救生衣',
      '入园前请阅读完整须知'
    ]
  },
  goReservation() {
    wx.switchTab({ url: '/pages/reservation/index' })
  },
  goMember() {
    wx.navigateTo({ url: '/pages/member/index' })
  },
  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/index' })
  }
})
