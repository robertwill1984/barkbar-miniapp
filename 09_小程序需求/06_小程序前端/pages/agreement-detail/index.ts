import { entryAgreement } from '../../utils/mock-data'

Page({
  data: {
    agreement: entryAgreement
  },
  goBack() {
    wx.navigateBack({ delta: 1 })
  }
})

