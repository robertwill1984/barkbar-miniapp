import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InMemoryStore, PetRecord } from '../../common/store.service'

@Injectable()
export class PetsService {
  constructor(private readonly store: InMemoryStore) {}

  list(userId: string) {
    if (!userId) throw new BadRequestException('user_id is required')
    return [...this.store.pets.values()].filter((pet) => pet.ownerUserId === userId)
  }

  create(input: {
    user_id: string
    name: string
    breed: string
    size_class?: string
    weight_kg?: number
    vaccination_status?: 'UNKNOWN' | 'VALID' | 'EXPIRED'
    license_status?: 'UNKNOWN' | 'VALID' | 'MISSING'
    attack_history?: boolean
  }) {
    if (!this.store.users.has(input.user_id)) throw new NotFoundException('user not found')

    const riskReviewRequired = Boolean(input.attack_history || input.vaccination_status !== 'VALID' || input.license_status !== 'VALID')
    const pet: PetRecord = {
      id: this.store.id('pet'),
      ownerUserId: input.user_id,
      name: input.name,
      breed: input.breed,
      sizeClass: input.size_class,
      weightKg: input.weight_kg,
      vaccinationStatus: input.vaccination_status || 'UNKNOWN',
      licenseStatus: input.license_status || 'UNKNOWN',
      attackHistory: Boolean(input.attack_history),
      riskReviewRequired,
      riskReviewStatus: riskReviewRequired ? 'PENDING' : 'APPROVED',
      createdAt: this.store.now()
    }
    this.store.pets.set(pet.id, pet)
    return pet
  }
}
