import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { AgreementAcceptanceRecord, InMemoryStore, sha256 } from '../../common/store.service'

@Injectable()
export class AgreementsService {
  constructor(private readonly store: InMemoryStore) {}

  currentEntryAgreement() {
    const agreement = [...this.store.agreements.values()].find(
      (item) => item.agreementType === 'ENTRY_SAFETY' && item.status === 'PUBLISHED'
    )
    if (!agreement) throw new NotFoundException('entry agreement not published')
    return agreement
  }

  required(userId: string) {
    if (!userId) throw new BadRequestException('user_id is required')
    const agreement = this.currentEntryAgreement()
    const accepted = [...this.store.acceptances.values()].some(
      (item) => item.userId === userId && item.agreementId === agreement.id && item.contentHash === agreement.contentHash
    )

    return {
      agreement_id: agreement.id,
      title: agreement.title,
      version: agreement.version,
      content_hash: agreement.contentHash,
      must_accept_before_reservation: !accepted,
      accepted
    }
  }

  accept(
    agreementId: string,
    input: {
      user_id: string
      pet_id?: string
      checkbox_text: string
      user_agent?: string
    }
  ) {
    const agreement = this.store.agreements.get(agreementId)
    if (!agreement) throw new NotFoundException('agreement not found')
    if (!this.store.users.has(input.user_id)) throw new NotFoundException('user not found')
    if (input.pet_id && !this.store.pets.has(input.pet_id)) throw new NotFoundException('pet not found')

    const acceptedAt = this.store.now()
    const evidencePayload = JSON.stringify({
      agreementId,
      userId: input.user_id,
      petId: input.pet_id || null,
      acceptedAt,
      contentHash: agreement.contentHash,
      checkboxText: input.checkbox_text,
      userAgent: input.user_agent || null
    })

    const record: AgreementAcceptanceRecord = {
      id: this.store.id('agracc'),
      agreementId,
      userId: input.user_id,
      petId: input.pet_id,
      acceptedAt,
      contentHash: agreement.contentHash,
      evidenceHash: sha256(evidencePayload),
      checkboxText: input.checkbox_text
    }
    this.store.acceptances.set(record.id, record)

    return {
      acceptance_id: record.id,
      agreement_id: agreementId,
      version: agreement.version,
      accepted_at: acceptedAt,
      content_hash: agreement.contentHash,
      evidence_hash: record.evidenceHash
    }
  }

  hasAcceptedCurrent(userId: string) {
    const agreement = this.currentEntryAgreement()
    return [...this.store.acceptances.values()].some(
      (item) => item.userId === userId && item.agreementId === agreement.id && item.contentHash === agreement.contentHash
    )
  }
}
