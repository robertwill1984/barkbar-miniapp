import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { StaffAuthService } from '../../common/staff-auth.service'
import { InMemoryStore, RefundRecord } from '../../common/store.service'

type RefundSourceType = 'order'

@Injectable()
export class RefundsService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly staffAuth: StaffAuthService
  ) {}

  list(userId: string, sourceId?: string) {
    if (!userId) throw new BadRequestException('user_id is required')
    return this.store.refunds
      .all()
      .filter((item) => item.userId === userId)
      .filter((item) => !sourceId || item.sourceId === sourceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => this.toResponse(item))
  }

  status(refundId: string, userId: string) {
    if (!userId) throw new BadRequestException('user_id is required')
    const refund = this.store.refunds.get(refundId)
    if (!refund) throw new NotFoundException('refund not found')
    if (refund.userId !== userId) throw new BadRequestException('refund does not belong to user')

    const order = this.store.orders.get(refund.sourceId)
    return {
      ...this.toResponse(refund),
      source_order_status: order?.status || ''
    }
  }

  create(input: {
    user_id: string
    source_type: RefundSourceType
    source_id: string
    reason: string
    evidence_file_ids?: string[]
  }) {
    if (!input.user_id) throw new BadRequestException('user_id is required')
    if (!input.source_id) throw new BadRequestException('source_id is required')
    if (!input.reason || input.reason.trim().length < 2) throw new BadRequestException('reason is required')
    if (input.source_type !== 'order') throw new BadRequestException('local MVP only supports order refunds')

    const order = this.store.orders.get(input.source_id)
    if (!order) throw new NotFoundException('order not found')
    if (order.userId !== input.user_id) throw new BadRequestException('order does not belong to user')
    if (order.status === 'CANCELED') throw new BadRequestException('canceled order cannot request refund')

    const existing = this.store.refunds
      .all()
      .find(
        (item) =>
          item.userId === input.user_id &&
          item.sourceType === 'ORDER' &&
          item.sourceId === input.source_id &&
          ['PENDING_REVIEW', 'APPROVED'].includes(item.status)
      )
    if (existing) return this.toResponse(existing)

    const now = this.store.now()
    const refund: RefundRecord = {
      id: this.store.id('ref'),
      userId: input.user_id,
      sourceType: 'ORDER',
      sourceId: input.source_id,
      status: 'PENDING_REVIEW',
      reason: input.reason.trim(),
      calculatedRefundCents: order.payableAmountCents,
      components: [
        {
          name: '本地模拟订单支付金额',
          amountCents: order.payableAmountCents
        }
      ],
      evidenceFileIds: input.evidence_file_ids || [],
      createdAt: now
    }

    order.status = 'REFUND_REQUESTED'
    this.store.orders.set(order.id, order)
    this.store.refunds.set(refund.id, refund)

    return this.toResponse(refund)
  }

  adminList(status?: RefundRecord['status'], auth?: { staff_pin?: string; staff_token?: string }) {
    this.assertStaff(auth)
    return this.store.refunds
      .all()
      .filter((item) => !status || item.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => this.toResponse(item))
  }

  review(
    refundId: string,
    input: {
      action: 'APPROVE' | 'REJECT'
      staff_pin?: string
      staff_token?: string
      note?: string
    }
  ) {
    this.assertStaff(input)
    const refund = this.store.refunds.get(refundId)
    if (!refund) throw new NotFoundException('refund not found')
    if (refund.status !== 'PENDING_REVIEW') throw new BadRequestException('refund cannot be reviewed in current status')

    const updated: RefundRecord = {
      ...refund,
      status: input.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      reviewedAt: this.store.now(),
      reviewNote: input.note || (input.action === 'APPROVE' ? '员工审核通过，待线下/微信退款处理' : '员工审核拒绝')
    }
    this.store.refunds.set(updated.id, updated)
    return this.toResponse(updated)
  }

  private assertStaff(auth?: { staff_pin?: string; staff_token?: string }) {
    this.staffAuth.assertStaff({ ...(auth || {}), permission: 'refund:review' })
  }

  private toResponse(refund: RefundRecord) {
    return {
      refund_id: refund.id,
      user_id: refund.userId,
      source_type: refund.sourceType,
      source_id: refund.sourceId,
      status: refund.status,
      reason: refund.reason,
      calculated_refund_cents: refund.calculatedRefundCents,
      components: refund.components.map((item) => ({
        name: item.name,
        amount_cents: item.amountCents
      })),
      evidence_file_ids: refund.evidenceFileIds,
      created_at: refund.createdAt,
      reviewed_at: refund.reviewedAt,
      review_note: refund.reviewNote
    }
  }
}
