# 字2Anki (Zi2Anki)

> 书法记忆卡 · 基于 SM-2 间隔重复算法的书法练习工具

**Zi2Anki** 是一款专为书法学习者设计的间隔重复记忆工具。将书法字帖图片批量导入后，通过 SM-2 算法自动安排每日复习，让字形记忆变得高效而持久。

---

## 功能特性

- **牌组管理** — 按字帖/碑帖创建牌组（如"春江花月夜"），分类管理书法单字
- **批量导入** — 支持批量上传图片，自动从文件名提取文字作为卡片正面
- **SM-2 算法** — 经典间隔重复算法，根据每次学习的评分（重来/困难/良好/简单）智能调整复习间隔
- **学习统计** — 每日学习量、连续打卡、评分分布一目了然
- **本地优先** — SQLite 存储所有数据，无需网络即可使用
- **Supabase 同步**（可选） — 多设备间同步学习进度和卡片数据
- **响应式设计** — 桌面端 + 移动端适配，随时随地复习

---

## 技术栈

| 层 | 技术 |
|---|------|
| 前端框架 | React 18 + TypeScript |
| UI 组件 | MUI (Material UI) v5 |
| 样式 | Tailwind CSS 3 |
| 状态管理 | Zustand |
| 路由 | React Router 6 |
| 构建工具 | Vite 5 |
| 后端 | Express 5 + TypeScript |
| 数据库 | better-sqlite3 |
| 算法 | SM-2 (纯函数实现) |
| 离线存储 | Dexie (IndexedDB) |
| 同步 | Supabase |

---

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/zaxchou/zi2anki.git
cd zi2anki

# 安装依赖
npm install

# 创建上传目录
mkdir -p uploads

# 启动后端（端口 3001）
npx tsx server/index.ts

# 新终端，启动前端（端口 3000）
npx vite --host
```

打开浏览器访问 `http://localhost:3000`

---

## 项目结构

```
zi2anki/
├── server/                  # Express 后端
│   ├── index.ts             # 服务入口
│   ├── db.ts                # SQLite 数据库初始化 + 迁移
│   ├── routes/
│   │   ├── decks.ts         # 牌组 CRUD API
│   │   ├── cards.ts         # 卡片 CRUD + 批量导入 API
│   │   └── study.ts         # 学习会话 + 统计 API
│   └── tsconfig.json
├── src/                     # React 前端
│   ├── main.tsx             # 应用入口
│   ├── App.tsx              # 路由配置
│   ├── components/
│   │   ├── common/          # 通用组件（对话框、加载态）
│   │   ├── dashboard/       # 仪表盘组件（统计栏、打卡徽章）
│   │   ├── layout/          # 布局组件（导航、顶栏）
│   │   └── study/           # 学习组件（闪卡、评分按钮、进度条）
│   ├── pages/               # 页面
│   │   ├── DecksPage.tsx    # 牌组列表
│   │   ├── CardManagePage.tsx # 卡片管理
│   │   ├── StudyPage.tsx    # 学习页面
│   │   ├── DashboardPage.tsx # 仪表盘
│   │   └── SettingsPage.tsx # 设置
│   ├── lib/
│   │   ├── api.ts           # Express API 客户端
│   │   ├── sm2.ts           # SM-2 算法实现
│   │   ├── constants.ts     # 全局常量
│   │   ├── db.ts            # Dexie 离线存储
│   │   ├── sync.ts          # Supabase 同步
│   │   └── supabase.ts      # Supabase 客户端
│   ├── stores/              # Zustand 状态管理
│   ├── types/               # TypeScript 类型定义
│   └── __tests__/           # 单元测试
├── docs/                    # 设计文档
│   ├── system_design.md     # 系统设计
│   ├── class-diagram.mermaid
│   └── sequence-diagram.mermaid
├── uploads/                 # 上传图片存储
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/decks` | 获取所有牌组 |
| POST | `/api/decks` | 创建牌组 |
| PUT | `/api/decks/:id` | 重命名牌组 |
| DELETE | `/api/decks/:id` | 删除牌组 |
| GET | `/api/decks/:id/cards` | 获取牌组下所有卡片 |
| POST | `/api/decks/:id/cards` | 添加单张卡片 |
| POST | `/api/decks/:id/cards/batch` | 批量导入图片 |
| PUT | `/api/cards/:id` | 更新卡片 |
| DELETE | `/api/cards/:id` | 删除卡片 |
| GET | `/api/decks/:id/due-cards` | 获取到期待复习卡片 |
| GET | `/api/decks/:id/new-cards` | 获取新卡片 |
| POST | `/api/study-sessions` | 创建学习会话 |
| PUT | `/api/study-sessions/:id` | 结束学习会话 |
| GET/PUT | `/api/daily-stats/:date` | 每日统计 |

---

## SM-2 算法

本项目实现了标准的 SM-2 间隔重复算法，评分分为四档：

| 评分 | 按钮 | ease 变化 | 间隔变化 |
|------|------|-----------|----------|
| 1 | 重来 | -0.20 | 重置到 1 分钟 |
| 2 | 困难 | -0.15 | 当前间隔 × 1.2 |
| 3 | 良好 | 不变 | 当前间隔 × ease |
| 4 | 简单 | +0.15 | 当前间隔 × ease × 1.3 |

学习阶梯：1 分钟 → 10 分钟 → 毕业（1 天）

---

## 相关项目

- **[zi2anki-skills](https://github.com/zaxchou/zi2anki-skills)** — WorkBuddy 技能包：书法单字提取、碑帖裁切等自动化工具

---

## License

MIT
