# Bark & Bar 微信小程序｜API设计说明 V1.0

日期：2026-07-10｜依据：PRD V1.1、数据库设计 V1.1、角色权限矩阵 V1.0

## 1. 设计目标

本文件用于把业务规则转成开发团队可执行的接口边界。OpenAPI 文件见：

- `05_API文档/openapi_v1.0.yaml`

首期接口不直接暴露数据库表，而按业务动作组织，避免前端绕过预约、核销、退款、库存、现金和审计规则。

## 2. 基础约定

### 2.1 版本

- API 前缀：`/api/v1`
- 重要业务规则通过 `rule_version`、`price_version`、`agreement_version`、`policy_snapshot` 保存快照。
- 已售卡、已签协议、已付款订单不因后台规则变更而静默改写。

### 2.2 身份

- 顾客端：微信登录后使用 `Authorization: Bearer <customer_token>`。
- 管理后台：员工账号登录后使用 `Authorization: Bearer <admin_token>`。
- 敏感操作必须写入审计日志，并携带：
  - `X-Request-Id`
  - `Idempotency-Key`（支付、退款、核销、库存、支出、补录等必须）

### 2.3 通用响应

成功：

```json
{
  "request_id": "req_20260710_xxx",
  "data": {}
}
```

失败：

```json
{
  "request_id": "req_20260710_xxx",
  "error": {
    "code": "RESERVATION_CAPACITY_EXCEEDED",
    "message": "该时段可预约名额不足",
    "details": {}
  }
}
```

### 2.4 金额和时间

- 金额统一用“分”，字段命名为 `amount_cents`、`paid_amount_cents`。
- 时间统一 ISO8601，服务端保存 `timestamptz`。
- 自然日规则以门店时区 `Asia/Shanghai` 计算。

## 3. 核心模块边界

| 模块 | 主要责任 | 不允许做的事 |
|---|---|---|
| 登录/用户/宠物 | 微信身份、手机号、宠物档案、风险审核资料 | 不返回非必要敏感明文 |
| 协议 | 协议版本、签署证据、重签阻断 | 不覆盖旧协议签署证据 |
| 预约 | 容量、审核、取消、爽约、权益锁定 | 不在预约提交时直接扣次 |
| 入园/核销 | 签到、安全核验、动态码、权益核销、弱网补录 | 不允许普通员工最终离线核销 |
| 会员卡 | 卡快照、家庭成员、暂停、到期、权益流水 | 不用当前价格反推历史卡 |
| 订单/支付/退款 | 下单、支付、退款申请、审批、执行 | 不允许无幂等键资金操作 |
| 商城/库存 | 商品、制作、交付、移动加权成本、库存流水 | 不允许负库存和直接改最终库存 |
| 支出/现金 | 支出审批、付款登记、现金账户、现金流水 | 不允许自批和删除已付款记录 |
| 报表 | 六类经营事实、下钻、指标阈值 | 不把内部经营收入等同法定收入 |
| 系统配置 | 价格、容量、协议、法规、角色权限 | 不静默影响已发生业务 |

## 4. 必须实现的幂等场景

| 场景 | 幂等键来源 | 唯一约束建议 |
|---|---|---|
| 创建订单 | 前端生成 + 服务端确认 | `orders.idempotency_key` |
| 微信支付回调 | 微信交易号 | `payments.wechat_transaction_id` |
| 退款申请/执行 | 退款业务号 | `refunds.refund_no` / 渠道退款号 |
| 动态码核销 | 动态码 nonce + 核销业务号 | `dynamic_redemption_codes.nonce`、`redemptions.redemption_no` |
| 弱网补录 | 补录业务号 | `offline_admission_records.offline_no` |
| 库存流水 | 业务单号 + 行号 | `inventory_movements.source_type/source_id/line_no` |
| 支出付款 | 付款业务号 | `cash_ledger.source_type/source_id` |

## 5. 权限控制

后端必须同时判断：

1. 登录身份是否有效；
2. 角色是否有功能权限；
3. 数据范围是否允许；
4. 操作金额、期限、状态是否超过授权；
5. 是否触发禁止自批；
6. 是否需要老板终审或授权财务终审。

权限矩阵见 `01_需求文档/角色权限矩阵_V1.0.md`。

## 6. 关键接口分组

### 6.1 顾客端

- 登录与手机号：`POST /customer/auth/wechat-login`、`POST /customer/auth/phone`
- 宠物档案：`GET/POST /customer/pets`
- 协议：`GET /customer/agreements/required`、`POST /customer/agreements/{id}/accept`
- 预约：`GET /customer/reservation-slots`、`POST /customer/reservations`、`POST /customer/reservations/{id}/cancel`
- 票卡：`GET /customer/cards`、`POST /customer/cards/{id}/pause-requests`
- 动态码：`POST /customer/cards/{id}/redemption-code`
- 商城：`GET /customer/products`、`POST /customer/orders`
- 退款/售后：`POST /customer/refunds`
- 老带新/优惠券：`GET /customer/coupons`、`GET /customer/referral-code`

### 6.2 门店后台

- 工作台：`GET /admin/workbench/today`
- 预约审核：`POST /admin/reservations/{id}/approve`、`POST /admin/reservations/{id}/reject`
- 签到入园：`POST /admin/admissions/check-in`
- 动态码核销：`POST /admin/redemptions/consume-code`
- 弱网补录：`POST /admin/offline-admissions`、`POST /admin/offline-admissions/{id}/post`
- 会员管理：`GET /admin/cards`、`POST /admin/cards/{id}/pause`、`POST /admin/cards/{id}/family-members`
- 退款审批：`POST /admin/refunds/{id}/manager-approve`、`POST /admin/refunds/{id}/final-approve`
- 吧台订单：`GET /admin/orders/bar`、`POST /admin/orders/{id}/status`
- 库存：`POST /admin/inventory/movements`
- 支出：`POST /admin/expenses`、`POST /admin/expenses/{id}/approve`、`POST /admin/expenses/{id}/pay`

### 6.3 老板/财务

- 经营看板：`GET /admin/reports/overview`
- 财务分析：`GET /admin/finance/overview`
- 利润测算：`GET /admin/finance/profit`
- 分红依据：`GET /admin/finance/dividend-basis`
- 六账下钻：`GET /admin/reports/cash-ledger`、`GET /admin/reports/revenue-recognitions`、`GET /admin/reports/deferred-entitlements`
- 月结：`POST /admin/accounting-periods/{id}/close`、`POST /admin/accounting-periods/{id}/reopen`
- 导出：`POST /admin/exports`

### 6.4 系统配置

- 容量规则：`GET/POST /admin/config/capacity-rules`
- 价格/商品/卡模板：`GET/POST /admin/config/products`
- 协议发布：`POST /admin/config/agreements`
- 法规目录：`POST /admin/config/legal-catalogs`
- 阈值：`POST /admin/config/metric-thresholds`
- 角色权限：`POST /admin/config/roles`

## 7. 错误码基线

| 错误码 | 含义 |
|---|---|
| `AUTH_REQUIRED` | 未登录或登录过期 |
| `PERMISSION_DENIED` | 无权限或超出数据范围 |
| `IDEMPOTENCY_CONFLICT` | 幂等键重复但请求内容不一致 |
| `AGREEMENT_RECONFIRM_REQUIRED` | 协议需重签 |
| `RESERVATION_CAPACITY_EXCEEDED` | 容量不足 |
| `RESERVATION_TOO_LATE` | 未满足提前2小时或超过最晚入园规则 |
| `BENEFIT_LOCK_FAILED` | 次卡权益锁定失败 |
| `CARD_NOT_ELIGIBLE` | 卡状态、有效期、本人到场或每日上限不满足 |
| `REDEMPTION_CODE_EXPIRED` | 动态码过期 |
| `REDEMPTION_CODE_REUSED` | 动态码已使用或疑似截图 |
| `OFFLINE_POST_REQUIRES_OWNER` | 弱网补录需老板处理 |
| `REFUND_POLICY_REVIEW_REQUIRED` | 退款计算需人工复核 |
| `SELF_APPROVAL_FORBIDDEN` | 禁止自批 |
| `NEGATIVE_INVENTORY_FORBIDDEN` | 库存不足，禁止负库存 |
| `ACCOUNTING_PERIOD_CLOSED` | 账期已关闭 |

## 8. 开发注意事项

- 前端不要自行计算最终退款、收入、可用权益、库存成本和现金余额，只展示服务端计算结果。
- 服务端对所有金额重新计算，不信任前端金额。
- 动态码仅用于换取核销动作，不包含可反推的会员、手机号或价格信息。
- 财务、库存、协议、审计、核销、支付、退款采用追加或冲正，不提供删除接口。
- 查询列表可以分页和筛选；导出走异步任务，避免后台页面长时间等待。
