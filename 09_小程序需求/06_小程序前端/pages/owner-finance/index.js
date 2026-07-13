const api = require('../../utils/api')
const { getStaffSession, saveStaffSession } = require('../../utils/storage')

Page({
  data: {
    generatedAt: '本地经营数据',
    warning: '当前为本地模拟支付口径；正式上线后需以微信支付回调、退款、收入确认和费用事实表为准。',
    cash: {
      available: '0'
    },
    profit: {
      revenue: '0',
      operating: '0'
    },
    orders: {
      paidCount: 0,
      paidAmount: '0',
      cardCount: 0,
      cardAmount: '0'
    },
    refunds: {
      pendingCount: 0,
      pendingAmount: '0'
    },
    cards: {
      activeCount: 0,
      remainingUnits: 0
    },
    dividend: {
      safetyCash: '0',
      ceiling: '0',
      recommendation: '不建议分红',
      note: '系统只提供测算依据，不自动决定分红。'
    }
  },
  async onShow() {
    const staffSession = getStaffSession()
    if (!staffSession || !staffSession.staff || staffSession.staff.role !== 'OWNER') {
      wx.showToast({ title: '请先用老板 PIN 登录', icon: 'none' })
      wx.navigateBack()
      return
    }
    try {
      const credential = staffSession.access_token || staffSession.staff_token || staffSession.staff_pin
      const refreshedSession = await api.adminStaffSession(credential)
      if (!refreshedSession.staff || refreshedSession.staff.role !== 'OWNER') {
        wx.showToast({ title: '需要老板权限', icon: 'none' })
        wx.navigateBack()
        return
      }
      saveStaffSession(refreshedSession)
    } catch (error) {
      wx.showToast({ title: '老板登录已失效', icon: 'none' })
      wx.navigateBack()
      return
    }
    this.loadFinance()
  },
  async loadFinance() {
    wx.showLoading({ title: '读取中' })
    try {
      const staffSession = getStaffSession()
      const credential = staffSession && (staffSession.access_token || staffSession.staff_token || staffSession.staff_pin)
      const overview = await api.adminFinanceOverview(credential)
      const dividend = await api.adminDividendBasis(credential)
      wx.hideLoading()
      this.setData(normalizeFinance(overview, dividend))
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '后端未启动', icon: 'none' })
    }
  }
})

function normalizeFinance(overview, dividend) {
  const cash = overview.cash || {}
  const profit = overview.profit || {}
  const orders = overview.orders || {}
  const refunds = overview.refunds || {}
  const cards = overview.member_cards || {}
  const dividendData = (dividend && dividend.data) || {}
  return {
    generatedAt: overview.generated_at ? `更新时间 ${formatDateTime(overview.generated_at)}` : '本地经营数据',
    warning: overview.warning || '当前为本地模拟支付口径。',
    cash: {
      available: formatPrice(cash.available_cash_cents)
    },
    profit: {
      revenue: formatPrice(profit.internal_revenue_cents),
      operating: formatPrice(profit.internal_operating_profit_cents)
    },
    orders: {
      paidCount: orders.paid_orders || 0,
      paidAmount: formatPrice(orders.paid_amount_cents),
      cardCount: orders.card_orders || 0,
      cardAmount: formatPrice(orders.card_sales_cents)
    },
    refunds: {
      pendingCount: refunds.pending_refunds || 0,
      pendingAmount: formatPrice(refunds.pending_amount_cents)
    },
    cards: {
      activeCount: cards.active_cards || 0,
      remainingUnits: cards.remaining_ten_pass_units || 0
    },
    dividend: {
      safetyCash: formatPrice(dividendData.safety_cash_before_dividend_cents),
      ceiling: formatPrice(dividendData.suggested_dividend_ceiling_cents),
      recommendation: mapDividendRecommendation(dividendData.dividend_recommendation),
      note: (dividend && dividend.formula_note) || '系统只提供测算依据，不自动决定分红。'
    }
  }
}

function formatPrice(cents) {
  return String(Math.round((cents || 0) / 100))
}

function formatDateTime(value) {
  if (!value) return ''
  return value.replace('T', ' ').slice(0, 19)
}

function mapDividendRecommendation(value) {
  if (value === 'REVIEW_REQUIRED') return '需人工复核'
  if (value === 'NOT_RECOMMENDED') return '不建议分红'
  return value || '待确认'
}
