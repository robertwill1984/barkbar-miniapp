const { agreementRules, riskHighlights, entryAgreement } = require('../../utils/mock-data')
const { getPetProfile, saveAgreementAcceptance } = require('../../utils/storage')
const api = require('../../utils/api')

Page({
  data: {
    checked: false,
    rules: agreementRules,
    riskHighlights,
    agreement: entryAgreement
  },
  openAgreementDetail() {
    wx.navigateTo({ url: '/pages/agreement-detail/index' })
  },
  toggleChecked() {
    this.setData({ checked: !this.data.checked })
  },
  async confirmAgreement() {
    if (!this.data.checked) {
      wx.showToast({ title: '请先勾选确认', icon: 'none' })
      return
    }
    wx.showLoading({ title: '确认中' })
    try {
      const user = await api.ensureCurrentUser()
      const required = await api.requiredAgreement(user.id)
      const pet = getPetProfile()
      const accepted = await api.acceptAgreement(
        required.agreement_id,
        user.id,
        pet && pet.backendId ? pet.backendId : undefined,
        '我已阅读并同意入园须知及安全协议'
      )
      saveAgreementAcceptance(required.version || entryAgreement.version, {
        ...entryAgreement,
        backendAgreementId: required.agreement_id,
        acceptanceId: accepted.acceptance_id,
        contentHash: accepted.content_hash
      })
      wx.hideLoading()
      wx.showToast({ title: '已确认', icon: 'success' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 600)
    } catch (error) {
      saveAgreementAcceptance(entryAgreement.version, entryAgreement)
      wx.hideLoading()
      wx.showToast({ title: '已本地确认', icon: 'success' })
      setTimeout(() => wx.navigateBack({ delta: 1 }), 600)
    }
  }
})
