# Bark & Bar 小程序后端｜MVP-A API 对接清单 V1.0

日期：2026-07-10

## 1. 本阶段目标

把小程序前端从“本地假数据/本地存储”逐步切换到后端 API。MVP-A 只覆盖上线基础闭环：

- 微信登录；
- 宠物档案；
- 入园协议确认；
- 预约时段；
- 预约提交；
- 预约查询。

支付、会员开卡、动态码核销、退款、库存、支出和老板看板放到 MVP-B/C，不在本轮混入。

但后端范围已明确包含财务分析：现金流、内部经营利润和股东分红依据。本轮先提供模块边界和占位接口，真实金额必须等支付、收入确认、支出和现金流水接入数据库后生成。

## 2. 当前后端路径

本地启动后，接口统一前缀：

```text
http://127.0.0.1:3000/api/v1
```

## 3. 接口清单

| 前端动作 | 后端接口 | 当前状态 |
|---|---|---|
| 微信登录 | `POST /customer/auth/wechat-login` | 已有占位，正式需接微信 code2Session |
| 获取是否需签协议 | `GET /customer/agreements/required?user_id=...` | 已有 |
| 确认协议 | `POST /customer/agreements/{agreement_id}/accept` | 已有，保存内容哈希和证据哈希 |
| 新增宠物 | `POST /customer/pets` | 已有 |
| 查询宠物 | `GET /customer/pets?user_id=...` | 已有 |
| 查询预约时段 | `GET /customer/reservation-slots` | 已有 |
| 提交预约 | `POST /customer/reservations` | 已有，未签协议会拦截 |
| 查询预约 | `GET /customer/reservations?user_id=...` | 已有 |
| 财务总览 | `GET /admin/finance/overview` | 已有占位 |
| 利润测算 | `GET /admin/finance/profit` | 已有占位 |
| 分红依据 | `GET /admin/finance/dividend-basis` | 已有占位 |

## 4. 关键业务拦截

### 协议未签不能预约

预约提交前，后端会检查用户是否已签当前版本《入园须知及安全协议》。未签时返回错误：

```text
current entry agreement must be accepted before reservation
```

### 宠物风险进入人工审核

以下情况会让预约进入 `PENDING_REVIEW`：

- 疫苗状态不是 `VALID`；
- 犬证状态不是 `VALID`；
- 用户填了攻击史；
- 宠物内部风险审核状态不是 `APPROVED`。

### 票价估算

当前按已确认规则估算：

- 单次票 68 元，含 2 人 1 狗；
- 增人 20 元；
- 增狗 50 元；
- 会员卡入园暂不收基础票价，只计算增人/增狗。

## 5. 还不能用于生产的原因

当前后端是骨架，不是生产服务：

- 登录还是本地 mock openid；
- 数据存在内存中，重启会丢失；
- 还没有接 PostgreSQL 查询层；
- 还没有 JWT 鉴权守卫；
- 还没有真实文件上传、微信支付、短信或正式云资源；
- 还没有管理后台审核页面；
- 财务分析接口当前只返回结构和公式边界，还没有真实金额。

## 6. 下一步实现顺序

1. 接 PostgreSQL，把内存存储替换为数据库；
2. 接微信 `code2Session`，真实识别用户；
3. 前端新增 `utils/api.js`，把本地存储流程逐步切到 API；
4. 建管理后台预约审核；
5. 接入支付和会员动态码；
6. 接入财务事实表，生成现金流、利润和分红依据。
