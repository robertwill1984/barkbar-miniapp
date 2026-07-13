import { agreementRules, riskHighlights, entryAgreement } from '../../utils/mock-data'
import { getPetProfile, saveAgreementAcceptance } from '../../utils/storage'
import { acceptAgreement, ensureCurrentUser, requiredAgreement } from '../../utils/api'

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
      const user = await ensureCurrentUser()
      const required = await requiredAgreement(user.id)
      const pet = getPetProfile()
      const accepted = await acceptAgreement(
        required.agreement_id,
        user.id,
        pet?.backendId,
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
