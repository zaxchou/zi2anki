# 架构设计：市场功能

## 一、数据库迁移方案

### 新建表

```sql
-- 市场牌组元数据
CREATE TABLE IF NOT EXISTS marketplace_decks (
  deck_id TEXT PRIMARY KEY REFERENCES decks(id) ON DELETE CASCADE,
  calligrapher TEXT DEFAULT '',
  dynasty TEXT DEFAULT '',
  style TEXT DEFAULT '',          -- 楷/行/草/隶/篆
  description TEXT DEFAULT '',
  cover_image TEXT DEFAULT '',    -- /uploads/xxx.jpg
  featured INTEGER DEFAULT 0,     -- 0=普通, 1=推荐
  sort_order INTEGER DEFAULT 0,
  published_at TEXT,              -- 发布时间
  created_at TEXT NOT NULL
);

-- 用户卡片进度（替代 cards 表中的 SM-2 字段）
CREATE TABLE IF NOT EXISTS user_card_progress (
  user_id TEXT NOT NULL,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  ease REAL DEFAULT 2.5,
  interval INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  next_review TEXT NOT NULL,
  last_review TEXT,
  PRIMARY KEY (user_id, card_id)
);

-- 用户订阅
CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  subscribed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, deck_id)
);
```

### cards 表改造

保留 SM-2 字段不删（向后兼容），但新代码不再读写它们。新建 `user_card_progress` 作为权威进度来源。

**迁移步骤**（在 db.ts 启动时自动执行）：
1. 创建上述 3 张新表
2. 将现有 admin 的牌组插入 `marketplace_decks`（calligrapher/dynasty/style 留空，Admin 后续编辑）
3. 不迁移进度（豪哥确认进度清零）

### 迁移脚本逻辑（db.ts 中）

```typescript
// 1. 创建新表（IF NOT EXISTS）
// 2. 将所有现有 deck 自动发布到市场
//    INSERT OR IGNORE INTO marketplace_decks (deck_id, ...) SELECT id, ... FROM decks
// 3. 为所有用户自动订阅他们已有 user_id 的牌组
//    INSERT OR IGNORE INTO user_subscriptions ...
```

---

## 二、API 设计

### 市场浏览

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/marketplace/decks` | 列出市场牌组（支持 ?style=&calligrapher=&search= 筛选） | 所有用户 |
| GET | `/api/marketplace/decks/:deckId` | 获取单个市场牌组详情 | 所有用户 |

### 订阅

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/marketplace/decks/:deckId/subscribe` | 订阅牌组 | 所有用户 |
| DELETE | `/api/marketplace/decks/:deckId/subscribe` | 退订（清除该牌组下该用户所有进度） | 所有用户 |
| GET | `/api/marketplace/subscriptions` | 获取当前用户已订阅的牌组列表 | 所有用户 |

### Admin 管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/marketplace/decks/:deckId/publish` | 发布牌组到市场（含元数据） | Admin |
| PUT | `/api/marketplace/decks/:deckId` | 编辑市场元数据 | Admin |
| DELETE | `/api/marketplace/decks/:deckId/publish` | 从市场下架 | Admin |

### 学习流程适配（关键改动）

| 端点 | 改动 |
|------|------|
| `GET /decks/:deckId/due-cards` | JOIN `user_card_progress`，缺进度=新卡 |
| `GET /decks/:deckId/new-cards` | JOIN `user_card_progress`，interval=0 或无进度 |
| `PUT /cards/:id` | SM-2 字段写入 `user_card_progress` 而非 `cards` |
| `GET /decks` | 只返回已订阅的市场牌组（JOIN user_subscriptions） |
| `GET /decks/:deckId/cards` | 卡片内容从 `cards` 读，进度从 `user_card_progress` LEFT JOIN |

---

## 三、前端页面结构

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/pages/MarketPage.tsx` | 市场浏览页 |
| `src/components/market/DeckCard.tsx` | 市场牌组卡片组件 |
| `src/components/market/PublishDialog.tsx` | Admin 发布弹窗 |
| `server/routes/marketplace.ts` | 市场路由 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `server/db.ts` | 新建 3 表 + 迁移逻辑 |
| `server/index.ts` | 挂载 marketplace 路由 |
| `server/routes/cards.ts` | due-cards/new-cards/PUT 改 JOIN user_card_progress |
| `server/routes/decks.ts` | GET /decks 改为返回已订阅的市场牌组 |
| `server/routes/study.ts` | rateCard 写入 user_card_progress |
| `src/lib/api.ts` | 新增 marketplace API 函数 |
| `src/types/index.ts` | 新增 MarketplaceDeck / Subscription 类型 |
| `src/components/layout/SideMenu.tsx` | 新增「市场」导航项 |
| `src/components/layout/BottomNav.tsx` | 新增「市场」导航项 |
| `src/pages/CardManagePage.tsx` | Admin 新增「发布到市场」按钮 |
| `src/pages/DashboardPage.tsx` | 牌组列表来自已订阅的市场牌组 |
| `src/pages/SettingsPage.tsx` | 普通用户隐藏 APKG 导入导出 |

---

## 四、权限模型

| 功能 | Admin | 普通用户 |
|------|-------|---------|
| 浏览市场 | ✅ | ✅ |
| 订阅/退订 | ✅ | ✅ |
| 学习/评分 | ✅ | ✅ |
| 创建牌组 | ✅ | ❌ |
| 导入图片/APKG | ✅ | ❌ |
| 导出 APKG | ✅ | ❌ |
| 发布到市场 | ✅ | ❌ |
| 编辑市场元数据 | ✅ | ❌ |

前端通过 `useAuthStore.user.role === 'admin'` 控制 UI 显隐。后端通过 `requireAdmin` 中间件拦截。

---

## 五、任务列表（按实现顺序）

### Task 1: 数据库迁移（后端）
- 文件：`server/db.ts`
- 新建 3 表 + 迁移逻辑
- 验证：启动不报错，表结构正确

### Task 2: 市场路由（后端）
- 文件：`server/routes/marketplace.ts`（新建）+ `server/index.ts`
- 实现 7 个 API 端点
- 验证：curl 测试每个端点

### Task 3: 学习流程适配（后端）
- 文件：`server/routes/cards.ts` + `server/routes/study.ts` + `server/routes/decks.ts`
- due-cards/new-cards/PUT cards 改 JOIN user_card_progress
- GET /decks 改返回已订阅牌组
- 验证：学习流程端到端跑通

### Task 4: 前端类型 + API（前端）
- 文件：`src/types/index.ts` + `src/lib/api.ts`
- 新增类型 + API 函数
- 验证：tsc 通过

### Task 5: 市场页面（前端）
- 文件：`src/pages/MarketPage.tsx`（新建）+ `src/components/market/DeckCard.tsx`（新建）
- 书体分类 + 书家筛选 + 搜索 + 牌组网格 + 订阅按钮
- 验证：页面渲染正常

### Task 6: 导航 + 路由（前端）
- 文件：`src/components/layout/SideMenu.tsx` + `src/components/layout/BottomNav.tsx` + `src/App.tsx`
- 新增市场导航项 + 路由
- 验证：导航跳转正常

### Task 7: Admin 发布功能（前端）
- 文件：`src/components/market/PublishDialog.tsx`（新建）+ `src/pages/CardManagePage.tsx`
- 发布弹窗 + 牌组管理页入口
- 验证：Admin 能发布牌组

### Task 8: 权限控制 + Dashboard 适配（前端）
- 文件：`src/pages/SettingsPage.tsx` + `src/pages/DashboardPage.tsx`
- 普通用户隐藏导入导出 + Dashboard 显示已订阅牌组
- 验证：普通用户视角正确

### Task 9: 构建 + 部署验证
- `npm run build` 通过
- 端到端测试
