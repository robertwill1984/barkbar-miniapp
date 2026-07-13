import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { StaffAuthService } from '../../common/staff-auth.service'
import { InMemoryStore, ReservationRecord, sha256 } from '../../common/store.service'
import { AgreementsService } from '../agreements/agreements.service'

const SINGLE_TICKET_FEN = 6800
const EXTRA_PERSON_FEN = 2000
const EXTRA_DOG_FEN = 5000
const CHECKIN_CODE_TTL_SECONDS = 60

@Injectable()
export class ReservationsService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly agreementsService: AgreementsService,
    private readonly staffAuth: StaffAuthService
  ) {}

  slots() {
    return [
      { id: 'slot_1000', label: '10:00-12:00', status: 'AVAILABLE', remaining_people: 12, remaining_dogs: 8 },
      { id: 'slot_1400', label: '14:00-16:00', status: 'AVAILABLE', remaining_people: 10, remaining_dogs: 7 },
      { id: 'slot_1700', label: '17:00-19:30', status: 'LIMITED', remaining_people: 4, remaining_dogs: 3 }
    ]
  }

  list(userId: string) {
    if (!userId) throw new BadRequestException('user_id is required')
    return [...this.store.reservations.values()]
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  adminList(status?: ReservationRecord['status'], auth?: { staff_pin?: string; staff_token?: string }) {
    this.assertStaff(auth, 'reservation:review')
    return [...this.store.reservations.values()]
      .filter((item) => !status || item.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  assertStaff(auth?: { staff_pin?: string; staff_token?: string }, permission?: 'reservation:review' | 'reservation:checkin') {
    this.staffAuth.assertStaff({ ...(auth || {}), permission })
  }

  create(input: {
    user_id: string
    slot_id: string
    people_count: number
    pet_ids: string[]
    entry_type: 'SINGLE_TICKET' | 'MEMBER_CARD'
  }) {
    if (!this.store.users.has(input.user_id)) throw new NotFoundException('user not found')
    if (!input.pet_ids.length) throw new BadRequestException('at least one pet is required')
    if (!this.agreementsService.hasAcceptedCurrent(input.user_id)) {
      throw new BadRequestException('current entry agreement must be accepted before reservation')
    }

    const pets = input.pet_ids.map((id) => {
      const pet = this.store.pets.get(id)
      if (!pet) throw new NotFoundException(`pet not found: ${id}`)
      if (pet.ownerUserId !== input.user_id) throw new BadRequestException(`pet does not belong to user: ${id}`)
      return pet
    })

    const needsReview = pets.some((pet) => pet.riskReviewRequired || pet.riskReviewStatus !== 'APPROVED')
    const extraPeople = Math.max(0, input.people_count - 2)
    const extraDogs = Math.max(0, input.pet_ids.length - 1)
    const estimatedAmountFen =
      input.entry_type === 'SINGLE_TICKET'
        ? SINGLE_TICKET_FEN + extraPeople * EXTRA_PERSON_FEN + extraDogs * EXTRA_DOG_FEN
        : extraPeople * EXTRA_PERSON_FEN + extraDogs * EXTRA_DOG_FEN

    const reservation: ReservationRecord = {
      id: this.store.id('resv'),
      userId: input.user_id,
      slotId: input.slot_id,
      peopleCount: input.people_count,
      petIds: input.pet_ids,
      entryType: input.entry_type,
      status: needsReview ? 'PENDING_REVIEW' : 'CONFIRMED',
      estimatedAmountFen,
      reviewReason: needsReview ? '宠物资料、疫苗、犬证或行为风险需要人工复核' : undefined,
      createdAt: this.store.now()
    }
    this.store.reservations.set(reservation.id, reservation)
    return reservation
  }

  cancel(
    reservationId: string,
    input: {
      user_id: string
      reason: string
      request_reschedule?: boolean
    }
  ) {
    if (!input.user_id) throw new BadRequestException('user_id is required')
    if (!input.reason) throw new BadRequestException('reason is required')

    const reservation = this.store.reservations.get(reservationId)
    if (!reservation) throw new NotFoundException('reservation not found')
    if (reservation.userId !== input.user_id) throw new BadRequestException('reservation does not belong to user')
    if (reservation.status === 'CANCELED' || reservation.status === 'RESCHEDULE_REQUESTED') {
      return reservation
    }

    const updated: ReservationRecord = {
      ...reservation,
      status: input.request_reschedule ? 'RESCHEDULE_REQUESTED' : 'CANCELED',
      cancelReason: input.reason,
      rescheduleRequested: Boolean(input.request_reschedule),
      canceledAt: this.store.now()
    }
    this.store.reservations.set(updated.id, updated)
    return updated
  }

  generateCheckinCode(
    reservationId: string,
    input: {
      user_id: string
    }
  ) {
    if (!input.user_id) throw new BadRequestException('user_id is required')
    const reservation = this.store.reservations.get(reservationId)
    if (!reservation) throw new NotFoundException('reservation not found')
    if (reservation.userId !== input.user_id) throw new BadRequestException('reservation does not belong to user')
    if (reservation.status !== 'CONFIRMED') throw new BadRequestException('only confirmed reservation can generate checkin code')

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAtDate = new Date(Date.now() + CHECKIN_CODE_TTL_SECONDS * 1000)
    const expiresAt = expiresAtDate.toISOString()
    const updated: ReservationRecord = {
      ...reservation,
      checkinCodeHash: sha256(`${reservation.id}:${code}:${expiresAt}`),
      checkinCodeExpiresAt: expiresAt
    }
    this.store.reservations.set(updated.id, updated)

    return {
      reservation_id: reservation.id,
      code,
      expires_in_seconds: CHECKIN_CODE_TTL_SECONDS,
      expires_at: expiresAt
    }
  }

  review(
    reservationId: string,
    input: {
      action: 'APPROVE' | 'REJECT'
      staff_pin?: string
      staff_token?: string
      note?: string
    }
  ) {
    this.assertStaff(input, 'reservation:review')
    const reservation = this.store.reservations.get(reservationId)
    if (!reservation) throw new NotFoundException('reservation not found')
    if (reservation.status === 'CANCELED' || reservation.status === 'CHECKED_IN') {
      throw new BadRequestException('reservation cannot be reviewed in current status')
    }
    const updated: ReservationRecord = {
      ...reservation,
      status: input.action === 'APPROVE' ? 'CONFIRMED' : 'REJECTED',
      adminReviewNote: input.note || (input.action === 'APPROVE' ? '员工审核通过' : '员工审核拒绝'),
      reviewedAt: this.store.now()
    }
    this.store.reservations.set(updated.id, updated)
    return updated
  }

  checkin(
    reservationId: string,
    input: {
      staff_pin?: string
      staff_token?: string
      note?: string
    }
  ) {
    this.assertStaff(input, 'reservation:checkin')
    const reservation = this.store.reservations.get(reservationId)
    if (!reservation) throw new NotFoundException('reservation not found')
    if (reservation.status !== 'CONFIRMED') {
      throw new BadRequestException('only confirmed reservation can be checked in')
    }
    const updated: ReservationRecord = {
      ...reservation,
      status: 'CHECKED_IN',
      adminReviewNote: input.note || reservation.adminReviewNote,
      checkedInAt: this.store.now()
    }
    this.store.reservations.set(updated.id, updated)
    return updated
  }

  verifyCheckinCode(input: { staff_pin?: string; staff_token?: string; code: string; note?: string }) {
    this.assertStaff(input, 'reservation:checkin')
    if (!input.code) throw new BadRequestException('code is required')
    const now = Date.now()
    const reservation = [...this.store.reservations.values()].find((item) => {
      if (!item.checkinCodeHash || !item.checkinCodeExpiresAt) return false
      if (new Date(item.checkinCodeExpiresAt).getTime() < now) return false
      return sha256(`${item.id}:${input.code}:${item.checkinCodeExpiresAt}`) === item.checkinCodeHash
    })
    if (!reservation) throw new BadRequestException('invalid or expired checkin code')
    if (reservation.status !== 'CONFIRMED') throw new BadRequestException('only confirmed reservation can be checked in')

    const updated: ReservationRecord = {
      ...reservation,
      status: 'CHECKED_IN',
      adminReviewNote: input.note || reservation.adminReviewNote || '员工动态码核验通过',
      checkedInAt: this.store.now(),
      checkinCodeHash: undefined,
      checkinCodeExpiresAt: undefined
    }
    this.store.reservations.set(updated.id, updated)
    return updated
  }
}
