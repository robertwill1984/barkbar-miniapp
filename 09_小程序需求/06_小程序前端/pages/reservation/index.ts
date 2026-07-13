import { reservationSlots, storeConfig } from '../../utils/mock-data'
import { getAgreementAcceptance, getPetProfile, savePetProfile, saveReservation } from '../../utils/storage'
import { createPet, createReservation, ensureCurrentUser, getReservationSlots } from '../../utils/api'

Page({
  data: {
    selectedDate: '2026-07-10',
    slots: reservationSlots,
    peopleCount: 2,
    dogCount: 1,
    selectedSlotId: 'slot_1000',
    petName: '未填写',
    agreementConfirmed: false,
    estimatedAmount: 68
  },
  onShow() {
    const pet = getPetProfile()
    const agreement = getAgreementAcceptance()
    this.setData({
      petName: pet?.name || '未填写',
      agreementConfirmed: Boolean(agreement)
    })
    this.updateEstimatedAmount()
    this.loadRemoteSlots()
  },
  async loadRemoteSlots() {
    try {
      const slots = await getReservationSlots(this.data.selectedDate)
      this.setData({
        slots: slots.map((slot: any) => ({
          id: slot.id,
          label: slot.label,
          status: slot.status === 'LIMITED' ? '余量紧张' : '可预约',
          remainingPeople: slot.remaining_people,
          remainingDogs: slot.remaining_dogs
        }))
      })
    } catch (error) {
      this.setData({ slots: reservationSlots })
    }
  },
  selectSlot(event: any) {
    this.setData({ selectedSlotId: event.currentTarget.dataset.id })
  },
  increasePeople() {
    this.setData({ peopleCount: this.data.peopleCount + 1 })
    this.updateEstimatedAmount()
  },
  decreasePeople() {
    this.setData({ peopleCount: Math.max(1, this.data.peopleCount - 1) })
    this.updateEstimatedAmount()
  },
  increaseDog() {
    this.setData({ dogCount: this.data.dogCount + 1 })
    this.updateEstimatedAmount()
  },
  decreaseDog() {
    this.setData({ dogCount: Math.max(1, this.data.dogCount - 1) })
    this.updateEstimatedAmount()
  },
  updateEstimatedAmount() {
    const extraPeople = Math.max(0, this.data.peopleCount - 2)
    const extraDogs = Math.max(0, this.data.dogCount - 1)
    const estimatedAmount = storeConfig.singleTicketPrice
      + extraPeople * storeConfig.extraPersonPrice
      + extraDogs * storeConfig.extraDogPrice
    this.setData({ estimatedAmount })
  },
  continueAgreement() {
    wx.navigateTo({ url: '/pages/agreement/index?from=reservation' })
  },
  goPetProfile() {
    wx.navigateTo({ url: '/pages/pet-profile/index' })
  },
  async submitReservation() {
    let pet = getPetProfile()
    if (!pet) {
      wx.showToast({ title: '请先填写宠物档案', icon: 'none' })
      return
    }
    if (!getAgreementAcceptance()) {
      wx.showToast({ title: '请先确认入园须知', icon: 'none' })
      return
    }
    const slot = this.data.slots.find((item: any) => item.id === this.data.selectedSlotId) || this.data.slots[0]
    const requiresReview = pet.firstVisit || pet.firstSwim || Boolean(pet.behaviorNotes)
    wx.showLoading({ title: '提交中' })
    try {
      const user = await ensureCurrentUser()
      if (!pet.backendId) {
        const backendPet = await createPet(user.id, pet)
        pet = {
          ...pet,
          backendId: backendPet.id,
          ownerUserId: user.id
        }
        savePetProfile(pet)
      }
      const remoteReservation = await createReservation(user.id, slot.id, this.data.peopleCount, [pet.backendId], 'SINGLE_TICKET')
      const id = remoteReservation.id || `r_${Date.now()}`
      saveReservation({
        id,
        backendId: remoteReservation.id,
        slotId: slot.id,
        slotLabel: slot.label,
        peopleCount: this.data.peopleCount,
        dogCount: this.data.dogCount,
        petName: pet.name,
        status: remoteReservation.status === 'PENDING_REVIEW' ? '需人工审核' : '待到店',
        totalAmount: Math.round((remoteReservation.estimatedAmountFen || this.data.estimatedAmount * 100) / 100),
        createdAt: remoteReservation.createdAt || new Date().toISOString()
      })
      wx.hideLoading()
      wx.navigateTo({ url: `/pages/reservation-success/index?id=${id}` })
    } catch (error) {
      const id = `r_${Date.now()}`
      saveReservation({
        id,
        slotId: slot.id,
        slotLabel: slot.label,
        peopleCount: this.data.peopleCount,
        dogCount: this.data.dogCount,
        petName: pet.name,
        status: requiresReview ? '需人工审核' : '待到店',
        totalAmount: this.data.estimatedAmount,
        createdAt: new Date().toISOString()
      })
      wx.hideLoading()
      wx.navigateTo({ url: `/pages/reservation-success/index?id=${id}` })
    }
  }
})
