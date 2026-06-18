---
name: deck-ownership-fix
description: Fixed deck ownership check — admin bypasses user_id filter; removed duplicate DELETE route
metadata:
  type: reference
---

## 2026-06-18: 牌组所有权修复

### 问题 1：重命名牌组 404
**根因**: `PUT /decks/:id` 中 `WHERE id = $1 AND user_id = $2` 未考虑 admin 角色。数据库中有幽灵用户（users 表中已删除的 user_id）引用的牌组，导致 admin 登录也无法通过 ownership 检查。

**修复**: 所有 deck API 增加 admin bypass：`WHERE id = $1 AND (user_id = $2 OR $3)`，其中 `$3` 是 `isAdmin` 布尔值。

### 问题 2：牌组列表不完整
**根因**: `GET /api/decks` 的 WHERE 子句 `d.user_id = $X OR us.user_id = $X` 限制了普通用户视角，但 admin 也应能看全部。

**修复**: 增加 `WHERE $isAdmin OR d.user_id = $X OR us.user_id = $X`。

### 问题 3：重复 DELETE 路由
文件末尾有两个 `DELETE /decks/:id` 路由定义（第 149 行和第 276 行），Express 会使用第一个，导致第二个（更完整的删除逻辑）永远不会执行。合并为一个，加 `requireAdmin` 中间件。

### 修改的文件
- `server/routes/decks.ts` — 全部 API 增加 admin bypass，合并重复 DELETE
- `server/routes/cards.ts` — GET/POST 路由增加 admin bypass（due-cards/new-cards 已有）

### 幽灵用户清理
数据库修复：`85664e93-3b31-41f1-abad-a5707ed4bc73`（已删除用户）的牌组 → admin
