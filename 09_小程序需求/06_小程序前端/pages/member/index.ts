import { memberCards } from '../../utils/mock-data'
import { createOrder, createRefund, ensureCurrentUser, generateMemberRedemptionCode, getOrderPaymentStatus, getRefundStatus, listMemberCards, listOrders, listProducts, listRefunds } from '../../utils/api'

Page({
  data: {
    cards: memberCards.map(normalizeMockCard),
    products: [] as any[],
    orders: [] as any[],
    refunds: [] as any[],
    loading: false,
    buyingSkuId: '',
    refundingOrderId: '',
    refundStatusCheckingId: '',
    redemptionCode: null as any
  },
  onShow() {
    this.loadCards()
    this.loadProducts()
    this.loadOrders()
  },
  async loadCards() {
    this.setData({ loading: true })
    try {
      const user = await ensureCurrentUser()
      const cards = await listMemberCards(user.id)
      this.setData({
        cards: cards.map(normalizeBackendCard),
        loading: false
      })
    } catch (error) {
      this.setData({
        cards: memberCards.map(normalizeMockCard),
        loading: false
      })
    }
  },
  async loadProducts() {
    try {
      const products = await listProducts('card')
      this.setData({ products: products.map(normalizeProduct) })
    } catch (error) {
      this.setData({ products: memberCards.map(normalizeMockProduct) })
    }
  },
  async loadOrders() {
    try {
      const user = await ensureCurrentUser()
      const orders = await listOrders(user.id, 'card')
      let refunds: any[] = []
      try {
        refunds = await listRefunds(user.id)
      } catch (error) {
        refunds = []
      }
      this.setData({
        orders: orders.map((item: any) => normalizeOrder(item, findRefundBySource(refunds, item.id))),
        refunds
      })
    } catch (error) {
      this.setData({ orders: [], refunds: [] })
    }
  },
  async buyProduct(event: any) {
    const skuId = event.currentTarget.dataset.sku
    if (!skuId) {
      wx.showToast({ title: '本地预览暂不能购买', icon: 'none' })
      return
    }
    wx.showModal({
      title: '本地模拟支付',
      content: '当前不会真实扣款。确认后会创建本地订单，并发放对应会员卡。',
      success: async (modal) => {
        if (!modal.confirm) return
        this.setData({ buyingSkuId: skuId })
        wx.showLoading({ title: '支付中' })
        try {
          const user = await ensureCurrentUser()
          const orderResult = await createOrder(user.id, 'card', [{ sku_id: skuId, quantity: 1 }])
          let paymentStatus = orderResult.status === 'PAID' ? 'SUCCESS' : 'PENDING'
          try {
            const payment = await getOrderPaymentStatus(orderResult.order_id, user.id)
            paymentStatus = payment.payment_status
          } catch (error) {
            paymentStatus = 'PENDING'
          }
          wx.hideLoading()
          wx.showToast({ title: paymentStatus === 'SUCCESS' ? '购买成功' : '支付待确认', icon: 'success' })
          this.setData({ buyingSkuId: '' })
          this.loadCards()
          this.loadOrders()
        } catch (error) {
          wx.hideLoading()
          this.setData({ buyingSkuId: '' })
          wx.showToast({ title: '购买失败', icon: 'none' })
        }
      }
    })
  },
  requestRefund(event: any) {
    const orderId = event.currentTarget.dataset.id
    if (!orderId) return
    wx.showModal({
      title: '申请退款',
      content: '当前为本地测试申请，不会自动原路退款。提交后由门店后台人工审核。',
      success: async (modal) => {
        if (!modal.confirm) return
        this.setData({ refundingOrderId: orderId })
        wx.showLoading({ title: '提交中' })
        try {
          const user = await ensureCurrentUser()
          const refund = await createRefund(user.id, 'order', orderId, '用户在会员中心提交本地退款申请')
          await this.refreshRefundStatusById(refund.refund_id, user.id, false)
          wx.hideLoading()
          wx.showToast({ title: '已提交', icon: 'success' })
          this.setData({ refundingOrderId: '' })
          this.loadOrders()
        } catch (error) {
          wx.hideLoading()
          this.setData({ refundingOrderId: '' })
          wx.showToast({ title: '提交失败', icon: 'none' })
        }
      }
    })
  },
  async refreshRefundStatus(event: any) {
    const refundId = event.currentTarget.dataset.refund
    if (!refundId) return
    this.setData({ refundStatusCheckingId: refundId })
    try {
      const user = await ensureCurrentUser()
      await this.refreshRefundStatusById(refundId, user.id, true)
      wx.showToast({ title: '已刷新', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: '刷新失败', icon: 'none' })
    } finally {
      this.setData({ refundStatusCheckingId: '' })
    }
  },
  async refreshRefundStatusById(refundId: string, userId: string, reloadOrders: boolean) {
    const refund = await getRefundStatus(refundId, userId)
    const orders = this.data.orders.map((item: any) => {
      if (item.refundId !== refund.refund_id && item.id !== refund.source_id) return item
      return {
        ...item,
        status: mapOrderStatus(refund.source_order_status || item.rawStatus),
        rawStatus: refund.source_order_status || item.rawStatus,
        refundId: refund.refund_id,
        refundStatus: mapRefundStatus(refund.status),
        canRefund: false
      }
    })
    this.setData({ orders })
    if (reloadOrders) this.loadOrders()
  },
  async generateCode(event: any) {
    const cardId = event.currentTarget.dataset.id
    if (!cardId) {
      wx.showToast({ title: '本地预览卡暂不能核销', icon: 'none' })
      return
    }
    wx.showLoading({ title: '生成中' })
    try {
      const user = await ensureCurrentUser()
      const result = await generateMemberRedemptionCode(cardId, user.id)
      wx.hideLoading()
      this.setData({
        redemptionCode: {
          code: result.code,
          expiresAt: formatDateTime(result.expires_at),
          title: '会员核销码'
        }
      })
      wx.showToast({ title: '已生成', icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '生成失败', icon: 'none' })
    }
  }
})

function normalizeProduct(item: any) {
  return {
    skuId: item.sku_id,
    title: item.name,
    price: formatPrice(item.price_cents),
    desc: buildProductDesc(item)
  }
}

function normalizeMockProduct(item: any) {
  return {
    skuId: '',
    title: item.type,
    price: item.price,
    desc: item.desc
  }
}

function normalizeOrder(item: any, refund?: any) {
  const firstItem = item.items && item.items.length ? item.items[0] : {}
  return {
    id: item.id,
    title: firstItem.name || '会员卡订单',
    amount: formatPrice(item.payableAmountCents),
    status: mapOrderStatus(item.status),
    rawStatus: item.status,
    paidAt: formatDateTime(item.paidAt || item.createdAt),
    cardId: item.relatedCardId || '',
    refundId: refund ? refund.refund_id || refund.refundId : '',
    refundStatus: refund ? mapRefundStatus(refund.status) : '',
    canRefund: item.status === 'PAID' && !refund
  }
}

function findRefundBySource(refunds: any[], sourceId: string) {
  return (refunds || []).find((item) => item.source_id === sourceId || item.sourceId === sourceId)
}

function normalizeMockCard(item: any) {
  return {
    id: '',
    type: item.type,
    price: item.price,
    desc: item.desc,
    status: item.status,
    canGenerateCode: false
  }
}

function normalizeBackendCard(item: any) {
  const remainingText = item.cardType === 'TEN_PASS' ? `剩余 ${item.remainingUnits || 0} 次` : '今日可用'
  return {
    id: item.id,
    type: item.title || mapCardType(item.cardType),
    price: mapCardPrice(item.cardType),
    desc: buildCardDesc(item),
    status: item.status === 'ACTIVE' ? remainingText : mapCardStatus(item.status),
    canGenerateCode: item.status === 'ACTIVE'
  }
}

function mapCardType(cardType: string) {
  if (cardType === 'TEN_PASS') return '10次卡'
  if (cardType === 'SEASON') return '季卡'
  if (cardType === 'ANNUAL') return '年卡'
  return cardType || '会员卡'
}

function mapCardPrice(cardType: string) {
  if (cardType === 'TEN_PASS') return '580'
  if (cardType === 'SEASON') return '798'
  if (cardType === 'ANNUAL') return '2380'
  return '--'
}

function mapCardStatus(status: string) {
  if (status === 'EXPIRED') return '已过期'
  if (status === 'FROZEN') return '已冻结'
  return status || '待确认'
}

function buildCardDesc(item: any) {
  const validUntil = item.validUntil ? item.validUntil.slice(0, 10) : '待确认'
  if (item.cardType === 'TEN_PASS') return `3个月有效｜本人到场｜有效至 ${validUntil}`
  return `有效至 ${validUntil}｜每日按规则核销`
}

function formatDateTime(value: string) {
  if (!value) return ''
  return value.replace('T', ' ').slice(0, 19)
}

function formatPrice(cents: number) {
  return String(Math.round((cents || 0) / 100))
}

function buildProductDesc(item: any) {
  if (item.card_type === 'TEN_PASS') return '3个月有效｜本人到场｜本地模拟支付'
  if (item.card_type === 'SEASON') return '90天有效｜每日按规则核销｜本地模拟支付'
  if (item.card_type === 'ANNUAL') return '365天有效｜每日按规则核销｜本地模拟支付'
  return '本地模拟支付'
}

function mapOrderStatus(status: string) {
  if (status === 'PAID') return '已支付'
  if (status === 'CANCELED') return '已取消'
  if (status === 'REFUND_REQUESTED') return '退款处理中'
  return status || '待确认'
}

function mapRefundStatus(status: string) {
  if (status === 'PENDING_REVIEW') return '退款待审核'
  if (status === 'APPROVED') return '退款已通过'
  if (status === 'REJECTED') return '退款已拒绝'
  if (status === 'CANCELED') return '退款已取消'
  return status || ''
}
