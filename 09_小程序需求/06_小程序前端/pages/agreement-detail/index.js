const { entryAgreement } = require('../../utils/mock-data')

Page({
  data: {
    agreement: entryAgreement
  },
  goBack() {
    wx.navigateBack({ delta: 1 })
  }
})

