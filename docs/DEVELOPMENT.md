# Gemeshi Bento Lab 开发文档

本文面向开发、测试和运维人员，说明项目结构、运行模式、核心业务规则、数据流、部署与排障方法。产品功能概览见根目录 [README](../README.md)。

## 1. 当前环境

| 环境 | 地址 | 模式 | 用途 |
| --- | --- | --- | --- |
| 本地 | `http://localhost:3000` | 默认 demo，可接 Neon | 日常开发、单元测试、E2E |
| Staging | `https://bento-staging.vercel.app` | `SHOWCASE_MODE=false`、`DEMO_MODE=true` | 测试完整结账、Staff、订单追踪 |
| Production | `https://bento-lac.vercel.app` | `SHOWCASE_MODE=true` | 公开交互展示，结账和 Staff 关闭 |

Vercel 项目：`ravenleungs-projects/bento`。数据库为 Neon `bento-db`（`syd1`），已连接 Production 和 Preview。

> Staging 使用 demo 支付，不会真正向 Square 扣款。要测试真实卡支付，必须把该环境改为 `DEMO_MODE=false` 并配置 Square Sandbox 凭据。

## 2. 技术栈

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 应用 | Next.js 16 App Router、React 19、TypeScript | 客户界面、API、Staff 和 Webhook 同仓库 |
| 样式 | Tailwind CSS 3 | 移动优先，CSS 变量支持深色模式 |
| 拖放 | `@dnd-kit/core` | 桌面鼠标和手机长按拖放 |
| 数据库 | Neon PostgreSQL + `postgres.js` | 事务、advisory lock、JSONB |
| Schema | Drizzle schema | 只用于表定义和类型；运行时查询用 `postgres.js` |
| 支付/POS | Square Web Payments SDK + Orders API | 浏览器 tokenization，服务端付款和订单同步 |
| 邮件 | Resend | 确认、Ready 通知；未配置时写日志 |
| 时间 | Luxon | 门店时区 `Australia/Sydney` |
| 部署 | Vercel | Production / Preview 双环境 |
| 测试 | Vitest + Playwright | 54 个单元测试、15 个 E2E 场景 |

## 3. 目录结构

```text
app/
  page.tsx                   客户菜单 / Bento Builder
  order/[token]/page.tsx     私有订单追踪页
  staff/                     Staff 登录和厨房面板
  api/                       菜单、时段、报价、结账、订单、Staff、Webhook、Cron
components/
  BentoBuilder.tsx           客户主界面和客户端状态
  bento/                     卡片、Bento 面板、移动端托盘
  CheckoutPanel.tsx          结账表单、时段、过敏原确认
  SquarePaymentForm.tsx      Square SDK / demo 支付按钮
  OrderStatusClient.tsx      订单状态轮询
  StaffDashboard.tsx         Staff 队列、操作、设置
lib/
  config.ts                  环境变量解析和生产配置校验
  catalog.ts                 菜单快照、缓存、demo 回退
  demo-catalog.ts            演示菜品数据
  domain/quote.ts            价格、容量、酱料和最低数量规则
  domain/slots.ts            取餐时段生成
  repositories/orders.ts     订单事务、slot lock、内存订单
  services/                  Checkout、availability、staff 业务编排
  square/                    Catalog、Orders、Payments、setup
  db/                        连接、schema、迁移、JSONB 解析
  auth.ts / signing.ts       Staff OTP、会话和报价签名
  outbox.ts                  邮件/目录异步任务
  webhooks.ts                Square 事件去重和处理
e2e/                         Playwright 场景
tests/                       Vitest 单元测试
scripts/                     migration 和 Square CLI（`.mts`）
public/                      光标等静态资源
demo-data/                   导入用菜品数据
```

## 4. 本地开发

### 4.1 前置条件

- Node.js 24+（脚本使用 `.mts` 和顶层 `await`）
- npm 11+
- 可选：Neon 数据库、Square Sandbox、Resend 账号

### 4.2 启动

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:3000`。

最小 demo 配置：

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEMO_MODE=true
SHOWCASE_MODE=false
DATABASE_URL=
```

`DATABASE_URL` 留空时：

- 菜单使用 `lib/demo-catalog.ts`
- 订单保存在进程内存
- `/staff` 无需 OTP
- 邮件只打印到终端
- 重启 dev server 后订单消失

### 4.3 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建 |
| `npm run start` | 运行生产构建 |
| `npm run typecheck` | TypeScript 检查 |
| `npm run lint` | ESLint |
| `npm test` | Vitest 单元测试 |
| `npm run test:e2e` | Playwright 本地 E2E |
| `npm run db:migrate` | 执行 `lib/db/migrations/*.sql` |
| `npm run db:generate` | 根据 schema 生成 Drizzle 迁移 |
| `npm run square:bootstrap` | 创建 Square 分类和自定义属性 |
| `npm run square:check` | 检查 Square 配置和目录映射 |

## 5. 运行模式

### 5.1 模式判定

`lib/config.ts` 中：

```ts
isShowcaseMode = SHOWCASE_MODE === "true";
isDemoMode =
  isShowcaseMode ||
  DEMO_MODE === "true" ||
  (DEMO_MODE !== "false" && NODE_ENV !== "production" && !isSquareConfigured);
```

| 模式 | 关键配置 | 行为 |
| --- | --- | --- |
| 本地 demo | `DEMO_MODE=true`，无 DB | 内存订单、demo 菜单、Staff 免登录 |
| 本地完整 | `DEMO_MODE=false` + DB + Square | 真实报价、Square Sandbox 卡支付 |
| Vercel Staging | `SHOWCASE_MODE=false`、`DEMO_MODE=true` + DB | 持久化 demo 订单，完整结账和 Staff |
| 展示模式 | `SHOWCASE_MODE=true` | 展示菜单和 Builder，结账/Staff 关闭 |
| 生产 | `DEMO_MODE=false` + 全套凭据 | 真实付款、邮件、Cron |

### 5.2 展示模式

`proxy.ts` 在 `SHOWCASE_MODE=true` 时：

- `/staff` 重定向到 `/`
- `/api/staff/*`、`/api/checkout`、`/api/quote` 返回 404
- 菜单、时段、Builder、拖放、Pick For Me、深色模式仍可使用

`vercel.json` 故意没有 Cron 配置，因为展示模式没有后台任务。

### 5.3 生产启动校验

`instrumentation.ts` 在 Node 运行时、非构建阶段调用 `assertProductionConfig()`。生产环境缺少以下配置会直接启动失败：

- `NEXT_PUBLIC_APP_URL`（必须是 HTTPS origin，无 path/query/hash）
- `DATABASE_URL`
- `AUTH_SECRET`（至少 32 字符）
- 非示例 `STAFF_EMAILS`
- Square 三项凭据和 webhook key
- `RESEND_API_KEY`、非示例 `EMAIL_FROM`
- `CRON_SECRET`

Vercel Preview 有例外：`VERCEL_ENV=preview` 且 `DEMO_MODE=true` 时允许缺少 Square/Resend/Cron，用于 staging 测试。不要在生产环境使用这个例外。

## 6. 环境变量

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | 生产必需 | 对外 origin，用于订单链接和 Square webhook URL |
| `STORE_NAME` | 否 | 店名，默认 `Gemeshi Bento Lab` |
| `STORE_ADDRESS` | 否 | 取餐地址 |
| `STORE_TIMEZONE` | 否 | 默认 `Australia/Sydney` |
| `STORE_CURRENCY` | 否 | 默认 `AUD`，后端金额单位为分 |
| `SHOWCASE_MODE` | 否 | `true` 关闭结账和 Staff |
| `DEMO_MODE` | 否 | `true` 使用 demo 支付、菜单回退和 Staff 免登录 |
| `DATABASE_URL` | 完整模式必需 | PostgreSQL 连接串，建议 `?sslmode=require` |
| `AUTH_SECRET` | 完整模式必需 | 报价、Staff 会话 HMAC；32+ 字符 |
| `STAFF_EMAILS` | 完整模式必需 | 逗号分隔的 Staff 邮箱白名单 |
| `SQUARE_ENV` | Square 模式 | `sandbox` 或 `production` |
| `SQUARE_ACCESS_TOKEN` | Square 模式 | 服务端 API token |
| `SQUARE_LOCATION_ID` | Square 模式 | 门店 location |
| `SQUARE_APPLICATION_ID` | Square 模式 | Web Payments SDK application ID |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Square 模式 | Webhook 签名校验 |
| `SQUARE_API_VERSION` | 否 | 默认 `2026-09-16` |
| `SQUARE_CATEGORY_BOX_ID` | Square 模式 | Bento 盒分类 |
| `SQUARE_CATEGORY_PROTEIN_ID` | Square 模式 | 蛋白质分类 |
| `SQUARE_CATEGORY_VEGETABLE_ID` | Square 模式 | 蔬菜分类 |
| `SQUARE_CATEGORY_STARCH_ID` | Square 模式 | 主食分类 |
| `SQUARE_CATEGORY_SAUCE_ID` | Square 模式 | 酱料分类 |
| `RESEND_API_KEY` | 完整模式 | 留空时邮件写日志，不实际发送 |
| `EMAIL_FROM` | 完整模式 | 必须使用 Resend 已验证域名 |
| `CRON_SECRET` | 完整模式 | Cron endpoint 的 `Authorization: Bearer` |

Vercel 会自动注入 `VERCEL_ENV`（`production` / `preview` / `development`），不要手动覆盖。

`.env.local`、`.vercel/` 已在 `.gitignore` 中，禁止提交任何真实密钥。

## 7. 架构与数据流

```text
浏览器
  ├─ GET  /api/menu           → catalog snapshot（Square → 缓存 → demo）
  ├─ GET  /api/availability   → settings + slot counts
  ├─ POST /api/quote          → 校验并签名 5 分钟报价
  └─ POST /api/checkout       → 创建订单 → demo / Square 付款 → PAID
                                      ↓
                               outbox: email.confirmation
                                      ↓
客户 /order/<private-token> ←→ GET /api/orders/<token>（每 8 秒轮询）
                                      ↑
Staff /staff → GET /api/staff/orders（每 15 秒轮询）
             → POST ready / picked-up → 更新本地订单 + Square fulfillment
Square Webhook → webhook_events → 状态机同步
Cron → 清理过期 PENDING_PAYMENT、处理 outbox、重试 webhook
```

### 7.1 订单状态机

```text
PENDING_PAYMENT ──付款成功──> PAID ──Staff/KDS──> READY ──Staff/KDS──> PICKED_UP
        │                      │
        ├──超时/失败──> FAILED  ├──取消──> CANCELED
        └──退款──────────────────┴──────> REFUNDED
```

- 客户追踪页只展示 `PublicOrder`，不暴露邮箱、Square ID 等内部字段。
- `READY` 邮件通过 outbox 保证只入队一次；数据库还有唯一索引兜底。
- Staff 操作先尝试同步 Square；Square 失败不会回滚本地状态，而是返回 warning 让 Staff 手工核对。

## 8. 核心业务规则

### 8.1 Bento

- 两种盒型：Regular 6 格、Large 9 格。
- 至少 1 份蛋白质、1 份蔬菜。
- 主食可选。
- 酱料单独计算，最多 2 份，不占 Bento 格数。
- 价格以分为单位，全部为 GST 含税价。
- 菜品售罄在报价和结账时都会重新校验。

规则实现：`lib/bento-rules.ts`、`lib/domain/quote.ts`。前端 `BentoBuilder` 的校验只用于即时反馈，最终以后端报价为准。

### 8.2 Pick For Me

在已应用饮食/过敏筛选的菜品池中随机填充：

| 盒型 | 蛋白质 | 蔬菜 | 主食 | 酱料 |
| --- | --- | --- | --- | --- |
| Regular 6 | 2 | 3 | 1 | 0 |
| Large 9 | 3 | 4 | 2 | 0 |

如果菜品种类不足，会从可用分类补足到盒子容量；无法满足最低蛋白质/蔬菜要求时提示用户调整筛选。

### 8.3 取餐时段

- 根据门店时区和营业时间生成。
- 最早时段 = 当前时间 + `prepLeadMinutes`。
- 每 `slotMinutes` 一档，最后一档必须在关门前完成。
- 每个时段的订单占用上限由 `slotCapacity` 控制。
- 暂停接单时返回空时段，结账返回 `ORDERS_PAUSED`。

### 8.4 报价与幂等

- `POST /api/quote` 返回 HMAC 签名报价，默认 5 分钟有效。
- 结账时重新读取目录并重算总价；价格变化返回 `PRICE_CHANGED`。
- `idempotencyKey` 由客户端生成，重复提交返回同一订单。
- 同一 `PENDING_PAYMENT` 订单只允许相同 Bento、时段、金额的重试。

### 8.5 前端交互

- 桌面：鼠标拖拽菜品卡片到右侧 Bento 板。
- 手机：长按 300ms 后拖动到固定托盘；快速上下滑动仍然滚动页面。
- 空闲 3 秒后播放 `Hold and drag` 提示，显示 2.2 秒；持续空闲会重复播放，任何交互都会重置计时。
- 已有菜品、结账打开、Bento 面板打开或系统要求减少动画时不播放提示。
- 深色模式跟随系统，用户切换后写入 `localStorage` 的 `gemeshi-theme`。
- 桌面光标使用筷子图片：可交互元素 hover 时打开，按住/拖动时合上。

## 9. API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/config` | 公开运行配置 |
| GET | `/api/health` | 健康检查、模式、缺失配置 |
| GET | `/api/menu` | 菜单快照 |
| GET | `/api/availability` | 取餐时段和剩余容量 |
| POST | `/api/quote` | 校验 Bento 并签名报价 |
| POST | `/api/checkout` | 创建订单并付款 |
| GET | `/api/orders/[token]` | 私有订单状态 |
| POST | `/api/staff/auth/request` | 发送 Staff OTP |
| POST | `/api/staff/auth/verify` | 校验 OTP 并写会话 Cookie |
| POST | `/api/staff/auth/logout` | 清除会话 |
| GET | `/api/staff/orders` | 今日订单 |
| POST | `/api/staff/orders/[id]/ready` | 标记 Ready |
| POST | `/api/staff/orders/[id]/picked-up` | 标记已取餐 |
| GET/PUT | `/api/staff/settings` | 读取/更新营业设置 |
| POST | `/api/square/webhooks` | Square 事件入口 |
| GET | `/api/cron/process-outbox` | 清理、outbox、webhook 重试 |

所有读取数据库的 route 使用 `dynamic = "force-dynamic"` 和 `Cache-Control: no-store`。

## 10. 数据库

### 10.1 表

| 表 | 用途 |
| --- | --- |
| `orders` | 订单主表、状态、Square ID、时间戳 |
| `order_lines` | 订单菜品快照和价格 |
| `catalog_items` | Square 菜单缓存 |
| `catalog_sync` | 最近同步时间 |
| `settings` | 营业时间、准备时间、slot 配置 |
| `webhook_events` | Square 事件去重和重试 |
| `outbox_jobs` | 确认/Ready 邮件、目录刷新 |
| `staff_otps` | 哈希后的 Staff 验证码 |
| `schema_migrations` | 已执行迁移记录 |

### 10.2 迁移

```bash
npm run db:migrate
```

迁移文件只能向前追加，不要修改已在环境执行过的 SQL。runner 会记录文件名到 `schema_migrations`，可安全重复执行。

### 10.3 并发与可靠性

- `createOrderWithSlot()` 在事务内使用 `pg_advisory_xact_lock` 锁定取餐时段，再统计有效订单，防止超卖。
- `idempotency_key`、`public_token`、`order_code` 都有唯一索引。
- `outbox_jobs` 对 `email.confirmation` 和 `email.ready` 有按 `orderId` 的部分唯一索引，避免重复邮件。
- 失败 job 最多重试 5 次，退避从 30 秒开始，最长 5 分钟。

### 10.4 两个必须注意的坑

1. **JSONB 可能以字符串返回。** 所有 `payload` 读取必须经过 `lib/db/json.ts` 的 `parseJsonColumn()`，否则会出现 `Missing orderId`。
2. **不要同时创建 Drizzle 运行时 client。** Drizzle 会改写 `postgres.js` 的 Date serializer，曾导致 `ERR_INVALID_ARG_TYPE: Received an instance of Date`。Drizzle 只保留 schema 和迁移用途，查询统一使用 `lib/db/client.ts` 的 `sqlClient`。

## 11. 认证与安全

- Staff 邮箱必须在 `STAFF_EMAILS` 白名单中。
- OTP 6 位，10 分钟有效，数据库只保存 HMAC 哈希。
- 会话是 HttpOnly、SameSite=Lax Cookie，默认 12 小时。
- `AUTH_SECRET` 同时用于 OTP 哈希、报价签名和 Staff 会话签名。
- 客户订单链接是 bearer token，不要写入日志或公开分享。
- Square webhook 使用 HMAC 签名校验；事件按 `event_id` 幂等存储。
- 展示模式通过 `proxy.ts` 在路由层关闭结账和 Staff。
- 生产配置在启动阶段强制校验，避免静默回退到 demo。

## 12. 测试

### 12.1 单元测试

```bash
npm run typecheck
npm test
```

覆盖报价规则、时段、目录、checkout 可靠性、订单内存实现、webhook、配置校验和 JSONB 解析。

### 12.2 本地 E2E

```bash
npm run test:e2e
```

Playwright 会自动启动 `npm run dev`（`DEMO_MODE=true`）。覆盖：

- 桌面拖放、非法放置、满盒拒绝
- 手机长按拖放、滑动滚动冲突
- Regular / Large 盒型、酱料上限
- Pick For Me
- 深色模式持久化
- 完整 demo 下单、Ready、Picked up

### 12.3 对 Staging 跑 E2E

```bash
PLAYWRIGHT_BASE_URL=https://bento-staging.vercel.app npx playwright test
```

设置 `PLAYWRIGHT_BASE_URL` 后不会启动本地 dev server。测试会真实写入 staging 数据库并产生订单，仅用于测试环境。

如果本机缺少 Chromium 系统依赖，需要先执行 `npx playwright install-deps chromium`（需要 sudo），或使用已安装依赖的 CI/容器。

### 12.4 手动 smoke test

```bash
curl -s https://bento-staging.vercel.app/api/health
curl -s https://bento-staging.vercel.app/api/menu
curl -s https://bento-staging.vercel.app/api/availability
```

Cron 必须带 secret：

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://bento-staging.vercel.app/api/cron/process-outbox
```

## 13. 部署

### 13.1 Vercel + Neon

1. 在 Vercel 导入仓库，Production Branch 设为 `main`。
2. 通过 Marketplace 创建 Neon 数据库（Sydney），连接 Production 和 Preview。
3. 执行迁移：
   ```bash
   vercel env pull .env.local --environment=development
   # 如果 DATABASE_URL 显示为 [SENSITIVE]，从 Neon 控制台复制真实连接串到 .env.local
   npm run db:migrate
   ```
4. 在 Vercel 分别配置 Production / Preview 环境变量。环境变量按环境隔离，不要只配 Development。
5. 部署后用 `/api/health` 检查 `ok`、`showcaseMode`、`demoMode` 和 `missingConfig`。

### 13.2 Staging

当前 staging 是独立 Preview alias：

```bash
vercel deploy --yes
vercel alias set <new-preview-url> bento-staging.vercel.app
```

Preview 需要：

- `NEXT_PUBLIC_APP_URL=https://bento-staging.vercel.app`
- `SHOWCASE_MODE=false`
- `DEMO_MODE=true`
- `DATABASE_URL`（Neon integration 自动注入）
- `AUTH_SECRET`、`STAFF_EMAILS`、`CRON_SECRET`
- 如需真实 Square Sandbox：`DEMO_MODE=false` 并配置全部 Square 变量

### 13.3 Production 展示模式

- `SHOWCASE_MODE=true`
- `NEXT_PUBLIC_APP_URL=https://bento-lac.vercel.app`
- 不配置 DB、Square、Resend、Cron
- `/api/health` 应返回 `showcaseMode: true`、`missingConfig: []`
- `/api/checkout` 应返回 404

### 13.4 完整生产

1. 配置 Neon 并执行迁移。
2. 配置 Square Sandbox/Production 全部变量。
3. 运行 `npm run square:bootstrap` 创建分类和属性。
4. 在 Square Dashboard 添加菜品并运行 `npm run square:check`。
5. 配置 Resend 已验证域名和 `EMAIL_FROM`。
6. 设置 `DEMO_MODE=false`、长随机 `AUTH_SECRET`、`STAFF_EMAILS`、`CRON_SECRET`。
7. 在 Square 配置 webhook URL：`https://<domain>/api/square/webhooks`。
8. 恢复 Cron。Vercel Hobby 不支持每分钟任务；需要 Pro 或外部调度器。
9. 用 Sandbox 卡完成一笔真实流程，核对 Square Order Manager / KDS、邮件和订单追踪。

## 14. 排障

| 症状 | 可能原因 | 处理 |
| --- | --- | --- |
| `/staff` 500 | 旧 deployment、环境变量缺失、迁移未执行 | 确认 alias 指向最新 deployment，检查 Vercel logs 和 `/api/health` |
| Outbox `Missing orderId` | JSONB payload 被当作 string | 确认读取经过 `parseJsonColumn()` |
| `ERR_INVALID_ARG_TYPE: Date` | 重新引入了 Drizzle 运行时 client | 删除 Drizzle client，只用 `sqlClient` |
| 结账返回 404 / disabled | `SHOWCASE_MODE=true` | 在目标环境关闭展示模式 |
| 配置了 Square 但没扣款 | `DEMO_MODE=true` | 改为 `DEMO_MODE=false` 并重新部署 |
| 邮件没收到 | 未配置 Resend 或域名未验证 | 查 `[email:dev]` 日志、Resend 状态和 `EMAIL_FROM` |
| Cron 401 | `CRON_SECRET` 不匹配 | 使用正确的 `Authorization: Bearer` |
| Outbox 一直 failed | 邮件/Resend 错误 | 查看 job `last_error`；5 次后进入 terminal failed |
| 没有取餐时段 | 暂停接单、已过营业时间、准备时间不足 | 检查 `/staff` 设置和门店时区 |
| Staff OTP 收不到 | 邮箱不在白名单、Resend 未配置 | 检查 `STAFF_EMAILS`，demo 模式看 Vercel 日志中的 code |
| 菜单不可用 | Square 同步失败且无缓存 | 检查 Square 凭据、分类 ID 和 `catalog_items` |

常用命令：

```bash
vercel logs --deployment <deployment-url> --since 10m
vercel env ls preview
vercel ls
curl -s https://bento-staging.vercel.app/api/health
```

## 15. 开发约定

- 先读 `AGENTS.md`。本项目使用 Next.js 16，API 和约定可能与传统 Next.js 不同，必要时查阅 `node_modules/next/dist/docs/`。
- 服务端金额统一用整数分，时间在数据库存 UTC，展示时用 Luxon 转门店时区。
- 数据库访问统一走 `postgres.js`，不要绕过 `sqlClient` 另建连接。
- 新增迁移只追加文件，不修改历史迁移。
- 新增 API 时沿用 `AppError` + Zod 校验 + `Cache-Control: no-store`。
- 新增业务规则时先写 `lib/domain` 纯函数和 Vitest，再接 UI。
- 修改客户界面后至少跑 `npm run typecheck && npm test`，涉及交互再跑 E2E。
- 不提交 `.env.local`、`.vercel/`、真实 token 或客户数据。
- 菜品图片优先透明 PNG；UI 使用 `object-contain` 加 `drop-shadow`，不要给图片加卡片背景。

## 16. 已知限制

- 单店、同日取餐、仅英文和 AUD。
- 无客户账号、短信、配送、会员、多店和客户自助退款。
- 展示模式没有后台任务，因此没有 Cron。
- Vercel Hobby 的 Cron 最低频率为每天一次，分钟级恢复需要 Pro 或外部调度器。
- `DATABASE_URL` 为空时订单只在单进程内存中，多个 serverless 实例不共享。
- Demo 模式绕过 Staff 鉴权，只能用于本地和受控 staging。
- 真实 Square 和 Resend 测试依赖外部账号凭据，CI 默认不执行。
