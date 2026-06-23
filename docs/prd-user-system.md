# PRD：多用户系统

## 1. 产品目标

一句话：让不同用户拥有各自独立的记忆库（牌组、卡片、学习记录、统计数据），使用前必须登录，实现多用户数据隔离。

## 2. 用户故事

| 编号 | 角色 | 用户故事 | 优先级 |
|------|------|---------|--------|
| US1 | 新用户 | 我希望注册一个账号，以便拥有自己的记忆库 | P0 |
| US2 | 已注册用户 | 我希望用账号密码登录，以便访问我的牌组和卡片 | P0 |
| US3 | 已登录用户 | 登录后我只能看到自己的牌组和卡片，看不到其他用户的数据 | P0 |
| US4 | 访客 | 未登录状态下访问任何页面，应被重定向到登录页 | P0 |
| US5 | 管理员 | 系统中没有用户时，第一个注册的用户自动成为管理员 | P0 |
| US6 | 已登录用户 | 我希望能在界面上看到当前用户名，并可以登出 | P1 |
| US7 | 已登录用户 | 关闭浏览器后再次打开，不必重新登录 | P1 |
| US8 | 注册用户 | 如果我输入了错误的密码或尝试注册已存在的用户名，应看到明确的错误提示 | P2 |

## 3. 需求池

### P0（必须）

**后端**

- [ ] **认证 API**: 实现 `POST /api/auth/register` 和 `POST /api/auth/login`
  - register：接收 `{ username, password }`，校验用户名唯一性，bcrypt 哈希密码，返回 JWT token + 用户信息
  - login：接收 `{ username, password }`，bcrypt 对比密码，返回 JWT token + 用户信息
- [ ] **JWT 签发**: 登录/注册成功时签发 JWT token（建议 payload 包含 `userId`, `username`），设置过期时间（建议 7 天）
- [ ] **bcrypt 密码哈希**: 注册时对密码进行 bcrypt 哈希（salt rounds = 10），登录时对比
- [ ] **JWT 鉴权中间件**: 所有 `/api/*` 路由（除 `/api/auth/*`）增加 JWT 鉴权中间件，从 `Authorization: Bearer <token>` 中解析用户信息并挂载到 `req.user`
- [ ] **数据表改造**:
  - 新建 `users` 表：`id TEXT PRIMARY KEY`, `username TEXT UNIQUE NOT NULL`, `password_hash TEXT NOT NULL`, `role TEXT DEFAULT 'user'`, `created_at TEXT NOT NULL`
  - 已有四张表（`decks`, `cards`, `study_sessions`, `daily_stats`）增加 `user_id TEXT NOT NULL` 字段，外键引用 `users(id)`
- [ ] **数据隔离**: 所有查询类 API 增加 `WHERE user_id = ?` 过滤，所有写入类 API 使用当前登录用户的 `user_id`
- [ ] **数据库迁移脚本**: `server/db.ts` 中通过 `ALTER TABLE` + 捕获异常的方式兼容已有数据库，为新数据库直接使用完整建表 SQL
- [ ] **自动创建管理员**: 数据库中无用户时，第一个注册的用户自动成为管理员

**前端**

- [ ] **登录页 `/login`**: 居中卡片布局，用户名 + 密码输入框，登录按钮，底部切换到"注册"链接
- [ ] **注册页 `/register`**: 同登录页布局，注册按钮，底部切换到"登录"链接
- [ ] **路由守卫**: 封装 `ProtectedRoute` 组件，所有现有页面路径（`/`, `/dashboard`, `/decks`, `/study/:deckId`, `/decks/:deckId/cards`, `/settings`, `/analytics`）包裹在 `ProtectedRoute` 内，未登录跳转 `/login`
- [ ] **请求自动带 token**: 封装 `api.ts` 中的 `request` 函数，自动从 `localStorage` 读取 token 并添加到 `Authorization` header
- [ ] **Zustand auth store**: `useAuthStore` 管理 `{ user, token, login, logout, isLoading }`，token 持久化到 `localStorage`

### P1（重要）

- [ ] **登出功能**: 清除 localStorage 中的 token 和 user 信息，跳转到登录页
- [ ] **登录状态持久化**: token 存入 `localStorage`，页面刷新后从 `localStorage` 恢复登录状态
- [ ] **当前用户信息展示**: 顶部导航栏显示当前用户名，旁边放登出按钮

### P2（锦上添花）

- [ ] **错误提示**: 登录/注册失败时（密码错误、用户名已存在等），在表单下方显示红色错误提示文字
- [ ] **加载状态**: 登录/注册按钮在请求中显示加载动画（MUI CircularProgress），防止重复提交
- [ ] **Token 过期处理**: 当 API 返回 401 时，自动清除 token 并跳转登录页

## 4. UI 设计稿描述

### 登录/注册页面（`/login`, `/register`）

```
+-------------------------------------------------+
|                                                 |
|              ┌─────────────────┐                |
|              │                 │                |
|              │   🖋 zi2anki    │                |
|              │   书法记忆卡     │                |
|              │                 │                |
|              │   ┌─────────┐   │                |
|              │   │ 用户名   │   │                |
|              │   └─────────┘   │                |
|              │   ┌─────────┐   │                |
|              │   │ 密码     │   │                |
|              │   └─────────┘   │                |
|              │                 │                |
|              │  ┌───────────┐  │                |
|              │  │  登  录   │  │                |
|              │  └───────────┘  │                |
|              │                 │                |
|              │  没有账号？注册  │                |
|              │                 │                |
|              └─────────────────┘                |
|                                                 |
+-------------------------------------------------+
```

布局要点：
- **居中卡片式布局**：卡片在屏幕水平和垂直方向居中，使用 MUI `Card` + `Box` flexbox 实现
- **Logo + 标题**: 卡片顶部显示应用 Logo 图标 + "zi2anki" 标题 + "书法记忆卡"副标题
- **表单**: MUI `TextField` 组件，用户名和密码两个字段（密码 `type="password"`)
- **提交按钮**: MUI `Button`，`fullWidth`，`variant="contained"`，青色主题色
- **切换链接**: 按钮下方显示文案，登录页显示"没有账号？注册"，注册页显示"已有账号？登录"，使用 MUI `Link` 组件，`react-router-dom` 的 `Link` 导航
- **风格**: 与现有 MUI 主题一致，背景色跟随系统设置（浅色/深色），卡片阴影为 MUI 默认 `elevation`

### 顶部导航栏调整

现有 `TopBar.tsx` 右侧增加用户信息区域：
- 显示当前用户名（MUI `Typography`）
- 登出按钮（MUI `IconButton`，图标为 `LogoutIcon`）

## 5. 待确认问题

| 问题 | 建议 | 决策 |
|------|------|------|
| 管理员创建方式 | 第一个注册用户自动成为管理员 | **已实现** |
| JWT 密钥 | 从环境变量 `JWT_SECRET` 读取，开发环境使用默认值 | **已实现** |
| JWT 过期时间 | 7 天，记住我 365 天 | **已实现** |
| 密码长度限制 | 最短 6 位，最长 64 位 | **已实现** |
| 用户名规则 | 字母/数字/下划线/中文，长度 2-20 | **已实现** |

## 6. 涉及的技术选型

| 模块 | 技术 | 说明 |
|------|------|------|
| JWT 签发/验证 | `jsonwebtoken` | npm 包，纯 JS 实现 |
| 密码哈希 | `bcryptjs` | 纯 JS 实现，无需编译原生模块 |
| 前端状态管理 | Zustand | `useAuthStore`，已使用 Zustand |
| 环境变量 | `dotenv` | 可选，用于管理 `JWT_SECRET` |
| 前端路由 | react-router-dom v6 | 已在项目中大量使用 |

## 7. 设计决策说明

### 7.1 为什么用 `user_id` 而不是 `owner_id`

所有资源表增加 `user_id` 字段，统一命名，含义清晰。查询时通过 `req.user.userId` 获取当前用户 ID。

### 7.2 JWT 存储位置

Token 存储在 `localStorage` 而非 `httpOnly cookie`。虽然 Cookie 方案对 XSS 防护更好，但当前项目为单用户到多用户的过渡阶段，复杂度需要控制。后续可升级为 httpOnly cookie 方案。

### 7.3 管理员账号创建

不再创建默认管理员账号。数据库中无用户时，第一个注册的用户自动成为管理员。这保证了开源使用者创建自己的管理员，而线上环境（已有用户数据）不受影响。
