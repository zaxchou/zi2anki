# zi2anki 部署安全规则

这份文档定义公开注册后的生产部署边界。目标是让日常部署“默认安全”，即使执行者只说“push 部署”，也不能误覆盖生产用户数据。

## 核心原则

1. **生产数据库是用户数据唯一真源。**
   本地数据库永远不能覆盖生产数据库。

2. **日常部署不恢复数据库。**
   `bash deploy.sh anki` 只部署代码、前端构建、server 文件和依赖，不做本地 DB → 生产 DB restore。

3. **用户数据永不从本地同步。**
   这些表属于生产用户数据域：
   - `users`
   - `user_card_progress`
   - `user_subscriptions`
   - `study_sessions`
   - `daily_stats`
   - `jizi_history`

4. **内容可以发布，但必须走内容 upsert。**
   牌组、卡片、市场元数据、封面和图库文件可以从本地或生产后台发布，但不能通过整库 restore；必须保留用户进度。

5. **任何 DB 变更前必须有生产备份。**
   内容发布、结构迁移、手动修复都必须先运行生产备份，并验证备份可读。

## 固定命令语义

| 需求 | 允许命令 | 数据风险 |
|---|---|---|
| “push 部署” / 发布代码 | `git push` + `bash deploy.sh anki` | 不覆盖 DB |
| 只补传图片文件 | `bash deploy.sh anki --data` | 只增量上传缺失 uploads 文件，不删除生产文件 |
| 发布结构迁移 | `bash deploy.sh anki --migrate` | 先备份，再部署；只允许幂等 DDL/backfill |
| 发布牌组/图库内容 | `bash deploy.sh anki --content <package>` | 先备份；当前未实现安全 upsert 前会拒绝执行 |
| 本地 DB 覆盖生产 DB | 禁止 | 高危，不允许在日常脚本中出现 |

## 已禁用的旧命令

`bash deploy.sh anki --sync` 已禁用。

旧 `--sync` 会：

1. 从本地 `zi2anki` 数据库执行 `pg_dump`
2. 上传 dump 到生产
3. 在生产执行 `TRUNCATE cards, daily_stats, decks, marketplace_decks, study_sessions, user_card_progress, user_subscriptions, users RESTART IDENTITY CASCADE`
4. 将本地数据恢复到生产

公开注册后这会清空生产用户、订阅、学习进度和统计，所以必须永久禁止作为日常部署路径。

## 部署脚本安全机制

`deploy.sh anki*` 应具备以下防护：

- 生产部署锁：`/opt/zi2anki/.deploy.lock`，防止并发部署。
- 用户数据哨兵：部署前后对比以下表 count，不允许下降：
  - `users`
  - `user_card_progress`
  - `user_subscriptions`
  - `study_sessions`
  - `daily_stats`
  - `jizi_history`
- DB 相关操作前强制运行 `scripts/backup-db.sh`。
- 备份必须通过 `gzip -t`，记录 size 和 sha256。
- 部署日志写入 `/opt/zi2anki/deploy-audit.log`。

## 备份规则

生产备份脚本：`scripts/backup-db.sh [operation] [git_commit]`

备份文件位于：`/opt/zi2anki/backups/`

文件名格式示例：

```text
zi2anki_20260625_210000_pre-content_6bc2c38.sql.gz
```

每次备份会生成：

- `.sql.gz` 备份文件
- `.sha256` checksum 文件
- `latest.json` 最近备份元数据

默认保留 30 天。

## 结构迁移规则

允许：

- `CREATE TABLE IF NOT EXISTS`
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- 幂等 backfill，且以生产现有数据为输入

禁止在普通迁移中使用：

- `DROP TABLE`
- `DROP COLUMN`
- `TRUNCATE`
- 无明确范围的 `DELETE`
- 无明确范围的 `UPDATE`
- 用本地数据覆盖生产业务数据

## 内容发布目标机制

最终内容发布应通过服务端 `contentSync` 内核完成：

- deck 使用稳定 `source_key`
- card 使用稳定 `source_key`
- 已有卡片更新时保留 `cards.id`
- 新卡新增
- 移除的卡片 inactive/archive，不物理删除
- 不删除 `user_card_progress`、`study_sessions`、`daily_stats`
- 发布前提供 dry-run diff：新增/更新/停用/不变数量

生产后台上传和本地命令行发布都应复用这套内核。

## Break-glass 恢复流程

真正需要恢复生产 DB 时，不走 `deploy.sh`。

必须按以下流程人工处理：

1. 明确事故原因和目标备份文件。
2. 先恢复到临时数据库，例如 `zi2anki_restore_test`。
3. 检查临时库：用户数量、订阅数量、学习进度、抽样登录/学习数据。
4. 确认维护窗口，暂停写入。
5. 再执行受控恢复或数据库切换。
6. 全过程记录到恢复日志。

不要自动 restore 生产库。自动 restore 可能造成二次伤害。

## 给 Claude / agent 的规则

如果用户说“push 部署”，只能理解为：

1. 检查状态和构建
2. `git push`
3. `bash deploy.sh anki`
4. 健康检查

不得执行：

- `deploy.sh anki --sync`
- 本地 `pg_dump` 后恢复到生产
- 生产 `TRUNCATE` / 批量删除用户数据
- 未备份的内容发布或结构迁移

如果用户明确要求恢复/重置生产数据库，必须先解释风险并要求单独确认 break-glass 流程，不能把它混入普通部署。
