const { getPetProfile, savePetProfile } = require('../../utils/storage')
const api = require('../../utils/api')

Page({
  data: {
    pet: {
      name: '未填写',
      breed: '',
      size: '小型犬',
      firstVisit: true,
      firstSwim: true,
      vaccineStatus: '待上传',
      behaviorNotes: ''
    },
    sizeOptions: ['小型犬', '中型犬', '大型犬'],
    yesNoOptions: ['是', '否']
  },
  onShow() {
    const profile = getPetProfile()
    if (profile) {
      this.setData({ pet: profile })
    }
  },
  onNameInput(event) {
    this.setData({ 'pet.name': event.detail.value })
  },
  onBreedInput(event) {
    this.setData({ 'pet.breed': event.detail.value })
  },
  onBehaviorInput(event) {
    this.setData({ 'pet.behaviorNotes': event.detail.value })
  },
  chooseSize(event) {
    this.setData({ 'pet.size': this.data.sizeOptions[event.detail.value] })
  },
  toggleFirstVisit() {
    this.setData({ 'pet.firstVisit': !this.data.pet.firstVisit })
  },
  toggleFirstSwim() {
    this.setData({ 'pet.firstSwim': !this.data.pet.firstSwim })
  },
  markVaccineUploaded() {
    this.setData({ 'pet.vaccineStatus': '已记录，待员工现场核验' })
  },
  async savePet() {
    if (!this.data.pet.name || this.data.pet.name === '未填写') {
      wx.showToast({ title: '请填写犬只姓名', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中' })
    try {
      const user = await api.ensureCurrentUser()
      const backendPet = await api.createPet(user.id, this.data.pet)
      savePetProfile({
        ...this.data.pet,
        backendId: backendPet.id,
        ownerUserId: user.id
      })
      wx.hideLoading()
      wx.showToast({ title: '已保存档案', icon: 'success' })
    } catch (error) {
      savePetProfile(this.data.pet)
      wx.hideLoading()
      wx.showToast({ title: '已本地保存', icon: 'success' })
    }
  }
})
