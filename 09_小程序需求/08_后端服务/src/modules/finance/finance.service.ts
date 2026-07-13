import { Injectable } from '@nestjs/common'
import { InMemoryStore } from '../../common/store.service'

type FinancePeriod = {
  from?: string
  to?: string
}

@Injectable()
export class FinanceService {
  constructor(private readonly store: InMemoryStore) {}

  overview(period: FinancePeriod) {
    const cash = this.cashSummary()
    const profit = this.profit(period)
    const orderSummary = this.orderSummary(period)
    const refundSummary = this.refundSummary(period)
    const cardSummary = this.cardSummary()
    return {
      period,
      cash,
      profit: profit.data,
      orders: orderSummary,
      refunds: refundSummary,
      member_cards: cardSummary,
      warning: '当前为本地模拟支付口径；正式上线后需以微信支付回调、退款、收入确认和费用事实表为准。',
      generated_at: this.store.now()
    }
  }

  profit(period: FinancePeriod) {
    const payments = this.store.payments.all().filter((item) => item.status === 'SUCCESS' && this.inPeriod(item.paidAt, period))
    const internalRevenueCents = payments.reduce((sum, item) => sum + item.amountCents, 0)
    const productCostCents = 0
    const directVariableCostCents = 0
    const memberFulfillmentCostCents = 0
    const marketingCostCents = 0
    const operatingExpensesCents = 0
    const internalGrossProfitCents = internalRevenueCents - productCostCents - directVariableCostCents
    const internalOperatingProfitCents =
      internalRevenueCents - productCostCents - directVariableCostCents - memberFulfillmentCostCents - marketingCostCents - operatingExpensesCents

    return {
      period,
      data: {
        internal_revenue_cents: internalRevenueCents,
        product_cost_cents: productCostCents,
        direct_variable_cost_cents: directVariableCostCents,
        member_fulfillment_cost_cents: memberFulfillmentCostCents,
        marketing_cost_cents: marketingCostCents,
        operating_expenses_cents: operatingExpensesCents,
        internal_gross_profit_cents: internalGrossProfitCents,
        internal_operating_profit_cents: internalOperatingProfitCents
      },
      formula_version: 'internal-profit-v1.0',
      formula_note: '内部经营利润 = 内部经营收入 - 商品成本 - 直接变动成本 - 会员履约成本 - 营销成本 - 运营支出；不等同法定会计利润或税务利润。'
    }
  }

  dividendBasis(period: FinancePeriod) {
    const cash = this.cashSummary()
    const profit = this.profit(period).data
    const futureFixedExpenseReserveCents = 0
    const deferredEntitlementRiskReserveCents = 0
    const pendingRefundAndDisputeReserveCents = this.refundSummary(period).pending_amount_cents
    const taxAndAccountingReserveCents = 0
    const safetyCashBeforeDividendCents =
      cash.available_cash_cents -
      futureFixedExpenseReserveCents -
      deferredEntitlementRiskReserveCents -
      pendingRefundAndDisputeReserveCents -
      taxAndAccountingReserveCents
    const suggestedDividendCeilingCents = Math.max(
      0,
      Math.min(profit.internal_operating_profit_cents, safetyCashBeforeDividendCents)
    )

    return {
      period,
      data: {
        internal_operating_profit_cents: profit.internal_operating_profit_cents,
        available_cash_cents: cash.available_cash_cents,
        future_fixed_expense_reserve_cents: futureFixedExpenseReserveCents,
        deferred_entitlement_risk_reserve_cents: deferredEntitlementRiskReserveCents,
        pending_refund_and_dispute_reserve_cents: pendingRefundAndDisputeReserveCents,
        tax_and_accounting_reserve_cents: taxAndAccountingReserveCents,
        safety_cash_before_dividend_cents: safetyCashBeforeDividendCents,
        suggested_dividend_ceiling_cents: suggestedDividendCeilingCents,
        dividend_recommendation: suggestedDividendCeilingCents > 0 ? 'REVIEW_REQUIRED' : 'NOT_RECOMMENDED'
      },
      formula_version: 'dividend-basis-v1.0',
      formula_note: '建议可分红上限 = min(内部经营累计可分配利润, 可动用现金扣除安全预留后的余额)。系统只提供测算依据，不自动决定分红。'
    }
  }

  private cashSummary() {
    const entries = this.store.cashLedger.all()
    const cashTotalCents = entries.reduce((sum, item) => {
      return item.direction === 'IN' ? sum + item.amountCents : sum - item.amountCents
    }, 0)
    return {
      cash_total_cents: cashTotalCents,
      available_cash_cents: cashTotalCents,
      restricted_cash_cents: 0,
      shareholder_investment_cents: 0,
      shareholder_loan_cents: 0,
      net_cash_flow_cents: cashTotalCents,
      cash_coverage_months: null as number | null
    }
  }

  private orderSummary(period: FinancePeriod) {
    const orders = this.store.orders.all().filter((item) => this.inPeriod(item.createdAt, period))
    const paidOrders = orders.filter((item) => item.status === 'PAID' || item.status === 'REFUND_REQUESTED')
    const cardOrders = paidOrders.filter((item) => item.scene === 'CARD')
    return {
      total_orders: orders.length,
      paid_orders: paidOrders.length,
      card_orders: cardOrders.length,
      paid_amount_cents: paidOrders.reduce((sum, item) => sum + item.payableAmountCents, 0),
      card_sales_cents: cardOrders.reduce((sum, item) => sum + item.payableAmountCents, 0)
    }
  }

  private refundSummary(period: FinancePeriod) {
    const refunds = this.store.refunds.all().filter((item) => this.inPeriod(item.createdAt, period))
    const pending = refunds.filter((item) => item.status === 'PENDING_REVIEW')
    const approved = refunds.filter((item) => item.status === 'APPROVED')
    return {
      total_refunds: refunds.length,
      pending_refunds: pending.length,
      approved_refunds: approved.length,
      pending_amount_cents: pending.reduce((sum, item) => sum + item.calculatedRefundCents, 0),
      approved_amount_cents: approved.reduce((sum, item) => sum + item.calculatedRefundCents, 0)
    }
  }

  private cardSummary() {
    const cards = this.store.memberCards.all()
    return {
      total_cards: cards.length,
      active_cards: cards.filter((item) => item.status === 'ACTIVE').length,
      ten_pass_cards: cards.filter((item) => item.cardType === 'TEN_PASS').length,
      season_cards: cards.filter((item) => item.cardType === 'SEASON').length,
      annual_cards: cards.filter((item) => item.cardType === 'ANNUAL').length,
      remaining_ten_pass_units: cards
        .filter((item) => item.cardType === 'TEN_PASS' && item.status === 'ACTIVE')
        .reduce((sum, item) => sum + (item.remainingUnits || 0), 0)
    }
  }

  private inPeriod(value: string, period: FinancePeriod) {
    const time = new Date(value).getTime()
    if (period.from && time < new Date(period.from).getTime()) return false
    if (period.to && time > new Date(period.to).getTime()) return false
    return true
  }
}
