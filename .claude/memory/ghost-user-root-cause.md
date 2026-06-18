---
name: ghost-user-root-cause
description: 幽灵用户的根因是缺少外键约束导致数据完整性问题
metadata:
  type: reference
---

## 幽灵用户根因分析

### 直接原因

幽灵用户 `85664e93-3b31-41f1-abad-a5707ed4bc73` 是开发过程中手动从 `users` 表删除了一个测试用户，但所有关联数据（decks、cards、study_sessions、daily_stats、user_card_progress、user_subscriptions）因为**没有任何外键约束**而全部残留。

### 根本原因（3 层）

1. **所有 `user_id` 列没有 `REFERENCES users(id)` 外键约束** — 数据库层面完全不阻止写入不存在的 user_id。即使通过应用代码正常删除用户，关联数据也会变成孤儿。

2. **`initDb()` 迁移在创建自动订阅时不验证用户存在** — `INSERT INTO user_subscriptions (user_id, deck_id) SELECT DISTINCT user_id, id FROM decks` 从不 JOIN users 表，幽灵 user_id 会直接被写入 subscription。

3. **幽灵用户 → 订阅幽灵牌组 → API 的 ownership 检查失败** — 因为 `GET /api/decks` 用 `WHERE ... OR us.user_id = $X` 查到了这些记录，前端看到牌组；但 `PUT /decks/:id` 用 `WHERE id = $1 AND user_id = $2` 找不到 owner（因为 user_id 指向幽灵），返回 404。

### 修复方案

**永久修复（代码层）**:
- `server/db.ts` 建表语句中所有 `user_id TEXT` 改为 `user_id TEXT REFERENCES users(id) ON DELETE SET NULL/CASCADE`
- `migrateSchema()` 为已有数据库补加 FK
- `initDb()` 的自动订阅改为 `INNER JOIN users` 防止幽灵订阅

**策略说明**:
- `ON DELETE SET NULL` — decks/cards/study_sessions（用户删除后保留数据但标记为空）
- `ON DELETE CASCADE` — daily_stats/user_card_progress/user_subscriptions（用户删除后清理统计和订阅，不留孤儿）
