# FinDigest

**私人研究台，不是荐股机。**

[Live](https://findigest.cn) · Vue 3 · 持仓简报 · 硬约束优先 · 止于仓位含义

FinDigest 把东财/雪球噪音压成每天该看的几件事。分析宇宙是**你的持仓**，不是全市场扫描。本地引擎负责排序与安全边际；模型只用人话重写，不下单、不报买卖点。

> 内容仅供信息参考，不构成投资建议。

## 我们拒绝什么

- **不荐股**：不做排行榜式「必买清单」
- **不点位神谕**：不承诺目标价或买卖时机
- **不把角度当引擎**：约 11 类可计算主锚 · 100+ 思维角度（非 100 套独立 IV）

硬约束（回撤容忍、单票上限、回避行业）一票否决加仓语言。到仓位含义就停：加 / 减 / 观察 / 硬约束。

## 能力

| | 基础版（免费） | Pro |
|---|---|---|
| 今日简报（本地） | 有，默认 ≤3 条 | 有 |
| 精密投资画像 | 11 题即可用，88 题可补 | 引导校准 88 题 |
| Pro Desk HUD | — | 估值分 / 仓位 / 风险同屏 |
| 工作区 · 事件 · 报告 | 收在「我的」 | 主导航直达 |
| 用人话重写 | — | 对质结构；清洗买卖点位 |

演示站：https://findigest.cn （`www.findigest.cn` 同样可用）

## 本地运行

```bash
npm install
npm run dev
```

打开 http://localhost:5173

可选环境变量见 [`.env.example`](.env.example)。**不要提交 `.env`。** 生产需要的密钥（OTP、vault、阿里云短信/邮件、管理台）只放在托管平台的环境变量里。

```bash
npm run test:unit
npm run build
```

## 和「金融 agent skill」的差别

市场上多数金融 skill 的交付是：任意代码 → BUY/SELL → 进场/止损/仓位。FinDigest 不走那条路。

- 没有导入的持仓，不分析
- 本地引擎排序，LLM 只重写叙述并清洗买卖点
- 画像是门禁，不是选股器

仓库里的产品纪律写在落地页「我们拒绝什么」和 [`src/views/KnownLimits.vue`](src/views/KnownLimits.vue)。不要把 TradingAgents 式出票 skill 接进用户可见简报。

## 技术栈

- Vue 3 + Vite 8 + Pinia + Vue Router
- 行情：同域 `/api/proxy` 优先（白名单源 + rate limit）；JSONP 仅为兜底并会标 `jsonp-fallback`
- 估值：`valuationTaxonomy` 约 11 个 archetype；`valuation_paradigms.js` 是思考角度目录
- 持仓 / 事件：`public/data/*.json` + 登录后按账号 vault
- 权益：`entitlements = f(billing)` 单真相源

模块边界见 [`docs/module-boundaries.md`](docs/module-boundaries.md)。

## 发布

已配置 `vercel.json`（SPA + `/api/*` + CSP）。把本仓库接到 [Vercel](https://vercel.com) 后填环境变量即可。演示站当前部署在 Vercel。

GitHub Pages **没有** `/api/proxy`，不适合作为主站。

## 开源许可

[MIT](LICENSE)。欢迎 Issue / PR。改简报、估值或画像时，请先读「我们拒绝什么」，不要把本项目改回荐股机。
