# 核心 ER 图 V1.1

```mermaid
erDiagram
    USERS ||--o{ PETS : owns
    USERS ||--o{ ORDERS : places
    USERS ||--o{ RESERVATIONS : books
    USERS ||--o{ USER_CARDS : holds
    AGREEMENTS ||--o{ AGREEMENT_ACCEPTANCES : accepted
    USERS ||--o{ AGREEMENT_ACCEPTANCES : signs
    LEGAL_CATALOG_VERSIONS }o--o{ AGREEMENTS : supports

    CARD_PRODUCTS ||--o{ USER_CARDS : instantiates
    USER_CARDS ||--o{ CARD_FAMILY_MEMBER_HISTORY : binds
    USER_CARDS ||--o{ CARD_PAUSES : pauses
    USER_CARDS ||--o{ CARD_BENEFIT_LEDGER : grants_uses
    USER_CARDS ||--o{ RESERVATION_BENEFIT_LOCKS : locks
    USER_CARDS ||--o{ REDEMPTIONS : redeems
    USER_CARDS ||--o{ REVENUE_RECOGNITIONS : recognizes
    USER_CARDS ||--o{ DEFERRED_ENTITLEMENT_LEDGER : defers

    RESERVATION_SLOTS ||--o{ RESERVATIONS : contains
    RESERVATIONS ||--o{ RESERVATION_PETS : includes
    PETS ||--o{ RESERVATION_PETS : booked
    RESERVATIONS ||--o| ADMISSIONS : becomes
    ADMISSIONS ||--o{ ADMISSION_PETS : admits
    ADMISSIONS ||--o{ REDEMPTIONS : links
    OFFLINE_ADMISSION_RECORDS }o--|| RESERVATIONS : supplements

    ORDERS ||--o{ ORDER_ITEMS : contains
    ORDERS ||--o{ PAYMENTS : paid_by
    PAYMENTS ||--o{ REFUNDS : refunded_by
    REFUNDS ||--o{ REFUND_COMPONENTS : explains
    PRODUCT_SKUS ||--|| INVENTORY_BALANCES : balances
    PRODUCT_SKUS ||--o{ INVENTORY_MOVEMENTS : moves
    ORDER_ITEMS ||--o{ INVENTORY_MOVEMENTS : causes

    CASH_ACCOUNTS ||--o{ CASH_LEDGER : records
    OPERATING_EXPENSES ||--o{ EXPENSE_APPROVALS : approves
    OPERATING_EXPENSES }o--|| CASH_ACCOUNTS : paid_from
    ADMINS ||--o{ AUDIT_LOGS : acts
```

## 关键边界

- `metric_snapshots`、`inventory_balances` 是可重算快照，不是唯一事实源。
- `cash_ledger`、`revenue_recognitions`、`deferred_entitlement_ledger`、`inventory_movements` 是不可删除事实。
- `rules_json/product_snapshot/calculation_snapshot` 保证历史规则不随主数据变化。
- 协议和法规来源通过版本关联，能证明当时使用的依据。

