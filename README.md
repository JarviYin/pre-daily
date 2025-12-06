# Prediction Daily

每日汇总 Polymarket 重要信息和前沿新闻，每天早上8点自动更新。

## 功能特性

- 📊 自动抓取 Polymarket 上交易量排名前10的市场
- 🤖 使用 OpenAI GPT-4o 生成深度中文解读（每条约300字）
- ⏰ 每天早上8点（北京时间）自动更新
- 📱 移动优先的响应式设计
- 🎨 极简黑白报纸风格 UI
- 🔄 自动重试和降级机制

## 技术栈

- **Next.js 14** - React 框架
- **TypeScript** - 类型安全
- **Cheerio** - HTML 解析和网页抓取
- **OpenAI API** - 内容生成
- **Zod** - 数据验证
- **node-cron** - 定时任务

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```env
OPENAI_API_KEY=your_openai_api_key_here
CRON_SECRET=your_cron_secret_here  # 可选，用于保护 cron 端点
```

### 3. 运行开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 4. 构建生产版本

```bash
npm run build
npm start
```

## 部署到 Vercel

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量：
   - `OPENAI_API_KEY`
   - `CRON_SECRET` (可选)
4. 部署后，Vercel 会自动配置 cron 任务

## 项目结构

```
.
├── app/
│   ├── api/
│   │   ├── daily/route.ts      # 每日摘要 API
│   │   └── cron/route.ts       # Cron 触发端点
│   ├── globals.css             # 全局样式
│   ├── layout.tsx              # 根布局
│   └── page.tsx                # 首页
├── lib/
│   ├── openai.ts               # OpenAI 集成
│   ├── polymarket.ts           # Polymarket 数据抓取
│   ├── scheduler.ts            # 定时任务管理
│   └── utils.ts                # 工具函数
├── types/
│   └── index.ts                # TypeScript 类型定义
└── package.json
```

## 核心功能

### 数据抓取

- 从 Polymarket.com 抓取市场数据
- 提取交易量、概率、选项等信息
- 多种降级策略确保数据可用性

### 内容生成

- 使用 GPT-4o 生成深度解读
- 每条解读约300字，包含：
  - 事件背景与重要性
  - 市场热度分析（含具体概率数据）
  - 可能结果分析
  - 深层意义与趋势洞察
  - 风险与机遇

### 定时更新

- 本地开发：使用 node-cron
- 生产环境：使用 Vercel Cron

## 许可证

MIT

