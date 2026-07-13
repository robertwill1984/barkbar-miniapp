# Bark & Bar 小程序前端

状态：MVP-A 本地后端 API 接入版｜日期：2026-07-13

## 定位

本目录是 Bark&Bar 主项目 `09_小程序需求/` 下的小程序前端代码，不是独立项目。

## UI 来源

采用主项目 `../10_UI_VI设计/` 中已完成的 UI/VI 规范：

- 颜色：Grass Club Green、Pool Day Blue、Soft Paper、Member Gold、Bark Ink；
- 页面结构：首页、预约、活动、我的；
- 核心页面：首页、预约选择、犬只信息、入园须知确认、预约成功、会员中心、动态码、老带新、活动列表、员工核验。

实现中统一使用“宠物救生衣 / 犬用浮力救生衣”，不使用旧“游泳衣”表述。

## 当前已建

- 微信小程序基础配置；
- 全局 Bark&Bar 视觉样式；
- Bark&Bar B 标志展示图：`assets/barkbar-logo-mark-b.png`；
- Bark&Bar Logo 展示图：`assets/barkbar-logo-official-display.png`；
- Bark&Bar Logo SVG 源文件：`assets/barkbar-logo-fourtoe-vector.svg`、`assets/barkbar-logo-fourtoe-vector-transparent.svg`；
- 首页；
- 预约页；
- 预约成功页；
- 活动页；
- 我的页；
- 宠物档案页；
- 协议确认页；
- 完整协议正文页；
- 会员中心页；
- 员工核验入口页。
- JavaScript 编译入口：`app.js` 和每个页面的 `index.js`。
- 本地后端 API 工具：`utils/api.js`、`utils/api.ts`。
- 宠物档案、协议确认、预约提交已接入本地后端 API，并保留本地兜底。
- “我的”页已显示预约列表，并支持取消预约、申请改期。
- 员工核验页已接入管理端预约列表，并支持审核通过、审核拒绝、确认到店核验。
- 用户侧预约列表可为已确认预约生成 60 秒核验码；员工核验页需输入员工 PIN 后才能查看预约和核验动态码。
- 会员中心页已接入本地后端会员卡列表，并支持生成 60 秒会员核销码。
- 员工核验页已新增会员核销码入口，10 次卡核销后自动扣减剩余次数。
- 会员中心页已新增本地模拟购买入口，可购买 10 次卡、季卡、年卡；创建本地订单后自动发放会员卡。
- 会员中心页已新增购买记录，显示本地会员卡订单的名称、支付时间、金额和状态。
- 会员中心购买会员卡后会查询本地订单支付状态；当前为 `LOCAL_MOCK` 模拟支付，后续可替换为微信支付查询或回调结果。
- 会员中心购买记录已新增本地“申请退款”入口，提交后显示退款待审核；当前不会触发真实退款。
- 会员中心退款状态已支持按单笔申请刷新；当前读取本地退款审核状态，后续可替换为微信退款查询结果。
- 员工核验页已新增“退款申请处理”区块，员工输入 PIN 后可查看申请并通过或拒绝。
- 员工核验页已新增“会员/订单查询”区块，员工可按用户 ID 查询会员卡、剩余次数、有效期和会员订单。
- 我的页已新增“经营数据”入口，员工/老板可查看本地订单收入、待审退款、会员卡销售和分红测算依据。
- 员工核验页已接入本地员工/老板身份登录，PIN 验证成功后保存本地 staff session；经营数据入口仅对 OWNER 显示。
- 经营数据页调用财务接口时会携带本地老板 PIN，后端未通过老板 PIN 时不返回经营数据。
- 员工端和老板页接口调用已优先使用本地 `staff_token`，旧 `staff_pin` 暂保留兼容，便于后续替换为正式微信员工权限。
- 员工核验页和经营数据页进入时会调用本地员工会话校验接口，刷新当前角色和权限；会话失效时提示重新输入 PIN。

## 本地 API 接入口径

- 默认接口地址：`http://127.0.0.1:3000/api/v1`。
- 配置位置：`app.js` / `app.ts` 的 `globalData.apiBaseUrl`。
- 当前接入接口：
  - `POST /customer/auth/wechat-login`：本地微信登录占位；
  - `GET /customer/reservation-slots`：预约时段；
  - `POST /customer/pets`：宠物档案；
  - `GET /customer/agreements/required`：预约前协议确认状态；
  - `POST /customer/agreements/{agreement_id}/accept`：协议确认留证；
  - `POST /customer/reservations`：提交预约。
  - `GET /customer/reservations`：查询我的预约；
  - `POST /customer/reservations/{reservation_id}/cancel`：取消预约或申请改期。
  - `GET /admin/reservations`：员工端查询预约，支持本地 `staff_token`；
  - `POST /admin/reservations/{reservation_id}/review`：审核预约或改期申请，支持本地 `staff_token`；
  - `POST /admin/reservations/{reservation_id}/checkin`：确认到店核验，支持本地 `staff_token`。
  - `POST /customer/reservations/{reservation_id}/checkin-code`：用户生成 60 秒核验码；
  - `POST /admin/reservations/verify-code`：员工输入核验码完成到店核验，支持本地 `staff_token`。
  - `GET /customer/cards`：查询我的会员卡；
  - `POST /customer/cards/{card_id}/redemption-code`：生成会员 60 秒核销码；
  - `POST /admin/redemptions/consume-code`：员工核销会员动态码，支持本地 `staff_token`。
  - `GET /customer/products`：查询可售票卡/商品；
  - `POST /customer/orders`：创建本地模拟支付订单并发放会员卡。
  - `GET /customer/orders/{order_id}/payment`：查询本地订单支付状态。
  - `GET /customer/orders`：查询我的本地订单/购买记录。
  - `GET /customer/refunds`：查询我的退款或售后申请。
  - `POST /customer/refunds`：提交本地退款或售后申请。
  - `GET /customer/refunds/{refund_id}/status`：查询单笔退款或售后状态。
  - `POST /admin/auth/pin-login`：本地员工/老板 PIN 登录，返回本地角色和权限；
  - `POST /admin/auth/session`：本地员工/老板会话校验，返回当前角色和权限；
  - `GET /admin/refunds`：员工查询退款或售后申请，支持本地 `staff_token`；
  - `POST /admin/refunds/{refund_id}/review`：员工审核通过或拒绝退款申请，支持本地 `staff_token`。
  - `GET /admin/orders`：员工查询本地订单，支持本地 `staff_token`；
  - `GET /admin/cards`：员工查询会员卡，支持本地 `staff_token`。
  - `GET /admin/finance/overview`：查询老板经营数据总览，需本地老板 `staff_token` 或兼容 PIN；
  - `GET /admin/finance/dividend-basis`：查询股东分红测算依据，需本地老板 `staff_token` 或兼容 PIN。
- 如果本地后端未启动，小程序仍会使用本地缓存流程，方便继续预览 UI。
- 微信开发者工具本地联调时，需要勾选“不校验合法域名、web-view、TLS 版本以及 HTTPS 证书”。
- 正式上线配置项已整理到 `../10_部署文档/上线配置与资料自检表_V1.0.md`；微信 AppID、商户号和正式域名未提供前，不影响本地 MVP 继续开发。
- 本机已检测到微信开发者工具 `/Applications/wechatwebdevtools.app`；人工验收步骤见 `../09_测试文档/微信开发者工具本地人工验收步骤_V1.0.md`。

## 入园协议来源

小程序《入园须知及安全协议》展示版依据 Bark&Bar 主项目协议整理：

- 主项目源文件：`../../02_入园协议/附件A_入园须知及安全协议_V1.3_统一序号版.docx`
- 小程序留档副本：`assets/agreements/entry-agreement-source-v1.3.docx`
- 小程序展示版本：V1.4

V1.4 保留主协议的入园、禁入、看护、泳池、传染病、事故处理和证据规则，同时同步后续已确认口径：泳池约0.8-1m、无浅水适应区、统一使用“宠物救生衣”，会员/退款细则以专项规则为准。

## Logo说明

当前 Logo 来自用户提供的四趾矢量文件包。主项目原始资产已归档到 `../10_UI_VI设计/03_VI基础规范/Logo资产/`。

小程序当前 hero 区域使用 `assets/barkbar-logo-mark-b.png`，只展示字母 B / 爪印品牌符号，避免与页面标题里的 Bark & Bar 重复。

`assets/barkbar-logo-official-display.png` 作为完整 Logo 展示备用图保留。SVG 源文件已同步保留，后续可用专业设计软件导出透明 PNG 后替换。

## 下一步

1. 启动本地后端服务；
2. 用微信开发者工具按 `../09_测试文档/微信开发者工具本地人工验收步骤_V1.0.md` 预览首页、预约、会员中心、员工核验和经营数据；
3. 接入真实微信 `code2Session`；
4. 将本地员工/老板 PIN 身份替换为真实微信员工权限；
5. 将本地模拟支付、退款申请、退款状态查询、本地员工审核、员工只读查询和老板经营数据替换为真实微信支付回调、微信退款、真实会员购买、真实员工权限、正式财务口径和正式服务器。
