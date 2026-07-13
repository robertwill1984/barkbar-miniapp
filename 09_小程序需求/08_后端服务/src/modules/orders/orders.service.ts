import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { StaffAuthService } from '../../common/staff-auth.service'
import { InMemoryStore, MemberCardRecord, OrderRecord, PaymentRecord, CashLedgerRecord } from '../../common/store.service'

type Product = {
  product_id: string
  sku_id: string
  scene: 'ticket' | 'card' | 'bar' | 'retail'
  name: string
  price_cents: number
  stock_available: number
  card_type?: MemberCardRecord['cardType']
  total_units?: number
  valid_days?: number
}

const PRODUCTS: Product[] = [
  {
    product_id: 'prod_card_ten_pass',
    sku_id: 'sku_card_ten_pass',
    scene: 'card',
    name: '10次卡',
    price_cents: 58000,
    stock_available: 999,
    card_type: 'TEN_PASS',
    total_units: 10,
    valid_days: 90
  },
  {
    product_id: 'prod_card_season',
    sku_id: 'sku_card_season',
    scene: 'card',
    name: '季卡',
    price_cents: 79800,
    stock_available: 999,
    card_type: 'SEASON',
    valid_days: 90
  },
  {
    product_id: 'prod_card_annual',
    sku_id: 'sku_card_annual',
    scene: 'card',
    name: '年卡',
    price_cents: 238000,
    stock_available: 999,
    card_type: 'ANNUAL',
    valid_days: 365
  }
]

@Injectable()
export class OrdersService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly staffAuth: StaffAuthService
  ) {}

  products(scene?: Product['scene']) {
    return PRODUCTS.filter((item) => !scene || item.scene === scene)
  }

  list(userId: string, scene?: Product['scene']) {
    if (!userId) throw new BadRequestException('user_id is required')
    const normalizedScene = scene ? (scene.toUpperCase() as OrderRecord['scene']) : undefined
    return this.store.orders
      .all()
      .filter((item) => item.userId === userId)
      .filter((item) => !normalizedScene || item.scene === normalizedScene)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  paymentStatus(orderId: string, userId: string) {
    if (!userId) throw new BadRequestException('user_id is required')
    const order = this.store.orders.get(orderId)
    if (!order) throw new NotFoundException('order not found')
    if (order.userId !== userId) throw new BadRequestException('order does not belong to user')

    const payment = this.store.payments
      .all()
      .filter((item) => item.orderId === orderId && item.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

    if (!payment) {
      return {
        order_id: order.id,
        payment_status: 'PENDING',
        order_status: order.status,
        amount_cents: order.payableAmountCents,
        channel: 'LOCAL_MOCK',
        warning: '本地订单尚未找到支付记录；正式微信支付接入后应继续轮询或等待支付回调。'
      }
    }

    return {
      order_id: order.id,
      payment_id: payment.id,
      payment_status: payment.status,
      order_status: order.status,
      amount_cents: payment.amountCents,
      channel: payment.channel,
      paid_at: payment.paidAt,
      created_at: payment.createdAt,
      warning: payment.channel === 'LOCAL_MOCK' ? '本地模拟支付成功，未发生真实扣款。' : undefined
    }
  }

  adminList(input: { staff_pin?: string; staff_token?: string; user_id?: string; scene?: Product['scene']; status?: OrderRecord['status'] }) {
    this.assertStaff(input)
    const normalizedScene = input.scene ? (input.scene.toUpperCase() as OrderRecord['scene']) : undefined
    return this.store.orders
      .all()
      .filter((item) => !input.user_id || item.userId === input.user_id)
      .filter((item) => !normalizedScene || item.scene === normalizedScene)
      .filter((item) => !input.status || item.status === input.status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  create(input: {
    user_id: string
    scene: 'ticket' | 'card' | 'bar' | 'retail'
    items: Array<{ sku_id: string; quantity: number }>
    reservation_id?: string
  }) {
    if (!this.store.users.has(input.user_id)) throw new NotFoundException('user not found')
    if (!input.items || !input.items.length) throw new BadRequestException('at least one item is required')
    if (input.scene === 'card' && (input.items.length !== 1 || input.items[0].quantity !== 1)) {
      throw new BadRequestException('member card order supports one card per order in local MVP')
    }

    const orderItems = input.items.map((item) => {
      const product = PRODUCTS.find((candidate) => candidate.sku_id === item.sku_id)
      if (!product) throw new NotFoundException(`sku not found: ${item.sku_id}`)
      if (product.scene !== input.scene) throw new BadRequestException('sku does not match scene')
      if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new BadRequestException('quantity must be positive integer')
      return {
        product,
        skuId: product.sku_id,
        name: product.name,
        quantity: item.quantity,
        unitPriceCents: product.price_cents,
        subtotalCents: product.price_cents * item.quantity
      }
    })

    const payableAmountCents = orderItems.reduce((sum, item) => sum + item.subtotalCents, 0)
    const now = this.store.now()
    const order: OrderRecord = {
      id: this.store.id('ord'),
      userId: input.user_id,
      scene: input.scene.toUpperCase() as OrderRecord['scene'],
      items: orderItems.map(({ product, ...item }) => item),
      payableAmountCents,
      status: 'PAID',
      createdAt: now,
      paidAt: now
    }

    const cardProduct = input.scene === 'card' && orderItems.length === 1 && orderItems[0].quantity === 1 ? orderItems[0].product : undefined
    if (cardProduct?.card_type) {
      const card = this.issueMemberCard(input.user_id, cardProduct, now)
      order.relatedCardId = card.id
    }

    const payment: PaymentRecord = {
      id: this.store.id('pay'),
      orderId: order.id,
      userId: input.user_id,
      amountCents: payableAmountCents,
      channel: 'LOCAL_MOCK',
      status: 'SUCCESS',
      paidAt: now,
      createdAt: now
    }
    const cashLedger: CashLedgerRecord = {
      id: this.store.id('cash'),
      sourceType: 'ORDER_PAYMENT',
      sourceId: payment.id,
      direction: 'IN',
      amountCents: payableAmountCents,
      note: '本地模拟支付入账',
      occurredAt: now,
      createdAt: now
    }

    this.store.orders.set(order.id, order)
    this.store.payments.set(payment.id, payment)
    this.store.cashLedger.set(cashLedger.id, cashLedger)

    return {
      order_id: order.id,
      status: order.status,
      payable_amount_cents: payableAmountCents,
      payment_params: {
        channel: 'LOCAL_MOCK',
        paid: true,
        message: '本地开发模拟支付成功，未发生真实扣款。'
      },
      related_card_id: order.relatedCardId,
      order,
      payment
    }
  }

  private issueMemberCard(userId: string, product: Product, now: string) {
    if (!product.card_type || !product.valid_days) throw new BadRequestException('product is not a member card')
    const validUntil = new Date(Date.now() + product.valid_days * 24 * 60 * 60 * 1000).toISOString()
    const card: MemberCardRecord = {
      id: this.store.id('card'),
      userId,
      cardType: product.card_type,
      title: product.name,
      status: 'ACTIVE',
      totalUnits: product.total_units,
      remainingUnits: product.total_units,
      validFrom: now,
      validUntil,
      createdAt: now
    }
    this.store.memberCards.set(card.id, card)
    return card
  }

  private assertStaff(input: { staff_pin?: string; staff_token?: string }) {
    this.staffAuth.assertStaff({ ...input, permission: 'order:read' })
  }
}
